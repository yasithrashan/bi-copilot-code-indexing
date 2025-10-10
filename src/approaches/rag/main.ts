import type { Chunk } from "./types";
import { loadFiles, readFiles } from "../../shared/file_extraction";
import { getEmbeddings } from "./embeddings";
import { BallerinaChunker } from "./chunker";
import { createPineconeClient, createCollection, upsertChunks, searchRelevantChunks } from "./vector_db";
import { GetUserQuery } from "../../shared/queries";
import fs from 'fs/promises';
import { expandCode } from "./code-generation/code_expand";
import path from "path";
import { processCodeGenerationForQuery } from "./code-generation/code";
import { evaluateRelevantChunksQuality } from "./code-generation/code_quality";

/** Load and chunk all Ballerina files */
async function loadAndChunkFiles(ballerinaDir: string, chunker: BallerinaChunker): Promise<Chunk[]> {
    console.time("Loading Files");
    const files = loadFiles(ballerinaDir);
    console.timeEnd("Loading Files");

    console.time("Chunking Code");
    let allChunks: Chunk[] = [];
    for (const file of files) {
        const code = readFiles(file);
        allChunks = allChunks.concat(chunker.chunkBallerinaCode(code, file));
    }
    chunker.saveChunksToJson(allChunks, ballerinaDir);
    console.timeEnd("Chunking Code");

    return allChunks;
}

/** Create Pinecone collection and upsert chunks */
async function indexChunks(
    pineconeClient: any,
    chunks: Chunk[],
    voyageApiKey: string
) {
    console.time("Creating Pinecone Collection");
    await createCollection(pineconeClient);
    console.timeEnd("Creating Pinecone Collection");

    const textsForEmbedding = chunks.map(chunk => chunk.content);

    console.time("Generating Embeddings");
    const embeddings = await getEmbeddings(textsForEmbedding, voyageApiKey);
    console.timeEnd("Generating Embeddings");

    console.time("Upserting Chunks");
    await upsertChunks(pineconeClient, chunks, embeddings, textsForEmbedding);
    console.timeEnd("Upserting Chunks");
}

/** Process each user query */
async function processQueries(
    ballerinaDir: string,
    userQueries: { query: string }[],
    embeddedUserQueries: number[][],
    pineconeClient: any
) {
    console.time("Processing User Queries");

    const relevantChunksDir = 'outputs/rag_outputs/relevant_chunks';
    await fs.mkdir(relevantChunksDir, { recursive: true });

    for (let i = 0; i < userQueries.length; i++) {
        const docId = i + 1;
        const userQuery = userQueries[i];
        const queryEmbedding = embeddedUserQueries[i];

        if (!userQuery) {
            console.warn(`User query at index ${i} is undefined.`);
            continue;
        }

        if (!queryEmbedding) {
            console.warn(`No embedding found for user query: ${userQuery.query}`);
            continue;
        }

        // Search for relevant chunks
        const relevantChunks = await searchRelevantChunks(pineconeClient, queryEmbedding);

        // Save JSON
        const jsonData = {
            query: userQuery.query,
            relevant_chunks: relevantChunks.map(chunk => ({
                score: chunk.score,
                payload: chunk.payload
            }))
        };
        const jsonPath = path.join(relevantChunksDir, `${docId}.json`);
        await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));

        // Save Markdown
        const mdContent = relevantChunks.reduce((md, chunk, idx) => {
            return md + `### Chunk ${idx + 1}\n\`\`\`ballerina\n${chunk.payload.content.trim()}\n\`\`\`\n\n`;
        }, `# User Query ${docId}\n\n**Query:** ${userQuery.query}\n\n## Relevant Chunks\n\n`);
        const mdPath = path.join(relevantChunksDir, `${docId}.md`);
        await fs.writeFile(mdPath, mdContent);

        // Expand code
        const expandOutputDir = path.join('outputs/rag_outputs', 'expand_code');
        await expandCode({ chunksFilePath: jsonPath, projectPath: ballerinaDir, outputDir: expandOutputDir, docId });

        // Generate code
        await processCodeGenerationForQuery(docId, userQuery.query);

        // Evaluate code quality
        await evaluateRelevantChunksQuality({
            chunksFilePath: jsonPath,
            projectPath: ballerinaDir,
            outputDir: path.join('outputs/rag_outputs', 'quality_evaluation'),
            docId
        });
    }

    console.timeEnd("Processing User Queries");
}

export async function ragPipeline(
    ballerinaDir: string,
    voyageApiKey: string,
    pineconeApiKey: string
): Promise<void> {
    console.time("RAG Pipeline Total Time");

    const chunker = new BallerinaChunker();
    const pineconeClient = createPineconeClient(pineconeApiKey);

    // Step 1: Load and chunk files
    const allChunks = await loadAndChunkFiles(ballerinaDir, chunker);

    // Step 2: Index chunks in Pinecone
    await indexChunks(pineconeClient, allChunks, voyageApiKey);

    // Step 3: Process user queries
    const userQueries = await GetUserQuery();
    const userQueryTexts = userQueries.map(q => q.query);
    const embeddedUserQueries = await getEmbeddings(userQueryTexts, voyageApiKey);

    await processQueries(ballerinaDir, userQueries, embeddedUserQueries, pineconeClient);

    console.timeEnd("RAG Pipeline Total Time");
}

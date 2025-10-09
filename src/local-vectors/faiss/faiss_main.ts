import type { Chunk } from "./types";
import { loadFiles, readFiles } from "../../shared/file_extraction";
import { getEmbeddings } from "./faiss_embeddings";
import { BallerinaChunker } from "./faiss_chunker";
import {
    createFaissClient,
    createCollection,
    upsertChunks,
    searchRelevantChunks,
    getIndexStats
} from "./faiss_client";
import { GetUserQuery } from "../../shared/queries";
import fs from 'fs/promises';
import path from "path";
// import { expandCode } from "./code-generation/code_expand";
// import { processCodeGenerationForQuery } from "./code-generation/code";
import { evaluateRelevantChunksQuality } from "./faiss_code_quality";

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

/** Create FAISS collection and upsert chunks */
async function indexChunks(
    faissClient: any,
    chunks: Chunk[],
    voyageApiKey: string
) {
    console.time("Creating FAISS Collection");

    // Get embedding dimension by generating a sample embedding
    if (!chunks || chunks.length === 0 || !chunks[0]) {
        throw new Error("No chunks available to generate embeddings.");
    }
    const sampleEmbedding = await getEmbeddings([chunks[0].content], voyageApiKey);
    if (!sampleEmbedding || !sampleEmbedding[0]) {
        throw new Error("Failed to generate sample embedding for dimension detection.");
    }
    const dimension = sampleEmbedding[0].length;

    await createCollection(faissClient, dimension);
    console.timeEnd("Creating FAISS Collection");

    const textsForEmbedding = chunks.map(chunk => chunk.content);

    console.time("Generating Embeddings");
    const embeddings = await getEmbeddings(textsForEmbedding, voyageApiKey);
    console.timeEnd("Generating Embeddings");

    console.time("Upserting Chunks to FAISS");
    await upsertChunks(faissClient, chunks, embeddings, textsForEmbedding);
    console.timeEnd("Upserting Chunks to FAISS");

    // Log stats
    const stats = await getIndexStats(faissClient);
    if ('total_vectors' in stats && 'dimension' in stats) {
        console.log(`Index stats: ${stats.total_vectors} vectors, dimension: ${stats.dimension}`);
    } else {
        console.log("Index stats unavailable:", stats);
    }
}

/** Process each user query */
async function processQueries(
    ballerinaDir: string,
    userQueries: { query: string }[],
    embeddedUserQueries: number[][],
    faissClient: any
) {
    console.time("Processing User Queries");

    const relevantChunksDir = 'outputs/faiss_outputs/relevant_chunks';
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

        console.log(`Processing query ${docId}: ${userQuery.query}`);

        // Search for relevant chunks using FAISS
        const relevantChunks = await searchRelevantChunks(faissClient, queryEmbedding);

        console.log(`Found ${relevantChunks.length} relevant chunks for query ${docId}`);

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
            return md + `### Chunk ${idx + 1} (Score: ${chunk.score.toFixed(4)})\n\`\`\`ballerina\n${chunk.payload.content.trim()}\n\`\`\`\n\n`;
        }, `# User Query ${docId}\n\n**Query:** ${userQuery.query}\n\n## Relevant Chunks\n\n`);
        const mdPath = path.join(relevantChunksDir, `${docId}.md`);
        await fs.writeFile(mdPath, mdContent);

        // Evaluate code quality
                await evaluateRelevantChunksQuality({
                    chunksFilePath: jsonPath,
                    projectPath: ballerinaDir,
                    outputDir: path.join('outputs/faiss_outputs', 'quality_evaluation'),
                    docId
                });

        // Uncomment these if you want to use them:
        // Expand code
        // const expandOutputDir = path.join('outputs/faiss_outputs', 'expand_code');
        // await expandCode({ chunksFilePath: jsonPath, projectPath: ballerinaDir, outputDir: expandOutputDir, docId });

        // Generate code
        // await processCodeGenerationForQuery(docId, userQuery.query);

        // Evaluate code quality
        // await evaluateRelevantChunksQuality({
        //     chunksFilePath: jsonPath,
        //     expandedCodeFilePath: path.join(expandOutputDir, `${docId}.md`),
        //     projectPath: ballerinaDir,
        //     outputDir: path.join('outputs/faiss_outputs', 'quality_evaluation'),
        //     docId
        // });
    }

    console.timeEnd("Processing User Queries");
}

export async function faissPipeline(
    ballerinaDir: string,
    voyageApiKey: string
): Promise<void> {
    console.time("faiss Pipeline Total Time");

    const chunker = new BallerinaChunker();
    const faissClient = createFaissClient();

    // Check FAISS service health
    const isHealthy = await faissClient.healthCheck();
    if (!isHealthy) {
        throw new Error("FAISS service is not healthy. Please ensure the Python service is running.");
    }
    console.log("✓ FAISS service is healthy");

    // Step 1: Load and chunk files
    const allChunks = await loadAndChunkFiles(ballerinaDir, chunker);

    // Step 2: Index chunks in FAISS
    await indexChunks(faissClient, allChunks, voyageApiKey);

    // Step 3: Process user queries
    const userQueries = await GetUserQuery();
    const userQueryTexts = userQueries.map(q => q.query);
    const embeddedUserQueries = await getEmbeddings(userQueryTexts, voyageApiKey);

    await processQueries(ballerinaDir, userQueries, embeddedUserQueries, faissClient);

    console.timeEnd("Faiss Pipeline Total Time");
}
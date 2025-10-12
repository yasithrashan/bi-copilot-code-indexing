import type { Chunk } from "./types";
import { loadFiles, readFiles } from "../../shared/file_extraction";
import { BallerinaChunker } from "./sqlite_chunker";
import { getEmbeddings } from "./sqlite_embeddings";
import { initDB, upsertChunks, searchRelevantChunks, getDBStats } from "./sqlite_db";
import { GetUserQuery } from "../../shared/queries";
import fs from 'fs/promises';
import path from "path";

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

    console.log(`✓ Total chunks created: ${allChunks.length}`);
    return allChunks;
}

/** Process each user query */
async function processQueries(
    ballerinaDir: string,
    userQueries: { query: string }[],
    embeddedUserQueries: number[][],
    db: any
) {
    console.time("Processing User Queries");

    const relevantChunksDir = 'outputs/sqlite_outputs/relevant_chunks';
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

        // Search for relevant chunks using SQLite vector similarity
        const relevantChunks = searchRelevantChunks(db, queryEmbedding);

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

        // Uncomment if you want to evaluate code quality
        // await evaluateRelevantChunksQuality({
        //     chunksFilePath: jsonPath,
        //     projectPath: ballerinaDir,
        //     outputDir: path.join('outputs/sqlite_outputs', 'quality_evaluation'),
        //     docId
        // });
    }

    console.timeEnd("Processing User Queries");
}

/** Main pipeline */
export async function sqlitePipeline(ballerinaDir: string, voyageApiKey: string) {
    console.time("SQLite Vector Pipeline Total Time");

    const chunker = new BallerinaChunker();

    // Step 1: Load and chunk files
    const allChunks = await loadAndChunkFiles(ballerinaDir, chunker);

    // Step 2: Initialize SQLite vector DB
    const db = initDB();

    // Step 3: Generate embeddings
    console.time("Generating Embeddings");
    const texts = allChunks.map(c => c.content);
    const embeddingsRaw = await getEmbeddings(texts, voyageApiKey);
    const embeddings = embeddingsRaw.map(e => new Float32Array(e));
    console.timeEnd("Generating Embeddings");

    // Step 4: Upsert into SQLite vector DB
    console.time("Upserting Chunks to SQLite Vector DB");
    upsertChunks(db, allChunks, embeddings);
    console.timeEnd("Upserting Chunks to SQLite Vector DB");

    // Log stats
    const stats = getDBStats(db);
    console.log(`Database stats: ${stats.total_chunks} chunks, dimension: ${stats.dimension}`);

    // Step 5: Process user queries
    const userQueries = await GetUserQuery();
    const userQueryTexts = userQueries.map(q => q.query);
    const embeddedUserQueries = await getEmbeddings(userQueryTexts, voyageApiKey);

    await processQueries(ballerinaDir, userQueries, embeddedUserQueries, db);

    console.log(`✓ Pipeline completed. Total chunks: ${allChunks.length}`);
    console.timeEnd("SQLite Vector Pipeline Total Time");
}
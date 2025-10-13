import type { Chunk } from "./types";
import { loadFiles, readFiles } from "../../shared/file_extraction";
import { BallerinaChunker } from "./sqlite_chunker";
import { getEmbeddings } from "./sqlite_embeddings";
import { initDB, upsertChunks, searchRelevantChunks, getDBStats } from "./sqlite_db";
import { GetUserQuery } from "../../shared/queries";
import fs from 'fs/promises';
import path from "path";
import { evaluateRelevantChunksQuality } from "./sqlite_code_quality";

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

    const idCounts = new Map<string, number>();
    for (const chunk of allChunks) {
        let baseId = chunk.metadata.id;
        let count = idCounts.get(baseId) ?? 0;

        if (count > 0) {
            // Append counter to make unique
            chunk.metadata.id = `${baseId}:${count + 1}`;
        }

        // Update counter for next occurrence
        idCounts.set(baseId, count + 1);
    }

    chunker.saveChunksToJson(allChunks, ballerinaDir);
    console.timeEnd("Chunking Code");

    // DEBUG: Check for duplicate IDs
    const finalIdCounts = new Map<string, number>();
    for (const chunk of allChunks) {
        const id = chunk.metadata.id;
        finalIdCounts.set(id, (finalIdCounts.get(id) ?? 0) + 1);
    }
    const duplicates = Array.from(finalIdCounts.entries()).filter(([_, count]) => count > 1);

    if (duplicates.length > 0) {
        console.warn(`\nDUPLICATE IDs STILL DETECTED: ${duplicates.length}`);
        duplicates.forEach(([id, count]) => {
            console.warn(`   ID "${id}" appears ${count} times`);
        });
    } else {
        console.log(`✓ All ${allChunks.length} chunks have unique IDs`);
    }

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

        // Evaluate Code Quality
        await evaluateRelevantChunksQuality({
            chunksFilePath: jsonPath,
            projectPath: ballerinaDir,
            outputDir: path.join('outputs/sqlite_outputs', 'quality_evaluation'),
            docId
        });
    }

    console.timeEnd("Processing User Queries");
}

/** Main pipeline */
export async function sqlitePipeline(ballerinaDir: string, voyageApiKey: string) {
    console.time("SQLite Vector Pipeline Total Time");

    const chunker = new BallerinaChunker();

    // Step 1: Load and chunk files
    const allChunks = await loadAndChunkFiles(ballerinaDir, chunker);

    // Step 2: Initialize SQLite vector DB (delete old db first)
    const dbPath = "vector_database.db";
    try {
        await fs.unlink(dbPath);
        console.log(`Cleared old database: ${dbPath}`);
    } catch {
        // File doesn't exist, that's fine
    }

    const db = initDB(dbPath);

    // Step 3: Generate embeddings
    console.time("Generating Embeddings");
    const texts = allChunks.map(c => c.content);
    const embeddingsRaw = await getEmbeddings(texts, voyageApiKey);
    const embeddings = embeddingsRaw.map(e => new Float32Array(e));
    console.timeEnd("Generating Embeddings");

    // Step 4: Upsert into SQLite vector DB
    console.time("Upserting Chunks to SQLite Vector DB");
    const insertStats = upsertChunks(db, allChunks, embeddings);
    console.timeEnd("Upserting Chunks to SQLite Vector DB");

    // Log stats
    const stats = getDBStats(db);
    console.log(`\n✓ Database stats: ${stats.total_chunks} chunks stored, dimension: ${stats.dimension}`);

    if (stats.total_chunks !== allChunks.length) {
        console.error(`\nMISMATCH: Expected ${allChunks.length} chunks but only ${stats.total_chunks} stored!`);
        console.error(`   Lost ${allChunks.length - stats.total_chunks} chunks due to duplicate IDs`);
    }

    // Step 5: Process user queries
    const userQueries = await GetUserQuery();
    const userQueryTexts = userQueries.map(q => q.query);
    const embeddedUserQueries = await getEmbeddings(userQueryTexts, voyageApiKey);

    await processQueries(ballerinaDir, userQueries, embeddedUserQueries, db);

    console.log(`✓ Pipeline completed. Total chunks: ${allChunks.length}`);
    console.timeEnd("SQLite Vector Pipeline Total Time");
}
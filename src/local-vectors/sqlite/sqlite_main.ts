import type { Chunk } from "./types";
import { loadFiles, readFiles } from "../../shared/file_extraction";
import { BallerinaChunker } from "./sqlite_chunker";
import { getEmbeddings } from "./sqlite_embeddings";
import { initDB, upsertChunks } from "./sqlite_db";

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

/** Main pipeline */
export async function sqlitePipeline(ballerinaDir: string, voyageApiKey: string) {
    console.time("Vector Pipeline Total Time");

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

    console.log(`✓ Pipeline completed. Total chunks: ${allChunks.length}`);
    console.timeEnd("Vector Pipeline Total Time");
}

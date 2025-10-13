import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import type { Chunk, RelevantChunk } from "./types";

/** Initialize SQLite vector DB */
export function initDB(dbPath = "vector_database.db"): Database {
    Database.setCustomSQLite("/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib");

    const db = new Database(dbPath);
    sqliteVec.load(db);

    db.prepare(`
        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            content TEXT,
            vector BLOB,
            file TEXT,
            line INTEGER,
            endLine INTEGER,
            type TEXT,
            name TEXT,
            metadata TEXT
        )
    `).run();

    return db;
}

/** Convert Float32Array to Uint8Array for BLOB storage */
function float32ToBlob(array: Float32Array): Uint8Array {
    return new Uint8Array(array.buffer);
}

/** Convert Uint8Array back to Float32Array */
function blobToFloat32(blob: Uint8Array): Float32Array {
    return new Float32Array(blob.buffer);
}

/** Normalize vector to unit length */
function normalizeVector(v: Float32Array): Float32Array {
    const norm = Math.sqrt(
        Array.from(v).reduce((sum, val) => sum + val * val, 0)
    );
    if (norm === 0) return v;
    return new Float32Array(Array.from(v).map(val => val / norm));
}

/** Calculate cosine similarity between two vectors */
function cosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
        const ai = a[i];
        const bi = b[i];
        if (ai !== undefined && bi !== undefined) {
            dotProduct += ai * bi;
            normA += ai * ai;
            normB += bi * bi;
        }
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Upsert chunks into SQLite with normalized embeddings */
export function upsertChunks(db: Database, chunks: Chunk[], embeddings: Float32Array[]): void {
    if (!chunks?.length || !embeddings?.length || chunks.length !== embeddings.length) return;

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO chunks (id, content, vector, file, line, endLine, type, name, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];
        if (!chunk || !embedding) continue;

        const normalizedEmbedding = normalizeVector(embedding); // NORMALIZE before storage

        stmt.run(
            chunk.metadata.id,
            chunk.content,
            float32ToBlob(normalizedEmbedding),
            chunk.metadata.file,
            chunk.metadata.line,
            chunk.metadata.endLine,
            chunk.metadata.type,
            chunk.metadata.name ?? null,
            JSON.stringify(chunk.metadata)
        );
    }
}

/** Search for relevant chunks using vector similarity + threshold filtering */
export function searchRelevantChunks(
    db: Database,
    queryEmbedding: number[] | Float32Array,
    threshold: number = parseFloat(process.env.THRESHOLD as string)
): RelevantChunk[] {
    let queryVector = queryEmbedding instanceof Float32Array
        ? queryEmbedding
        : new Float32Array(queryEmbedding);

    queryVector = normalizeVector(queryVector); // NORMALIZE query

    const allChunks = db.prepare(`
        SELECT id, content, vector, file, line, endLine, type, name, metadata
        FROM chunks
    `).all() as Array<{
        id: string;
        content: string;
        vector: Uint8Array;
        file: string;
        line: number;
        endLine: number;
        type: string;
        name: string | null;
        metadata: string;
    }>;

    // Calculate cosine similarity scores
    const scoredChunks = allChunks.map(chunk => {
        const chunkVector = blobToFloat32(chunk.vector);
        const score = cosineSimilarity(queryVector, chunkVector);
        const metadata = JSON.parse(chunk.metadata);

        return {
            score,
            payload: {
                content: chunk.content,
                metadata,
                file: chunk.file,
                textForEmbedding: chunk.content
            }
        };
    });

    console.log('[Threshold Value] - ', threshold);

    // Filter chunks by threshold
    const filtered = scoredChunks
        .filter(c => c.score >= threshold)
        .sort((a, b) => b.score - a.score);

    return filtered;
}

/** Get database statistics */
export function getDBStats(db: Database): { total_chunks: number; dimension?: number } {
    const result = db.prepare("SELECT COUNT(*) as count FROM chunks").get() as { count: number };
    const firstChunk = db.prepare("SELECT vector FROM chunks LIMIT 1").get() as { vector: Uint8Array } | undefined;
    const dimension = firstChunk ? blobToFloat32(firstChunk.vector).length : undefined;

    return {
        total_chunks: result.count,
        dimension
    };
}
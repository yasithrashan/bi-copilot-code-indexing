import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
import type { Chunk } from "./types";

/** Initialize SQLite vector DB */
export function initDB(dbPath = "vector_database.db"): Database {
    // MacOS custom SQLite path
    Database.setCustomSQLite("/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib");

    const db = new Database(dbPath);
    sqliteVec.load(db);

    // Create table for chunks
    db.prepare(`
        CREATE TABLE IF NOT EXISTS chunks (
            id TEXT PRIMARY KEY,
            content TEXT,
            vector BLOB,
            file TEXT,
            line INTEGER,
            endLine INTEGER,
            type TEXT,
            name TEXT
        )
    `).run();

    return db;
}

/** Convert Float32Array to Uint8Array for BLOB storage */
function float32ToBlob(array: Float32Array): Uint8Array {
    return new Uint8Array(array.buffer);
}

/** Upsert chunks into SQLite */
export function upsertChunks(db: Database, chunks: Chunk[], embeddings: Float32Array[]): void {
    if (!chunks?.length || !embeddings?.length || chunks.length !== embeddings.length) return;

    const stmt = db.prepare(`
        INSERT OR REPLACE INTO chunks (id, content, vector, file, line, endLine, type, name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        if (!chunk) continue;
        const embedding = embeddings[i];
        if (!embedding) continue;
        const vectorBlob = float32ToBlob(embedding);

        stmt.run(
            chunk.metadata.id,
            chunk.content,
            vectorBlob,
            chunk.metadata.file,
            chunk.metadata.line,
            chunk.metadata.endLine,
            chunk.metadata.type,
            chunk.metadata.name ?? null
        );
    }
}
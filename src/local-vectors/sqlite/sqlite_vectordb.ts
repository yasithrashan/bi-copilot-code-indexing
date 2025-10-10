import type { Chunk } from "./types";
import { loadFiles, readFiles } from "../../shared/file_extraction";
import { getEmbeddings } from "./sqlite_embeddings";
import { BallerinaChunker } from "./sqlite_chunker";
import { GetUserQuery } from "../../shared/queries";
import fs from 'fs/promises';
import path from "path";
import { Database } from "bun:sqlite";
import * as sqliteVec from "sqlite-vec";
Database.setCustomSQLite("/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib");

interface ExtendedChunk extends Chunk {
    content: string;
    file: string;
    start_line?: number;
    end_line?: number;
    chunk_type?: string;
}

interface ChunkWithEmbedding extends ExtendedChunk {
    embedding: number[];
    id?: number;
}

interface SearchResult {
    id: number;
    content: string;
    file: string;
    score: number;
    embedding: number[];
}

interface ChunkRow {
    id: number;
    content: string;
    file: string;
    embedding: Buffer;
}

interface DatabaseStats {
    total_chunks: number;
    db_path: string;
    db_size: string;
}

class SqliteVectorDB {
    private db: Database;
    private dbPath: string;

    constructor(dbPath: string = 'vector_database.db') {
        this.dbPath = dbPath;
        this.db = new Database(dbPath);
        sqliteVec.load(this.db);
        this.initializeDatabase();
    }

    private initializeDatabase(): void {
        try {
            this.db.query(`
                CREATE TABLE IF NOT EXISTS chunks (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    content TEXT NOT NULL,
                    file TEXT NOT NULL,
                    start_line INTEGER,
                    end_line INTEGER,
                    chunk_type TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            `).run();

            this.db.query(`
                CREATE TABLE IF NOT EXISTS embeddings (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chunk_id INTEGER UNIQUE NOT NULL,
                    embedding BLOB NOT NULL,
                    FOREIGN KEY(chunk_id) REFERENCES chunks(id) ON DELETE CASCADE
                )
            `).run();

            this.db.query(`
                CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file)
            `).run();

            console.log("✓ SQLite database initialized");
        } catch (error) {
            console.error("Error initializing database:", error);
            throw error;
        }
    }

    async insertChunks(chunks: ChunkWithEmbedding[]): Promise<void> {
        console.time("Inserting Chunks");

        if (!chunks?.length) {
            console.warn("No chunks to insert");
            return;
        }

        const insertChunk = this.db.prepare(`
            INSERT INTO chunks (content, file, start_line, end_line, chunk_type)
            VALUES (?, ?, ?, ?, ?)
        `);

        const insertEmbedding = this.db.prepare(`
            INSERT INTO embeddings (chunk_id, embedding)
            VALUES (?, ?)
        `);

        try {
            const transaction = this.db.transaction(() => {
                for (const chunk of chunks) {
                    if (!chunk.content || !chunk.file) {
                        console.warn("Skipping chunk with missing content or file");
                        continue;
                    }

                    const chunkResult = insertChunk.run(
                        chunk.content,
                        chunk.file,
                        chunk.start_line ?? 0,
                        chunk.end_line ?? 0,
                        chunk.chunk_type ?? "code"
                    );

                    const chunkId = chunkResult.lastInsertRowid;

                    if (!chunk.embedding?.length) {
                        console.warn(`Skipping embedding for chunk ${chunk.file}`);
                        continue;
                    }

                    const embeddingBuffer = Buffer.from(
                        new Float32Array(chunk.embedding).buffer
                    );

                    insertEmbedding.run(chunkId, embeddingBuffer);
                }
            });

            transaction();
            console.timeEnd("Inserting Chunks");
            console.log(`✓ Inserted ${chunks.length} chunks with embeddings`);
        } catch (error) {
            console.error("Error inserting chunks:", error);
            throw error;
        }
    }

    /**
     * Search for similar chunks using cosine similarity with top-P (nucleus) filtering
     * @param queryEmbedding - The query embedding vector
     * @param topP - Cumulative probability threshold (default: 0.9)
     */
    async searchSimilarChunks(
        queryEmbedding: number[],
        topP: number = 0.6
    ): Promise<SearchResult[]> {
        if (!queryEmbedding?.length) {
            console.warn("Invalid query embedding");
            return [];
        }

        try {
            const query = `
                SELECT
                    c.id,
                    c.content,
                    c.file,
                    e.embedding
                FROM chunks c
                INNER JOIN embeddings e ON c.id = e.chunk_id
            `;

            const rows = this.db.prepare(query).all() as ChunkRow[];

            if (!rows.length) {
                console.warn("No chunks found in database");
                return [];
            }

            // Calculate similarity scores
            const results: SearchResult[] = rows.map(row => {
                const embeddingArray = new Float32Array(
                    row.embedding.buffer,
                    row.embedding.byteOffset,
                    row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
                );

                const embedding = Array.from(embeddingArray);
                const score = this.cosineSimilarity(queryEmbedding, embedding);

                return {
                    id: row.id,
                    content: row.content,
                    file: row.file,
                    score,
                    embedding
                };
            });

            // Sort by score (descending)
            const sortedResults = results.sort((a, b) => b.score - a.score);

            // Normalize scores to probabilities (softmax)
            const maxScore = sortedResults[0]?.score ?? 0;
            const expScores = sortedResults.map(r => Math.exp(r.score - maxScore));
            const sumExp = expScores.reduce((sum, val) => sum + val, 0);
            const probabilities = expScores.map(exp => exp / sumExp);

            // Apply top-P (nucleus) filtering
            let cumulativeProb = 0;
            const topPResults: SearchResult[] = [];

            for (let i = 0; i < sortedResults.length; i++) {
                cumulativeProb += probabilities[i] ?? 0;
                topPResults.push(sortedResults[i]!);

                if (cumulativeProb >= topP) {
                    break;
                }
            }

            return topPResults;

        } catch (error) {
            console.error("Error searching chunks:", error);
            return [];
        }
    }

    private cosineSimilarity(a: number[], b: number[]): number {
        if (!a?.length || !b?.length || a.length !== b.length) {
            return 0;
        }

        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;

        for (let i = 0; i < a.length; i++) {
            const ai = a[i] ?? 0;
            const bi = b[i] ?? 0;
            dotProduct += ai * bi;
            magnitudeA += ai * ai;
            magnitudeB += bi * bi;
        }

        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);

        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }

        return dotProduct / (magnitudeA * magnitudeB);
    }

    getChunkCount(): number {
        try {
            const result = this.db.prepare('SELECT COUNT(*) as count FROM chunks').get() as { count: number } | undefined;
            return result?.count ?? 0;
        } catch (error) {
            console.error("Error getting chunk count:", error);
            return 0;
        }
    }

    clearDatabase(): void {
        try {
            this.db.query('DELETE FROM embeddings').run();
            this.db.query('DELETE FROM chunks').run();
            console.log("✓ Database cleared");
        } catch (error) {
            console.error("Error clearing database:", error);
            throw error;
        }
    }

    close(): void {
        try {
            this.db.close();
            console.log("✓ Database connection closed");
        } catch (error) {
            console.error("Error closing database:", error);
        }
    }

    getStats(): DatabaseStats {
        try {
            const count = this.getChunkCount();
            const fsSync = require('fs');
            const stats = fsSync.statSync(this.dbPath);
            const sizeInMB = (stats.size / 1024 / 1024).toFixed(2);

            return {
                total_chunks: count,
                db_path: this.dbPath,
                db_size: `${sizeInMB} MB`
            };
        } catch (error) {
            console.error("Error getting stats:", error);
            return {
                total_chunks: 0,
                db_path: this.dbPath,
                db_size: "0 MB"
            };
        }
    }
}

async function loadAndChunkFiles(
    ballerinaDir: string,
    chunker: BallerinaChunker
): Promise<ExtendedChunk[]> {
    console.time("Loading Files");
    const files = loadFiles(ballerinaDir);
    console.timeEnd("Loading Files");

    console.time("Chunking Code");
    let allChunks: ExtendedChunk[] = [];

    for (const file of files) {
        try {
            const code = readFiles(file);
            const chunks = chunker.chunkBallerinaCode(code, file);

            const validatedChunks = chunks.map((chunk: any) => ({
                ...chunk,
                content: chunk.content ?? "",
                file: chunk.file ?? file,
                start_line: chunk.start_line ?? 0,
                end_line: chunk.end_line ?? 0,
                chunk_type: chunk.chunk_type ?? "code"
            }));

            allChunks = allChunks.concat(validatedChunks);
        } catch (error) {
            console.error(`Error chunking file ${file}:`, error);
            continue;
        }
    }

    chunker.saveChunksToJson(allChunks, ballerinaDir);
    console.timeEnd("Chunking Code");

    return allChunks;
}

async function indexChunks(
    db: SqliteVectorDB,
    chunks: ExtendedChunk[],
    voyageApiKey: string
): Promise<void> {
    if (!chunks?.length) {
        console.warn("No chunks to index");
        return;
    }

    const textsForEmbedding = chunks
        .map(chunk => chunk.content ?? "")
        .filter(text => text.length > 0);

    if (!textsForEmbedding.length) {
        console.warn("No valid text content found for embedding");
        return;
    }

    console.time("Generating Embeddings");
    try {
        const embeddings = await getEmbeddings(textsForEmbedding, voyageApiKey);
        console.timeEnd("Generating Embeddings");

        const chunksWithEmbeddings: ChunkWithEmbedding[] = chunks
            .filter((_, idx) => idx < embeddings.length)
            .map((chunk, idx) => ({
                ...chunk,
                content: chunk.content ?? "",
                file: chunk.file ?? "",
                embedding: embeddings[idx] ?? []
            }));

        await db.insertChunks(chunksWithEmbeddings);

        const stats = db.getStats();
        console.log(`✓ Index stats: ${stats.total_chunks} chunks, ${stats.db_size}`);
    } catch (error) {
        console.error("Error generating embeddings:", error);
        throw error;
    }
}

async function processQueries(
    ballerinaDir: string,
    userQueries: { query: string }[],
    embeddedUserQueries: number[][],
    db: SqliteVectorDB
): Promise<void> {
    console.time("Processing User Queries");

    const relevantChunksDir = 'outputs/sqlite_outputs/relevant_chunks';

    try {
        await fs.mkdir(relevantChunksDir, { recursive: true });

        if (!userQueries?.length) {
            console.warn("No user queries provided");
            return;
        }

        for (let i = 0; i < userQueries.length; i++) {
            const docId = i + 1;
            const userQuery = userQueries[i];
            const queryEmbedding = embeddedUserQueries[i];

            if (!userQuery?.query) {
                console.warn(`User query at index ${i} is undefined or empty.`);
                continue;
            }

            if (!queryEmbedding?.length) {
                console.warn(`No valid embedding found for user query: ${userQuery.query}`);
                continue;
            }

            console.log(`Processing query ${docId}: ${userQuery.query}`);

            const relevantChunks = await db.searchSimilarChunks(queryEmbedding, 0.9);

            console.log(`Found ${relevantChunks.length} relevant chunks for query ${docId}`);

            // Save JSON
            const jsonData = {
                query: userQuery.query,
                relevant_chunks: relevantChunks.map(chunk => ({
                    id: chunk.id,
                    file: chunk.file,
                    score: chunk.score.toFixed(4),
                    content: chunk.content
                }))
            };

            const jsonPath = path.join(relevantChunksDir, `${docId}.json`);
            await fs.writeFile(jsonPath, JSON.stringify(jsonData, null, 2));

            // Save Markdown
            const mdContent = relevantChunks.reduce((md, chunk, idx) => {
                return md + `### Chunk ${idx + 1} (Score: ${chunk.score.toFixed(4)})\n\`\`\`ballerina\n${(chunk.content ?? "").trim()}\n\`\`\`\n\n`;
            }, `# User Query ${docId}\n\n**Query:** ${userQuery.query}\n\n## Relevant Chunks\n\n`);

            const mdPath = path.join(relevantChunksDir, `${docId}.md`);
            await fs.writeFile(mdPath, mdContent);
        }
    } catch (error) {
        console.error("Error processing queries:", error);
        throw error;
    } finally {
        console.timeEnd("Processing User Queries");
    }
}

export async function sqlitePipeline(
    ballerinaDir: string,
    voyageApiKey: string
): Promise<void> {
    console.time("SQLite Pipeline Total Time");

    const db = new SqliteVectorDB('./vector_database.db');

    try {
        if (!ballerinaDir || !voyageApiKey) {
            throw new Error("ballerinaDir and voyageApiKey are required");
        }

        console.log("Step 1: Loading and chunking files...");
        const allChunks = await loadAndChunkFiles(ballerinaDir, new BallerinaChunker());

        if (!allChunks.length) {
            throw new Error("No chunks found in the Ballerina directory");
        }

        console.log("Step 2: Indexing chunks with embeddings...");
        await indexChunks(db, allChunks, voyageApiKey);

        console.log("Step 3: Processing user queries...");
        const userQueries = await GetUserQuery();

        if (!userQueries?.length) {
            console.warn("No user queries found");
        } else {
            const userQueryTexts = userQueries.map(q => q.query ?? "");
            const embeddedUserQueries = await getEmbeddings(userQueryTexts, voyageApiKey);
            await processQueries(ballerinaDir, userQueries, embeddedUserQueries, db);
        }

        console.timeEnd("SQLite Pipeline Total Time");
    } catch (error) {
        console.error("Pipeline error:", error);
        throw error;
    } finally {
        db.close();
    }
}

export { SqliteVectorDB };
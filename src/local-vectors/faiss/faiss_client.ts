import type { Chunk, RelevantChunk } from "./types";

// FAISS Service Configuration
const FAISS_SERVICE_URL = process.env.FAISS_SERVICE_URL || "http://localhost:5001";

/**
 * FAISS Client
 */
export class FaissClient {
    private baseUrl: string;

    constructor(baseUrl: string = FAISS_SERVICE_URL) {
        this.baseUrl = baseUrl;
    }

    /**
     * Health check
     */
    async healthCheck(): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            const data = await response.json() as { status?: string };
            return data.status === "healthy";
        } catch (error) {
            console.error("FAISS service health check failed:", error);
            return false;
        }
    }

    /**
     * Get statistics about the index
     */
    async getStats() {
        const response = await fetch(`${this.baseUrl}/stats`);
        const data = await response.json() as { success?: boolean; error?: string };

        if (!data.success) {
            throw new Error(`Failed to get stats: ${data.error}`);
        }

        return data;
    }

    /**
     * Clear the index
     */
    async clear() {
        const response = await fetch(`${this.baseUrl}/clear`, {
            method: "POST",
            headers: { "Content-Type": "application/json" }
        });

        const data = await response.json() as { success?: boolean; error?: string };

        if (!data.success) {
            throw new Error(`Failed to clear index: ${data.error}`);
        }

        return data;
    }
}

/**
 * Create FAISS client
 */
export function createFaissClient(): FaissClient {
    const client = new FaissClient();
    console.log(`FAISS client initialized (${FAISS_SERVICE_URL})`);
    return client;
}

/**
 * Create collection
 */
export async function createCollection(client: FaissClient, dimension: number = 1024): Promise<void> {
    const response = await fetch(`${client['baseUrl']}/create_collection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dimension })
    });

    const data = await response.json() as { success?: boolean; error?: string; message?: string };

    if (!data.success) {
        throw new Error(`Failed to create collection: ${data.error}`);
    }

    console.log(data.message);
}

/**
 * Upsert chunks to FAISS
 */
export async function upsertChunks(
    client: FaissClient,
    chunks: Chunk[],
    embeddings: number[][],
    textsForEmbedding: string[]
): Promise<void> {
    if (chunks.length !== embeddings.length || chunks.length !== textsForEmbedding.length) {
        throw new Error("Chunks, embeddings, and texts must have the same length");
    }

    // Prepare chunks data
    const chunksData = chunks.map(chunk => ({
        content: chunk.content,
        metadata: chunk.metadata
    }));

    const response = await fetch(`${client['baseUrl']}/upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            chunks: chunksData,
            embeddings: embeddings,
            texts: textsForEmbedding
        })
    });

    const data = await response.json() as { success?: boolean; error?: string; message?: string };

    if (!data.success) {
        throw new Error(`Failed to upsert chunks: ${data.error}`);
    }

    console.log(data.message);
}

/**
 * Search for relevant chunks (replaces searchRelevantChunks)
 */
export async function searchRelevantChunks(
    client: FaissClient,
    queryEmbedding: number[],
    threshold: number = parseFloat(process.env.THRESHOLD as string)
): Promise<RelevantChunk[]> {
    const response = await fetch(`${client['baseUrl']}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            query_embedding: queryEmbedding
        })
    });

    const data = await response.json() as {
        success?: boolean;
        error?: string;
        results?: RelevantChunk[];
    };

    if (!data.success) {
        throw new Error(`Failed to search chunks: ${data.error}`);
    }

    // Filter chunks by threshold
    const filteredChunks = (data.results || []).filter(chunk => (chunk.score ?? 0) >= threshold);

    console.log('[Threshold Value] - ', threshold)
    console.log(`Threshold filtering: [${filteredChunks.length}] chunks selected (threshold: ${threshold})`);

    return filteredChunks;
}


/**
 * Get index statistics
 */
export async function getIndexStats(client: FaissClient) {
    return await client.getStats();
}

/**
 * Clear all vectors from index
 */
export async function clearIndex(client: FaissClient) {
    return await client.clear();
}
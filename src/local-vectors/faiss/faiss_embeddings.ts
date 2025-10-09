import type { VoyageEmbeddingResponse } from "./types";
import * as fs from 'fs';

export async function getEmbeddings(
    texts: string[],
    voyageApiKey: string): Promise<number[][]> {

    const response = await fetch("https://api.voyageai.com/v1/embeddings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${voyageApiKey}`,
        },
        body: JSON.stringify({
            input: texts,
            model: "voyage-code-3"
        }),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`VoyageAI API error: ${response.status} ${response.statusText} - ${errorText}`);
    }
    const rawData = await response.json();
    const dir = 'outputs/faiss_outputs/codebase_embedding';
    fs.mkdirSync(dir, { recursive: true })

    fs.writeFileSync(`${dir}/embedding_response.json`, JSON.stringify(rawData, null, 2), 'utf8');

    if (!isVoyageEmbeddingResponse(rawData)) {
        throw new Error("Invalid response format from VoyageAI API");
    }

    const data: VoyageEmbeddingResponse = rawData;
    const embeddings = data.data.map(item => item.embedding);
    return embeddings;
}

function isVoyageEmbeddingResponse(data: unknown): data is VoyageEmbeddingResponse {
    return (
        typeof data === "object" &&
        data !== null &&
        (data as any).object === "list" &&
        Array.isArray((data as any).data) &&
        (data as any).data.every(
            (item: any) =>
                item.object === "embedding" &&
                typeof item.index === "number" &&
                Array.isArray(item.embedding) &&
                item.embedding.every((v: any) => typeof v === "number")
        ) &&
        typeof (data as any).model === "string" &&
        typeof (data as any).usage?.total_tokens === "number"
    );
}

import { Pinecone } from '@pinecone-database/pinecone';
import type { Chunk } from "./types";

const INDEX_NAME = "ballerina-code-chunks";

// Create a Pinecone client
export function createPineconeClient(apiKey: string) {
  return new Pinecone({
    apiKey: apiKey,
  });
}

// Ensure index exists
export async function createCollection(pineconeClient: Pinecone): Promise<void> {
  try {
    const indexList = await pineconeClient.listIndexes();
    const indexExists = indexList.indexes?.some(
      (index) => index.name === INDEX_NAME
    );

    if (!indexExists) {
      await pineconeClient.createIndex({
        name: INDEX_NAME,
        dimension: 1024,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      console.log(`Created index: ${INDEX_NAME}`);

      // Wait for index to be ready
      await new Promise(resolve => setTimeout(resolve, 60000));
    } else {
      console.log(`Index ${INDEX_NAME} already exists`);
    }
  } catch (error) {
    console.error('Error creating collection:', error);
    throw error;
  }
}

// Upsert code chunks into Pinecone
export async function upsertChunks(
  pineconeClient: Pinecone,
  chunks: Chunk[],
  embeddings: number[][],
  textsForEmbedding: string[],
  startIndex: number = 0
): Promise<void> {
  if (chunks.length !== embeddings.length) {
    throw new Error("Chunks and embeddings arrays must be the same length");
  }

  const index = pineconeClient.index(INDEX_NAME);

  // Prepare records for Pinecone
  const records = chunks
    .map((chunk, idx) => {
      const vector = embeddings[idx];
      if (!vector) return null;

      return {
        id: `chunk-${startIndex + idx}`,
        values: vector,
        metadata: {
          content: chunk.content,
          line: chunk.metadata.line,
          endLine: chunk.metadata.endLine,
          moduleName: chunk.metadata.moduleName ?? "",
          file: chunk.metadata.file,
          chunkId: chunk.metadata.id,
          hash: chunk.metadata.hash,
          type: (chunk.metadata as any).type,
          textForEmbedding: textsForEmbedding[idx] ?? "",
        },
      };
    })
    .filter((record): record is NonNullable<typeof record> => record !== null);

  // Pinecone recommends batching upserts (max 100 vectors per request)
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await index.upsert(batch);
    console.log(`Upserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(records.length / batchSize)}`);
  }
}

// Get index stats
export async function getCollection(
  pineconeClient: Pinecone,
  indexName: string = INDEX_NAME
) {
  try {
    const index = pineconeClient.index(indexName);
    const stats = await index.describeIndexStats();
    return stats;
  } catch (error) {
    console.error(`Error getting index "${indexName}":`, error);
    return null;
  }
}

// Function to search Pinecone with top-p (nucleus sampling)
export async function searchRelevantChunks(
  pineconeClient: Pinecone,
  queryEmbedding: number[],
  topP: number = 0.75,
  indexName: string = INDEX_NAME,
  maxResults: number = 100
): Promise<{ score: number; payload: { [key: string]: any; type: string; name: string | null; file: string; line: number; endLine: number; position: { start: { line: number; column: number; }; end: { line: number; column: number; }; }; id: string; hash: string; moduleName?: string; content: string } }[]> {
  const index = pineconeClient.index(indexName);

  // First, get more results than we might need
  const searchResult = await index.query({
    vector: queryEmbedding,
    topK: maxResults,
    includeMetadata: true,
  });

  // Map and sort results by score (descending)
  const allResults = (searchResult.matches?.map((match) => {
    if (!match.metadata) return null;

    return {
      score: match.score ?? 0,
      payload: {
        content: (match.metadata.content as string) ?? "",
        type: ((match.metadata as any).type as string) ?? "",
        name: ((match.metadata as any).name as string | null) ?? null,
        file: (match.metadata.file as string) ?? "",
        line: (match.metadata.line as number) ?? 0,
        endLine: (match.metadata.endLine as number) ?? 0,
        position: ((match.metadata as any).position) ?? { start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
        id: (match.metadata.chunkId as string) ?? "",
        hash: (match.metadata.hash as string) ?? "",
        moduleName: (match.metadata.moduleName as string | undefined),
      },
    };
  }).filter((result): result is NonNullable<typeof result> => result !== null) || []).sort((a, b) => b.score - a.score);

  if (allResults.length === 0) {
    return [];
  }

  // Normalize scores to probabilities (softmax)
  const maxScore = allResults[0]!.score;
  const expScores = allResults.map(r => Math.exp(r.score - maxScore));
  const sumExpScores = expScores.reduce((sum, val) => sum + val, 0);
  const probabilities = expScores.map(exp => exp / sumExpScores);

  // Apply top-p filtering
  let cumulativeProb = 0;
  const selectedResults = [];

  for (let i = 0; i < allResults.length; i++) {
    const prob = probabilities[i];
    if (prob !== undefined) {
      cumulativeProb += prob;
      selectedResults.push(allResults[i]!);

      if (cumulativeProb >= topP) {
        break;
      }
    }
  }

  console.log(`Top-p (${topP}) selected ${selectedResults.length} chunks from ${allResults.length} total results`);

  return selectedResults;
}

// Optional: Delete index (for cleanup)
export async function deleteCollection(
  pineconeClient: Pinecone,
  indexName: string = INDEX_NAME
): Promise<void> {
  try {
    await pineconeClient.deleteIndex(indexName);
    console.log(`Deleted index: ${indexName}`);
  } catch (error) {
    console.error(`Error deleting index "${indexName}":`, error);
  }
}
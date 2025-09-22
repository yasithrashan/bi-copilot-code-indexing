import type { Chunk } from "./types";
import { loadFiles, readFiles } from "../file_extraction";
import { getEmbeddings } from "./embeddings";
import { BallerinaChunker } from "./chunker";
import { createQdrantClient, createCollection, upsertChunks, searchRelevantChunks } from "./qdrant";
import { chunkUserQuery } from "./queries";
import fs from 'fs/promises';
import { expandCode } from "./code-generation/code_expand";
import path from "path";
import { processCodeGenerationForQuery } from "./code-generation/code";

export async function ragPipeline(
    ballerinaDir: string,
    voyageApiKey: string,
    qdrantUrl: string = "http://localhost:6333"
): Promise<void> {
    const chunker = new BallerinaChunker();
    const qdrantClient = createQdrantClient(qdrantUrl);

    console.log("Loading Ballerina files...");
    const ballerinaFiles = loadFiles(ballerinaDir);

    console.log("Chunking code...");
    let allChunks: Chunk[] = [];
    for (const file of ballerinaFiles) {
        const code = readFiles(file);
        allChunks = allChunks.concat(chunker.chunkBallerinaCode(code, file));
    }

    console.log(`Generated ${allChunks.length} chunks`);

    // Save chunks to JSON file in tests folder
    chunker.saveChunksToJson(allChunks, ballerinaDir);

    // Create Qdrant collection
    await createCollection(qdrantClient);

    // Prepare texts for embeddings
    const textsForEmbedding = allChunks.map((chunk) => chunk.content);

    // Generate embeddings
    console.log("Generating embeddings with VoyageAI...");
    const embeddings = await getEmbeddings(textsForEmbedding, voyageApiKey);

    // Upserting chunks
    console.log("Upserting chunks into Qdrant...");
    await upsertChunks(qdrantClient, allChunks, embeddings, textsForEmbedding);

    console.log("All the chunks indexed successfully!");

    // Chunk the user query
    const userQueries = await chunkUserQuery();

    // Embedding the user query
    const userQueryTexts = userQueries.map(q => q.query);
    const embededUserQuery = await getEmbeddings(userQueryTexts, voyageApiKey);

    console.log(embededUserQuery.length);

    const dirPath = 'rag_outputs/relevant_chunks';
    await fs.mkdir(dirPath, { recursive: true });

    // Return relevant chunks for every user query
    const allRelevantChunks: any[][] = [];
    for (let i = 0; i < userQueries.length; i++) {
        const docId = i + 1;
        const queryEmbedding = embededUserQuery[i];
        const userQuery = userQueries[i];

        if (queryEmbedding && userQuery) {
            const relevantChunks = await searchRelevantChunks(qdrantClient, queryEmbedding);

            console.log(`\nUser Query: ${userQuery.query}`);

            // Json content
            const dataToSaveJson = {
                query: userQuery.query,
                relevant_chunks: relevantChunks.map((chunk) => ({
                    score: chunk.score,
                    payload: chunk.payload
                }))
            };

            // Excel content
            const dataToSaveExcel = relevantChunks.map((chunk) => chunk.payload.content);

            // Markdown content
            let mdContent = `# User Query ${docId}\n\n`;
            mdContent += `**Query:** ${userQuery.query}\n\n`;
            mdContent += `## Relevant Chunks\n\n`;
            relevantChunks.forEach((chunk, idx) => {
                mdContent += `### Chunk ${idx + 1}\n`;
                mdContent += "```ballerina\n";
                mdContent += chunk.payload.content.trim() + "\n";
                mdContent += "```\n\n";
            });

            // Save JSON
            const jsonPath = `${dirPath}/${docId}.json`;
            await fs.writeFile(jsonPath, JSON.stringify(dataToSaveJson, null, 2));

            // Save Markdown
            const mdPath = `${dirPath}/${docId}.md`;
            await fs.writeFile(mdPath, mdContent);

            // Collect for Excel
            allRelevantChunks.push(dataToSaveExcel);

            console.log(`Saved relevant chunks to ${jsonPath} and ${mdPath}`);

            const projectPath = ballerinaDir;
            const outputDir = path.join('rag_outputs', 'expand_code');
            await expandCode({ chunksFilePath: jsonPath, projectPath, outputDir, docId });
            console.log(`Code expansion completed for query ${docId}`);
            await processCodeGenerationForQuery(docId, userQuery.query);
            console.log(`Code generation completed for query ${docId}`);

        } else if (userQuery) {
            console.warn(`No embedding found for user query: ${userQuery.query}`);
            allRelevantChunks.push([]);
        } else {
            console.warn(`User query at index ${i} is undefined.`);
            allRelevantChunks.push([]);
        }
    }
    console.log("RAG pipeline completed!");
}

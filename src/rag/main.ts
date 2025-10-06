import type { Chunk } from "./types";
import { loadFiles, readFiles } from "../file_extraction";
import { getEmbeddings } from "./embeddings";
import { BallerinaChunker } from "./chunker";
import { createPineconeClient, createCollection, upsertChunks, searchRelevantChunks } from "./vector_db";
import { chunkUserQuery } from "./queries";
import fs from 'fs/promises';
import { expandCode } from "./code-generation/code_expand";
import path from "path";
import { processCodeGenerationForQuery } from "./code-generation/code";
import { evaluateCodeQuality } from "./code-generation/code_quality";

export async function ragPipeline(
    ballerinaDir: string,
    voyageApiKey: string,
    pineconeApiKey: string
): Promise<void> {
    console.time("RAG Pipeline Total Time");

    const chunker = new BallerinaChunker();
    const pineconeClient = createPineconeClient(pineconeApiKey);

    console.time("Loading Files");
    console.log("Loading Ballerina files...");
    const ballerinaFiles = loadFiles(ballerinaDir);
    console.timeEnd("Loading Files");

    console.time("Chunking Code");
    console.log("Chunking code...");
    let allChunks: Chunk[] = [];
    for (const file of ballerinaFiles) {
        const code = readFiles(file);
        allChunks = allChunks.concat(chunker.chunkBallerinaCode(code, file));
    }
    console.log(`Generated ${allChunks.length} chunks`);
    chunker.saveChunksToJson(allChunks, ballerinaDir);
    console.timeEnd("Chunking Code");

    console.time("Creating Pinecone Collection");
    await createCollection(pineconeClient);
    console.timeEnd("Creating Pinecone Collection");

    const textsForEmbedding = allChunks.map((chunk) => chunk.content);

    console.time("Generating Embeddings");
    console.log("Generating embeddings with VoyageAI...");
    const embeddings = await getEmbeddings(textsForEmbedding, voyageApiKey);
    console.timeEnd("Generating Embeddings");

    console.time("Upserting Chunks");
    console.log("Upserting chunks into Pinecone...");
    await upsertChunks(pineconeClient, allChunks, embeddings, textsForEmbedding);
    console.log("All the chunks indexed successfully!");
    console.timeEnd("Upserting Chunks");

    console.time("Processing User Queries");
    const userQueries = await chunkUserQuery();
    const userQueryTexts = userQueries.map(q => q.query);
    const embededUserQuery = await getEmbeddings(userQueryTexts, voyageApiKey);

    const dirPath = 'rag_outputs/relevant_chunks';
    await fs.mkdir(dirPath, { recursive: true });

    const allRelevantChunks: any[][] = [];
    for (let i = 0; i < userQueries.length; i++) {
        const docId = i + 1;
        const queryEmbedding = embededUserQuery[i];
        const userQuery = userQueries[i];

        console.time(`Query ${docId} Processing Time`);
        if (queryEmbedding && userQuery) {
            const relevantChunks = await searchRelevantChunks(pineconeClient, queryEmbedding);

            console.log(`\nUser Query: ${userQuery.query}`);

            const dataToSaveJson = {
                query: userQuery.query,
                relevant_chunks: relevantChunks.map((chunk) => ({
                    score: chunk.score,
                    payload: chunk.payload
                }))
            };

            const dataToSaveExcel = relevantChunks.map((chunk) => chunk.payload.content);

            let mdContent = `# User Query ${docId}\n\n`;
            mdContent += `**Query:** ${userQuery.query}\n\n`;
            mdContent += `## Relevant Chunks\n\n`;
            relevantChunks.forEach((chunk, idx) => {
                mdContent += `### Chunk ${idx + 1}\n`;
                mdContent += "```ballerina\n";
                mdContent += chunk.payload.content.trim() + "\n";
                mdContent += "```\n\n";
            });

            const jsonPath = `${dirPath}/${docId}.json`;
            await fs.writeFile(jsonPath, JSON.stringify(dataToSaveJson, null, 2));

            const mdPath = `${dirPath}/${docId}.md`;
            await fs.writeFile(mdPath, mdContent);

            allRelevantChunks.push(dataToSaveExcel);

            console.log(`Saved relevant chunks to ${jsonPath} and ${mdPath}`);

            const projectPath = ballerinaDir;
            const outputDir = path.join('rag_outputs', 'expand_code');
            await expandCode({ chunksFilePath: jsonPath, projectPath, outputDir, docId });
            console.log(`Code expansion completed for query ${docId}`);
            await processCodeGenerationForQuery(docId, userQuery.query);
            console.log(`Code generation completed for query ${docId}`);
            await evaluateCodeQuality({
                chunksFilePath: jsonPath,
                expandedCodeFilePath: path.join('rag_outputs', 'expand_code', `${docId}.md`),
                projectPath: ballerinaDir,
                outputDir: path.join('rag_outputs', 'code_quality_results'),
                docId
            });
            console.log(`Code quality evaluation completed for query ${docId}`);
        } else if (userQuery) {
            console.warn(`No embedding found for user query: ${userQuery.query}`);
            allRelevantChunks.push([]);
        } else {
            console.warn(`User query at index ${i} is undefined.`);
            allRelevantChunks.push([]);
        }
        console.timeEnd(`Query ${docId} Processing Time`);
    }
    console.timeEnd("Processing User Queries");
    console.timeEnd("RAG Pipeline Total Time");
}

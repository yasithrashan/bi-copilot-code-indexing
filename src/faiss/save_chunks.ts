import { loadBallerinaFiles, readFileContents } from "./file_extractor";
import { codeSplitter } from "./split_code";

// Main entry
async function main() {
    // CHANGE THIS PATH to your ballerina project directory
    //   const ballerinaDir = "/Users/yasithrashan/Documents/workspace/wso2/module-ballerinax-financial.swiftmt-to-iso20022";
    const ballerinaDir = "/Users/yasithrashan/Documents/workspace/wso2/bi-copilot-code-indexing/ballerina";

    console.log("Starting Ballerina Code Processing...");

    try {
        // Step 1: Load all .bal files
        const balFiles = await loadBallerinaFiles(ballerinaDir);
        console.log(`Found ${balFiles.length} .bal files`);

        // Step 2: Read file contents
        const fileData = await readFileContents(balFiles);

        // Step 3: Initialize chunker
        const splitter = new codeSplitter();
        let allChunks: any[] = [];

        // Step 4: Process each file
        for (const { filePath, content } of fileData) {
            const chunks = splitter.chunkBallerinaCode(content, filePath);
            allChunks = allChunks.concat(chunks);
            console.log(`Processed ${filePath}, extracted ${chunks.length} chunks`);
        }

        // Step 5: Save chunks to JSON
        const outputFile = splitter.saveChunksToJson(allChunks, ballerinaDir);

        // Step 6: Show statistics
        const stats = splitter.getChunkStatistics(allChunks);
        console.log("Chunk statistics:", stats);
        console.log(`All chunks saved to: ${outputFile}`);
    } catch (err) {
        console.error("Error while processing:", err);
    }
}

main();

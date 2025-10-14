import fs from "fs";
import path from "path";
import { codeSplitter } from "./split_code";
import { loadFiles, readFiles } from "../../shared/file_extraction";
import { GetUserQuery } from "../../shared/queries";
import { bm25Search } from "./search_algorithm";
import { codeExpander } from "./code_generation/code_expand";
import { processAllQueries } from "./code_generation/code";
import { evaluateKeywordSearchQuality } from "./code_generation/code_quality";
import type { KeywordChunk } from "./code_generation/code_quality";

const FILE_PATH = "./ballerina";
const SPLIT_CODE_FILE_PATH = "./outputs/keyword_search_outputs/source_code_split.json";

const ROOT_DIR = process.cwd();
const OUTPUT_DIRS = {
    json: path.join(ROOT_DIR, "outputs/keyword_search_outputs/relevant_chunks"),
    md: path.join(ROOT_DIR, "outputs/keyword_search_outputs/relevant_chunks"),
    quality: path.join(ROOT_DIR, "outputs/keyword_search_outputs/quality_evaluation"),
    timing: path.join(ROOT_DIR, "outputs/keyword_search_outputs/time_consuming"),
};

// Ensure required output directories exist
for (const dir of Object.values(OUTPUT_DIRS)) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function logStep(message: string) {
    console.log(`[INFO] ${message}`);
}

export async function keywordSearch() {
    try {
        console.time("Keyword Search Pipeline Total Time");

        logStep("Loading Ballerina source files...");
        console.time("Loading Files");
        const files = loadFiles(FILE_PATH);
        console.timeEnd("Loading Files");

        // Read each file content using your existing readFiles function
        const fileData = files.map((filePath) => ({
            filePath,
            content: readFiles(filePath),
        }));
        logStep(`Loaded ${files.length} files.`);

        logStep("Splitting code into chunks...");
        console.time("Chunking Code");
        const splitter = new codeSplitter();
        const allChunks = fileData.flatMap((file) =>
            splitter.chunkBallerinaCode(file.content, file.filePath)
        );
        splitter.saveChunksToJson(allChunks, FILE_PATH);
        console.timeEnd("Chunking Code");
        logStep(`Code splitting completed. Total chunks: ${allChunks.length}`);

        logStep("Getting user queries...");
        const queries = await GetUserQuery();
        logStep(`Loaded ${queries.length} queries.`);

        logStep("Running BM25 keyword search for all queries...");
        console.time("Processing User Queries");

        for (const { id, query } of queries) {
            logStep(`Processing query ${id}: ${query}`);

            // Time the keyword search
            const searchStartTime = performance.now();
            const keywordResults = await bm25Search(SPLIT_CODE_FILE_PATH, query);
            const searchEndTime = performance.now();
            const searchTime = searchEndTime - searchStartTime;

            logStep(`Found ${keywordResults.length} relevant chunks for query ${id}`);
            logStep(`Search time: ${searchTime.toFixed(2)}ms`);

            // Save JSON result
            const jsonFilePath = path.join(OUTPUT_DIRS.json, `${id}.json`);
            fs.writeFileSync(
                jsonFilePath,
                JSON.stringify(keywordResults, null, 2),
                "utf8"
            );

            // Build Markdown summary
            const mdFilePath = path.join(OUTPUT_DIRS.md, `${id}.md`);
            const mdContent = [
                `## Query ID: ${id}`,
                `**Query:** ${query}\n`,
                `**Search Time:** ${searchTime.toFixed(2)}ms\n`,
                `**Results:**\n`,
                ...keywordResults.map(
                    (res, index) =>
                        `### Chunk ${String(index + 1).padStart(2, "0")}\n` +
                        `**Score:** ${res.score.toFixed(4)}\n` +
                        `**ID:** ${res.id}\n\n` +
                        "```ballerina\n" +
                        `${res.content}\n` +
                        "```\n"
                ),
            ].join("\n");

            fs.writeFileSync(mdFilePath, mdContent, "utf8");

            // Save timing information to time_consuming directory
            const timingJsonData = {
                query_id: id,
                query: query,
                search_time_ms: parseFloat(searchTime.toFixed(2)),
                num_chunks_retrieved: keywordResults.length
            };
            const timingJsonPath = path.join(OUTPUT_DIRS.timing, `${id}.json`);
            fs.writeFileSync(timingJsonPath, JSON.stringify(timingJsonData, null, 2), "utf8");

            // Save timing markdown
            const timingMdContent = `# Query ${id} - Timing Report

**Query:** ${query}

## Performance Metrics

| Metric | Time |
|--------|------|
| Search Time | ${searchTime.toFixed(2)}ms |
| Chunks Retrieved | ${keywordResults.length} |

## Details

- **Search Time**: Time taken to execute BM25 keyword search and retrieve relevant chunks
- **Chunks Retrieved**: Number of code chunks returned from the search
`;
            const timingMdPath = path.join(OUTPUT_DIRS.timing, `${id}.md`);
            fs.writeFileSync(timingMdPath, timingMdContent, "utf8");

            logStep(`Saved search results and timing for Query ${id}.`);
        }

        console.timeEnd("Processing User Queries");

        // Quality evaluation step
        logStep("Running chunk quality evaluation...");
        console.time("Quality Evaluation");

        for (const { id, query } of queries) {
            try {
                // Read the saved keyword search results
                const jsonFilePath = path.join(OUTPUT_DIRS.json, `${id}.json`);
                const keywordResults = JSON.parse(fs.readFileSync(jsonFilePath, "utf8"));

                // Transform keyword results to KeywordChunk format
                const chunks: KeywordChunk[] = keywordResults.map((result: any) => ({
                    file: result.file || "unknown",
                    type: result.type || "unknown",
                    name: result.name || "unknown",
                    line: result.line || 0,
                    endLine: result.endLine || 0,
                    content: result.content || ""
                }));

                // Run quality evaluation
                await evaluateKeywordSearchQuality({
                    userQuery: query,
                    chunks: chunks,
                    projectPath: FILE_PATH,
                    outputDir: OUTPUT_DIRS.quality,
                    queryId: id
                });

                logStep(`Quality evaluation completed for Query ${id}.`);
            } catch (error) {
                console.error(`[ERROR] Quality evaluation failed for Query ${id}:`, error);
            }
        }

        console.timeEnd("Quality Evaluation");

        // logStep("Running code expansion step...");
        // await codeExpander(queries);

        // logStep("Running code generation step...");
        // await processAllQueries(queries);

        console.timeEnd("Keyword Search Pipeline Total Time");
        logStep("Keyword search workflow completed successfully.");
    } catch (error) {
        console.error("[ERROR] Keyword search workflow failed:", error);
    }
}
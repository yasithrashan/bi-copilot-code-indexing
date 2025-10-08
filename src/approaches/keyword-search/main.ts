import fs from "fs";
import path from "path";
import { codeSplitter } from "./split_code";
import { loadFiles, readFiles } from "../../shared/file_extraction";
import { GetUserQuery } from "../../shared/queries";
import { bm25Search } from "./search_algorithm";
import { codeExpander } from "./code_generation/code_expand";
import { processAllQueries } from "./code_generation/code";
import { codeQualityEvaluator } from "./code_generation/code_quality"

const FILE_PATH = "./ballerina";
const SPLIT_CODE_FILE_PATH = "./outputs/keyword_search_outputs/source_code_split.json";

const ROOT_DIR = process.cwd();
const OUTPUT_DIRS = {
    json: path.join(ROOT_DIR, "outputs/keyword_search_outputs/keyword_search_result"),
    md: path.join(ROOT_DIR, "outputs/keyword_search_outputs/keyword_search_result_md"),
    quality: path.join(ROOT_DIR, "outputs/keyword_search_outputs/quality_evaluation"),
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
        logStep("Loading Ballerina source files...");
        const files = loadFiles(FILE_PATH);

        // Read each file content using your existing readFiles function
        const fileData = files.map((filePath) => ({
            filePath,
            content: readFiles(filePath),
        }));
        logStep(`Loaded ${files.length} files.`);

        logStep("Splitting code into chunks...");
        const splitter = new codeSplitter();
        const allChunks = fileData.flatMap((file) =>
            splitter.chunkBallerinaCode(file.content, file.filePath)
        );
        splitter.saveChunksToJson(allChunks, FILE_PATH);
        logStep(`Code splitting completed. Total chunks: ${allChunks.length}`);

        logStep("Getting user queries...");
        const queries = await GetUserQuery();
        logStep(`Loaded ${queries.length} queries.`);

        logStep("Running BM25 keyword search for all queries...");
        for (const { id, query } of queries) {
            const keywordResults = await bm25Search(SPLIT_CODE_FILE_PATH, query);

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

            logStep(`Saved search results for Query ${id}.`);
        }

        // Add quality evaluation step here (after search, before expansion)
        logStep("Running chunk quality evaluation...");
        await codeQualityEvaluator(queries);

        logStep("Running code expansion step...");
        await codeExpander(queries);

        logStep("Running code generation step...");
        await processAllQueries(queries);

        logStep("Keyword search workflow completed successfully.");
    } catch (error) {
        console.error("[ERROR] Keyword search workflow failed:", error);
    }
}
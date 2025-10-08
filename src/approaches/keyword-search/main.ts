import { codeSplitter } from "./split_code";
import { loadBallerinaFiles, readFileContents } from "./file_extractor";
import { dataExtarctFromExcelSheet } from "../excel";
import fs from 'fs';
import path from 'path';
import { bm25Search } from "./search_algorithm";
import { codeExpander } from "./code_generation/code_expand"
import { processAllQueries } from "./code_generation/code";
import { batchEvaluateKeywordSearchQuality } from "./code_generation/relevant_chunks_code_quality";

const filePath = "./ballerina";
const splitCodeFilePath = './keyword_search_outputs/source_code_split.json'

// Use process.cwd() to get the root directory of your project
const rootDir = process.cwd();
const dir = path.join(rootDir, 'keyword_search_outputs/keyword_search_result');
const mdDir = path.join(rootDir, 'keyword_search_outputs/keyword_search_result_md');

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

if (!fs.existsSync(mdDir)) {
    fs.mkdirSync(mdDir, { recursive: true });
}

export async function keywordSearch() {
    const files = await loadBallerinaFiles(filePath);
    const fileData = await readFileContents(files);

    const splitter = new codeSplitter();
    let allChunks: any[] = [];

    for (const file of fileData) {
        const chunks = splitter.chunkBallerinaCode(file.content, file.filePath);
        allChunks = allChunks.concat(chunks);
    }

    const outputPath = splitter.saveChunksToJson(allChunks, filePath);

    // Extract queries from Excel sheet
    const queries = await dataExtarctFromExcelSheet();

    // Call the BM25 search algorithm for every user query
    for (const q of queries) {
        console.log(`ID: ${q.id}, Query: ${q.query}`);
        const userQuery = q.query;

        const keywordSearchResult = await bm25Search(splitCodeFilePath, userQuery);

        // Save JSON file in root/keyword-search-outputs/keyword_search_result/
        const jsonFilePath = path.join(dir, `${q.id}.json`);
        fs.writeFileSync(jsonFilePath, JSON.stringify(keywordSearchResult, null, 2), 'utf8');

        // Save MD file in root/keyword-search-outputs/keyword_search_result_md/
        const mdFilePath = path.join(mdDir, `${q.id}.md`);

        // Build readable Markdown content (numbered chunks)
        let mdContent = `## Query ID: ${q.id}\n`;
        mdContent += `**Query:** ${userQuery}\n\n`;
        mdContent += `**Results:**\n\n`;

        keywordSearchResult.forEach((res, index) => {
            const chunkNumber = String(index + 1).padStart(2, '0');
            mdContent += `### Chunk ${chunkNumber}\n`;
            mdContent += `**Score:** ${res.score.toFixed(4)}\n`;
            mdContent += `**ID:** ${res.id}\n\n`;
            mdContent += `\`\`\`ballerina\n${res.content}\n\`\`\`\n\n`;
        });

        fs.writeFileSync(mdFilePath, mdContent, 'utf8');

        console.log(`Results saved for query ${q.id}:`);
        console.log(`  - JSON: ${jsonFilePath}`);
        console.log(`  - MD: ${mdFilePath}`);
    }

    console.log('\n=== Starting Keyword Search Chunk Quality Evaluation ===');
    await batchEvaluateKeywordSearchQuality(
        dir,        // path to JSON keyword search results
        filePath,   // ballerina project directory
        path.join(rootDir, "keyword_search_outputs/relevant_chunk_quality") // output dir
    );

    // After processing all queries, run code expansion
    console.log('\n=== Starting Code Expansion ===');
    await codeExpander(queries);

    // After code expansion, run code generation
    console.log('\n=== Starting Code Generation ===');
    await processAllQueries(queries);

    console.log('\n=== All workflows completed successfully! ===');
}
import { generateText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import path from "path";
import { z } from "zod";
import { dataExtarctFromExcelSheet } from "../../shared/excel";

// Load project path
const projectPath = 'ballerina'

// Load bal.md path (but don't read it yet!)
const balMdPath = 'outputs/agentic_outputs/bal.md'

// Tool definition
const createExtractRelevantContentTool = (queryId: number) => tool({
    description: "Extracts relevant content from .bal files and formats as structured markdown report.",
    inputSchema: z.object({
        extractedContent: z.string().describe("The main extracted content from .bal files"),
        searchCriteria: z.string().describe("Summary of what was searched for"),
    }),
    execute: async (result) => {
        // Get file count
        const balFiles = fs.readdirSync(projectPath as string).filter(f => f.endsWith(".bal"));
        const fileCount = balFiles.length;

        // Create markdown report
        const reportContent = `# Code Extract Report

**Query ID:** ${queryId}
**Search criteria:** ${result.searchCriteria}
**Files processed:** ${fileCount}

---

${result.extractedContent}`;

        // Save result as md file in expand_code folder
        const outputDir = path.join(process.cwd(), "outputs/agentic_outputs/expand_code");
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

        const outputPath = path.join(outputDir, `${queryId}.md`);
        fs.writeFileSync(outputPath, reportContent, "utf-8");

        return `Extraction completed. Output saved to: ${outputPath}`;
    },
});

// Export the main function to process a single user query
export async function extractRelevantCode(userQuery: string, queryId: number): Promise<string> {
    // Read bal.md content here, when it's actually needed
    if (!fs.existsSync(balMdPath)) {
        throw new Error(`bal.md file not found at ${balMdPath}. Make sure to run generateBalMd() first.`);
    }
    const balMdContent = fs.readFileSync(balMdPath, "utf-8");

    // Get all .bal files
    const balFiles = fs.readdirSync(projectPath as string).filter(f => f.endsWith(".bal"));

    if (balFiles.length === 0) {
        throw new Error("No .bal files found in project path.");
    }

    // Read all .bal file contents
    let allBalContent = "";
    for (const file of balFiles) {
        const fullPath = path.join(projectPath!, file);
        const content = fs.readFileSync(fullPath, "utf-8");
        allBalContent += `### File: ${file}\n\n${content}\n\n`;
    }

    // Single LLM call to extract relevant content
    const systemPrompt = `
    You are a Ballerina Code Analyzer.
    Your task is to process the provided bal.md documentation and the user's query, then extract the most relevant code segments from the .bal files.

    Instructions:

    - Carefully read the user query.
    - Check the bal.md documentation to understand which files and symbols are related.
    - Extract only the directly relevant code segments (e.g., types, functions, services, resources) that are connected to the query.
    - Rule: Only Include Filename and the code segment only.
    - If there is no existing code that matches, return a clear statement such as:
        "No relevant code segments found for this query."
    - If there is related code (even if not an exact match), provide it for context.
    - Present the extracted content in a clear, organized format, grouped by file.
    - Only provide the original code. Do not suggest replacements or modifications.

bal.md Documentation:
${balMdContent}
`;

    const userPrompt = `
User Query: ${userQuery}

Ballerina Files Content:
${allBalContent}

Please extract the relevant code segments that relate to the user query.
`;

    try {
        const extractRelevantContentTool = createExtractRelevantContentTool(queryId);

        const { toolResults } = await generateText({
            model: anthropic('claude-3-5-sonnet-latest'),
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            tools: { extractRelevantContentTool },
            toolChoice: "required",
            maxOutputTokens: 4096,
        });

        console.log(`Extraction process completed successfully for Query ID ${queryId}: "${userQuery}"`);
        return toolResults[0]?.output as string || "No result returned";

    } catch (err) {
        console.error(`[ERROR] Failed to extract content for Query ID ${queryId} "${userQuery}":`, err);
        throw err;
    }
}

// Function to process all queries from Excel sheet
export async function processAllQueries(): Promise<void> {
    try {
        // Check if bal.md exists before processing
        if (!fs.existsSync(balMdPath)) {
            throw new Error(`bal.md file not found at ${balMdPath}. Make sure to run generateBalMd() first.`);
        }

        // Extract queries from Excel
        const queries = await dataExtarctFromExcelSheet();
        console.log(`Found ${queries.length} queries to process`);

        // Clear the expand_code folder if it exists
        const outputDir = path.join(process.cwd(), "outputs/agentic_outputs/expand_code");
        if (fs.existsSync(outputDir)) {
            fs.rmSync(outputDir, { recursive: true, force: true });
        }
        fs.mkdirSync(outputDir, { recursive: true });

        // Process each query
        for (const queryItem of queries) {
            console.log(`Processing Query ID ${queryItem.id}: "${queryItem.query}"`);
            try {
                await extractRelevantCode(queryItem.query, queryItem.id);
                console.log(`Successfully processed Query ID ${queryItem.id} -> saved as ${queryItem.id}.md`);
            } catch (error) {
                console.error(`Failed to process Query ID ${queryItem.id}:`, error);
            }
        }

        console.log(`All queries processed! Results saved in: ${outputDir}`);
    } catch (error) {
        console.error("[ERROR] Failed to process queries:", error);
        throw error;
    }
}
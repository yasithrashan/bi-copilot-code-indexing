import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import path from "path";
import type { RelevantChunk } from "../types";

interface CodeExpanderParams {
    chunksFilePath: string;
    projectPath: string;
    outputDir?: string;
    docId?: number;
}

export async function expandCode(params: CodeExpanderParams): Promise<string> {
    const { chunksFilePath, projectPath, outputDir = "rag_outputs/expand_code", docId } = params;

    if (!fs.existsSync(chunksFilePath)) {
        throw new Error(`Relevant chunks file not found: ${chunksFilePath}`);
    }

    if (!fs.existsSync(projectPath)) {
        throw new Error(`Project path not found: ${projectPath}`);
    }

    try {
        // Read JSON file from ragPipeline
        const rawData = JSON.parse(fs.readFileSync(chunksFilePath, "utf-8"));
        const userQuery = rawData.query;
        const chunks: RelevantChunk[] = rawData.relevant_chunks || [];

        // Read all .bal files
        const balFiles = fs.readdirSync(projectPath).filter(f => f.endsWith(".bal"));
        if (balFiles.length === 0) {
            throw new Error("No .bal files found in project path.");
        }

        let allBalContent = "## Complete Source Files\n\n";
        for (const file of balFiles) {
            const fullPath = path.join(projectPath, file);
            const content = fs.readFileSync(fullPath, "utf-8");
            allBalContent += `### File: ${file}\n\n\`\`\`ballerina\n${content}\n\`\`\`\n\n`;
        }

        // Build context from relevant chunks
        let chunksContext = "## Relevant Code Chunks\n\n";
        chunks.forEach((chunk, index) => {
            chunksContext += `### Chunk ${index + 1} (Score: ${chunk.score.toFixed(4)})\n`;
            chunksContext += `**File:** ${chunk.payload.file}\n`;
            chunksContext += `**Type:** ${chunk.payload.metadata.type}\n`;
            chunksContext += `**Name:** ${chunk.payload.metadata.name}\n`;
            chunksContext += `**Lines:** ${chunk.payload.metadata.line}-${chunk.payload.metadata.endLine}\n\n`;
            chunksContext += `\`\`\`ballerina\n${chunk.payload.content}\n\`\`\`\n\n`;
        });

        // Create system prompt
        const systemPrompt = `
You are a code analysis assistant...
<source_code_files>
${allBalContent}
</source_code_files>

<relevant_chunks>
${chunksContext}
</relevant_chunks>

<user_query>
${userQuery}
</user_query>



## Instructions

Your task is to expand and organize the relevant Ballerina code based on the user query and relevant chunks. Do NOT modify the code or Do NOT add any explanation - only expand and organize existing code that is relevant.

## What to Include
- Ballerina code that directly relates to the user query and relevant chunks
- Related dependencies: imports, helper functions, connected services and resources
- Type definitions, records, and data structures used by the relevant code
- Configurable variables and constants
- Module-level variables and their definitions
- Service definitions, resource functions, and listener configurations
- Utility functions, connectors, and helper modules
- Any additional matching resources that complement the main code

## What to Exclude
- Code that is not directly relevant to the user query
- Incomplete code fragments that lack proper context
- Unrelated functions or services

## Output Format

Structure your response using markdown with exactly these sections in this order (omit any section that has no relevant content):

## Filename
    Imports
    Configuration Variables
    Module Level Variables
    Services
    Resources
    Matching Resources

Present all code using proper markdown code blocks :

\`\`\`ballerina
import ballerina/http;
import ballerina/log;
\`\`\`

\`\`\`ballerina
type User record {
    string id;
    string name;
    string email;
};
\`\`\`

Focus on providing complete, actionable Ballerina code snippets with full context. If code references other functions, services, or types, include those as well to provide complete understanding.

IMPORTANT: Do not modify the existing code. Only expand and organize the relevant existing code from the source files.

`;

        // Generate expanded code using Claude
        const { text } = await generateText({
            model: anthropic('claude-3-5-sonnet-20240620'),
            system: systemPrompt,
            messages: [
                {
                    role: "user",
                    content: `Please analyze the provided Ballerina code files and relevant chunks to expand the code relevant to the query: "${userQuery}"`
                }
            ],
            maxOutputTokens: 4096 * 2,
        });

        // Prepare output
        const timestamp = new Date().toISOString();
        const chunkCount = chunks.length;
        const filesInvolved = [...new Set(chunks.map(chunk => chunk.payload.file))];

        const reportContent = `# Ballerina Code Expansion

**Query:** ${userQuery}

---

${text}

---

*Code expansion generated from ${chunkCount} relevant chunks across ${filesInvolved.length} files*
`;

        const outputDirPath = path.resolve(outputDir);
        if (!fs.existsSync(outputDirPath)) fs.mkdirSync(outputDirPath, { recursive: true });

        // Use docId if provided, otherwise extract from filename or use timestamp
        let fileName: string;
        if (docId) {
            fileName = `${docId}.md`;
        } else {
            // Try to extract docId from chunksFilePath filename
            const baseName = path.basename(chunksFilePath, '.json');
            if (/^\d+$/.test(baseName)) {
                fileName = `${baseName}.md`;
            } else {
                fileName = `expand_${Date.now()}.md`;
            }
        }

        const outputPath = path.join(outputDirPath, fileName);

        fs.writeFileSync(outputPath, reportContent, "utf-8");

        console.log(`Output saved to: ${outputPath}`);
        return outputPath;

    } catch (error) {
        console.error("Failed to expand code:", error);
        throw error;
    }
}

// Example usage to process all JSON files in a directory
export async function codeExpander(chunksDir: string, projectPath: string, outputDir: string = "rag_outputs/expand_code") {
    if (!fs.existsSync(chunksDir)) {
        throw new Error(`Chunks directory not found: ${chunksDir}`);
    }

    const files = fs.readdirSync(chunksDir).filter((f): f is string => typeof f === "string" && f.endsWith(".json"));
    if (files.length === 0) throw new Error("No relevant_chunks JSON files found.");

    // Sort numerically if files are named 1.json, 2.json, ...
    files.sort((a, b) => parseInt(path.basename(a, ".json")) - parseInt(path.basename(b, ".json")));

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file) continue; // Skip if undefined, though filter above should prevent this
        const chunksFilePath = path.join(chunksDir, file as string);
        console.log(`Processing: ${chunksFilePath}`);

        const docId = i + 1;
        await expandCode({ chunksFilePath, projectPath, outputDir, docId });

        console.log(`Saved expansion: ${path.join(outputDir, `${docId}.md`)}`);
    }

    console.log("All queries processed successfully!");
}
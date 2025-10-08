import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import path from "path";

interface RelevantChunk {
    id: string;
    content: string;
    score: number;
}

interface UserQuery {
    id: number;
    query: string;
}

export async function expandCode(
    userQuery: string,
    chunks: RelevantChunk[],
    balContent: string,
    outputDir: string,
    queryId: string | number
): Promise<string> {
    if (!chunks || chunks.length === 0) {
        console.warn(`No relevant chunks for query ID ${queryId}. Skipping.`);
        return "";
    }

    // Build context from relevant chunks
    let chunksContext = "## Relevant Code Chunks\n\n";
    chunks.forEach((chunk, index) => {
        chunksContext += `### Chunk ${index + 1} (Score: ${chunk.score.toFixed(4)})\n`;
        chunksContext += `**ID:** ${chunk.id}\n\n`;
        chunksContext += `\`\`\`ballerina\n${chunk.content}\n\`\`\`\n\n`;
    });

    // Build system prompt
    const systemPrompt = `
You are a code analysis assistant that helps developers understand and organize relevant Ballerina code based on their queries.

<source_code_files>
${balContent}
</source_code_files>

<relevant_chunks>
${chunksContext}
</relevant_chunks>

<user_query>
${userQuery}
</user_query>

## Instructions

Your task is to expand and organize the relevant Ballerina code based on the user query and relevant chunks. Do NOT modify the code - only expand and organize existing code that is relevant.

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
    ## Imports
    ## Configuration Variables
    ## Module Level Variables
    ## Services
    ## Resources
    ## Matching Resources

Present all code using proper markdown code blocks with Ballerina syntax highlighting:

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

IMPORTANT: Do not modify the existing code. Only expand and organize the relevant existing code from the source files
`;

    const { text } = await generateText({
        model: anthropic('claude-3-5-sonnet-20240620'),
        system: systemPrompt,
        messages: [{ role: "user", content: `Expand code for query: "${userQuery}"` }],
        maxOutputTokens: 4096 * 2,
    });

    const timestamp = new Date().toISOString();
    const reportContent = `# Ballerina Code Expansion

**Query:** ${userQuery}

---

${text}

---
`;

    // Ensure output directory exists
    const outputDirPath = path.resolve(outputDir);
    if (!fs.existsSync(outputDirPath)) fs.mkdirSync(outputDirPath, { recursive: true });

    const outputPath = path.join(outputDirPath, `${queryId}.md`);
    fs.writeFileSync(outputPath, reportContent, "utf-8");

    console.log(`Output saved to: ${outputPath}`);
    return outputPath;
}

// Modified function to accept queries as parameter instead of reading from file
export async function codeExpander(userQueries: UserQuery[]) {
    console.log('Expanding the code...')
    try {
        const chunksDir = "./keyword_search_outputs/keyword_search_result";
        const projectPath = "./ballerina";
        const outputDir = "./keyword_search_outputs/expand_code";

        // Read all .bal files content
        const balFiles = fs.readdirSync(projectPath).filter(f => f.endsWith(".bal"));
        if (balFiles.length === 0) throw new Error("No .bal files found in project path.");
        let balContent = "## Complete Source Files\n\n";
        for (const file of balFiles) {
            const content = fs.readFileSync(path.join(projectPath, file), "utf-8");
            balContent += `### File: ${file}\n\n\`\`\`ballerina\n${content}\n\`\`\`\n\n`;
        }

        // Process each query
        for (const { id, query } of userQueries) {
            console.log(`Processing query #${id}: ${query}`);

            const chunkFilePath = path.join(chunksDir, `${id}.json`);
            if (!fs.existsSync(chunkFilePath)) {
                console.warn(`Chunks file not found for query ID ${id}. Skipping.`);
                continue;
            }

            // Load chunks (array directly)
            const chunks: RelevantChunk[] = JSON.parse(fs.readFileSync(chunkFilePath, "utf-8"));

            await expandCode(query, chunks, balContent, outputDir, id);
        }

        console.log("All queries processed successfully!");
    } catch (error) {
        console.error("Error:", error);
    }
}
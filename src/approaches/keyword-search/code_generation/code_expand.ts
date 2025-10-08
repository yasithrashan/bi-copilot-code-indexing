import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import fs from "fs";
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

/**
 * Expands and organizes relevant Ballerina code based on a user query and code chunks.
 */
export async function expandCode(
    userQuery: string,
    chunks: RelevantChunk[],
    balContent: string,
    outputDir: string,
    queryId: string | number
): Promise<string> {
    if (!chunks || chunks.length === 0) {
        console.log(`Query ${queryId}: No chunks found`);
        return "";
    }

    // Build chunks context
    const chunksContext = chunks
        .map(
            (chunk, index) => `### Chunk ${index + 1} (Score: ${chunk.score.toFixed(4)})
**ID:** ${chunk.id}

\`\`\`ballerina
${chunk.content}
\`\`\`
`
        )
        .join("\n");

    // System prompt
    const systemPrompt = `
    You are a code analysis assistant...
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

    When generating output, do not create any subsections. Assume the input is a complete, relevant, expanded code snippet and respond accordingly. Keep the output as a single cohesive block.
    Only provide code.
    Do not add explanations, comments, or extra sections.
    If a section naturally exists in the code (like read codebase), include it.
    Otherwise, do not create or add any extra sections.

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

    This is for sample reference example.
    Focus on providing complete, actionable Ballerina code snippets with full context. If code references other functions, services, or types, include those as well to provide complete understanding.

    IMPORTANT: Do not modify the existing code. Only expand and organize the relevant existing code from the source files.

    `;


    // Generate expanded code
    const { text } = await generateText({
        model: anthropic("claude-3-5-sonnet-20240620"),
        system: systemPrompt,
        messages: [{ role: "user", content: `Expand code for query: "${userQuery}"` }],
        maxOutputTokens: 4096 * 2,
    });

    const reportContent = `# Ballerina Code Expansion
**Query:** ${userQuery}

---

${text}

---
`;

    // Ensure output directory exists
    const outputDirPath = path.resolve(outputDir);
    if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath, { recursive: true });
    }

    const outputPath = path.join(outputDirPath, `${queryId}.md`);
    fs.writeFileSync(outputPath, reportContent, "utf-8");

    console.log(`Query ${queryId}: ✓ Saved`);
    return outputPath;
}

/**
 * Processes an array of user queries to expand relevant code.
 */
export async function codeExpander(userQueries: UserQuery[]) {
    try {
        console.log("Code expansion started");

        const chunksDir = path.resolve("./outputs/keyword_search_outputs/keyword_search_result");
        const projectPath = path.resolve("./ballerina");
        const outputDir = path.resolve("./outputs/keyword_search_outputs/expand_code");

        // Load all Ballerina files
        const balFiles = fs.readdirSync(projectPath).filter((f) => f.endsWith(".bal"));
        if (balFiles.length === 0) throw new Error("No .bal files found in project path.");

        const balContent = balFiles
            .map((file) => {
                const content = fs.readFileSync(path.join(projectPath, file), "utf-8");
                return `### File: ${file}
                \`\`\`ballerina
                ${content}
                \`\`\`
                `;
            })
            .join("\n");

        // Process each user query
        for (const { id, query } of userQueries) {
            console.log(`Query ${id}: Processing...`);

            const chunkFilePath = path.join(chunksDir, `${id}.json`);
            if (!fs.existsSync(chunkFilePath)) {
                console.log(`Query ${id}: Chunks file not found`);
                continue;
            }

            const chunks: RelevantChunk[] = JSON.parse(fs.readFileSync(chunkFilePath, "utf-8"));

            await expandCode(query, chunks, balContent, outputDir, id);
        }

        console.log("✓ All queries processed");
    } catch (error) {
        console.error("Error:", error);
    }
}
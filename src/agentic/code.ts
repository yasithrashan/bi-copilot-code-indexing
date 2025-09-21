import { generateText, stepCountIs, tool } from "ai";
import { ANTHROPIC_SONNET_4, getAnthropicClinet } from "./connection";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import type { Library } from "../libs/types";
import { LANGLIBS } from "../libs/langlibs";
import path from "path";
import { z } from "zod";
import { dataExtarctFromExcelSheet } from "../excel";

// API Docs directory
const apiDocsDir = 'api_docs';
const LANG_LIB = LANGLIBS as Library[];

// Function to load API doc for specific query ID
function loadApiDocForQuery(queryId: number): Library {
    const apiDocPath = path.join(apiDocsDir, `${queryId}.json`);

    if (!fs.existsSync(apiDocPath)) {
        throw new Error(`API documentation not found for Query ID ${queryId} at path: ${apiDocPath}`);
    }

    try {
        const apiDocContent = fs.readFileSync(apiDocPath, "utf-8");
        return JSON.parse(apiDocContent) as Library;
    } catch (error) {
        throw new Error(`Failed to parse API documentation for Query ID ${queryId}: ${error}`);
    }
}

// Load bal.md file path (don't read it at module level)
const balMdPath = 'agentic_outputs/bal.md';

// Generate Ballerina code function
async function generateBallerinaCode(
    userQuery: string,
    queryId: number
): Promise<string> {
    // Load the specific API doc for this query
    const API_DOC = loadApiDocForQuery(queryId);
    console.log(`Loaded API documentation for Query ID ${queryId}`);

    // Read bal.md content here when it's actually needed
    if (!fs.existsSync(balMdPath)) {
        throw new Error(`bal.md file not found at path: ${balMdPath}. Make sure to run generateBalMd() first.`);
    }
    const balMdContent = fs.readFileSync(balMdPath, "utf8");
    if (!balMdContent.length) {
        throw new Error(`bal.md is empty at path: ${balMdPath}`);
    }

    const systemPromptPrefix = getSystemPromptPrefix([API_DOC]);
    const systemPromptSuffix = getSystemPromptSuffix(LANG_LIB, queryId);
    const systemPrompt = systemPromptPrefix + "\n\n" + systemPromptSuffix + "\n\n" + getSystemPromptBalMd(balMdContent);

    console.log(`Generating Code for Query ID ${queryId}...`);

    const result = await generateText({
        model: anthropic(getAnthropicClinet(ANTHROPIC_SONNET_4)),
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userQuery },
        ],
        tools: {
            extractRelevantCode: tool({
                name: "extractRelevantCode",
                description: 'Reads the extracted code file from expand_code directory and returns the actual relevant code for modification.',
                inputSchema: z.object({}),
                execute: async () => {
                    const extractFilePath = path.join(process.cwd(), "agentic_outputs/expand_code", `${queryId}.md`);

                    if (!fs.existsSync(extractFilePath)) {
                        console.log(`No extract file found for Query ID ${queryId}, will generate from scratch`);
                        return { actualCode: "No relevant code context found. Generating from scratch based on bal.md content." };
                    }

                    const content = fs.readFileSync(extractFilePath, "utf-8");
                    if (!content.length) {
                        console.log(`Extract file is empty for Query ID ${queryId}, will generate from scratch`);
                        return { actualCode: "Extract file is empty. Generating from scratch based on bal.md content." };
                    }

                    console.log(`Successfully extracted relevant code for Query ID ${queryId}`);
                    return { actualCode: content };
                }
            })
        },
        stopWhen: stepCountIs(25),
        maxOutputTokens: 4096,
    });

    return result.text;
}

// Process all queries for code generation
export async function generateCodeForAllQueries(): Promise<void> {
    try {
        // Check if bal.md exists
        if (!fs.existsSync(balMdPath)) {
            throw new Error(`bal.md file not found at path: ${balMdPath}. Make sure to run generateBalMd() first.`);
        }

        // Check if api_docs directory exists
        if (!fs.existsSync(apiDocsDir)) {
            throw new Error(`API docs directory not found at path: ${apiDocsDir}`);
        }

        // Check if expand_code directory exists
        const expandCodeDir = path.join(process.cwd(), "agentic_outputs/expand_code");
        if (!fs.existsSync(expandCodeDir)) {
            console.log(`Warning: expand_code directory not found at ${expandCodeDir}. Code will be generated from scratch.`);
        }

        // Extract queries from Excel
        const queries = await dataExtarctFromExcelSheet();
        console.log(`Found ${queries.length} queries to process for code generation`);

        // Ensure output directory
        const outputDir = path.join(process.cwd(), "agentic_outputs/generated_code");
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Process each query
        for (const queryItem of queries) {
            console.log(`\n=== Processing Query ID ${queryItem.id} for Code Generation ===`);
            console.log(`Query: "${queryItem.query}"`);

            try {
                // Check if API doc exists for this query
                const apiDocPath = path.join(apiDocsDir, `${queryItem.id}.json`);
                if (!fs.existsSync(apiDocPath)) {
                    console.log(`API doc not found for Query ID ${queryItem.id}, skipping...`);
                    continue;
                }

                // Generate the code
                const response = await generateBallerinaCode(queryItem.query, queryItem.id);
                const outputPath = path.join(outputDir, `${queryItem.id}.txt`);

                // Final content with response
                const finalContent = `=== QUERY ID ${queryItem.id} ===
${queryItem.query}

=== API DOC USED ===
${apiDocPath}

=== EXTRACTED CODE USED ===
agentic_outputs/expand_code/${queryItem.id}.md

=== GENERATED CODE RESPONSE ===
${response}

`;

                // Save the output
                fs.writeFileSync(outputPath, finalContent, "utf-8");
                console.log(`Code generation completed for Query ID ${queryItem.id} -> saved as ${queryItem.id}.txt`);

            } catch (error) {
                console.error(`Failed to generate code for Query ID ${queryItem.id}:`, error);

                // Save error log
                const errorPath = path.join(outputDir, `${queryItem.id}_ERROR.txt`);
                const errorContent = `=== QUERY ID ${queryItem.id} - ERROR ===
${queryItem.query}

=== ERROR DETAILS ===
${error instanceof Error ? error.message : String(error)}

=== ERROR STACK ===
${error instanceof Error ? error.stack : 'No stack trace available'}

=== TIMESTAMP ===
${new Date().toISOString()}
`;
                fs.writeFileSync(errorPath, errorContent, "utf-8");
            }
        }

        console.log(`\nAll code generation tasks completed! Results saved in: ${outputDir}`);

    } catch (error) {
        console.error("[ERROR] Failed to process queries for code generation:", error);
        throw error;
    }
}

// Helper functions
function getSystemPromptBalMd(balMdContent: string): string {
    return `
3. Project Summary (bal.md)
<bal_md>
${balMdContent}
</bal_md>

IMPORTANT WORKFLOW:
1. First, read and understand the bal.md content above to get the high-level project context
2. Then, you MUST call the "extractRelevantCode" tool to get the actual extracted code relevant to this query
3. Use the extracted code content to understand the specific code segments that need modification
4. Generate your response based on BOTH the bal.md context AND the extracted code

The extractRelevantCode tool will provide you with the specific code segments that were extracted based on the user query.
This extracted code is the PRIMARY source for understanding what code needs to be modified or extended.

Use this project summary to understand the high level details of the project files for writing Ballerina code.
This file includes:
    Each File:
        -imports
        -configurableLevelVariables
        -moduleLevelVariable
        -types
        -functions
        -services
        -resources
        - Comments/ Doc-Comments
Read carefully and understand the overall project summary.
`;
}

function getSystemPromptPrefix(api_docs: Library[]): string {
    return `You are an expert assistant who specializes in writing Ballerina code. Your goal is to ONLY answer Ballerina related queries. You should always answer with accurate and functional Ballerina code that addresses the specified query while adhering to the constraints of the given API documentation.

You will be provided with the following inputs:

1. API_DOCS: A JSON string containing the API documentation for various Ballerina libraries and their functions, types, and clients.
<api_docs>
${JSON.stringify(api_docs)}
</api_docs>
`;
}

function getSystemPromptSuffix(langlibs: Library[], queryId: number): string {
    return `2. Langlibs
<langlibs>
${JSON.stringify(langlibs)}
</langlibs>

If the query doesn't require code examples, answer the query by utilizing the API documentation.
If the query requires code, follow these steps to generate the Ballerina code:

1. Understand the Goal and High-Level Context
    - First, analyze the user's query and the Project Summary carefully (<bal_md>).
    - Thought: What is the user's primary goal? Am I creating a new feature, modifying existing code, or fixing a bug?
    - Analysis: Use the <bal_md> content to get a high-level summary of the project and identify which parts of the codebase are relevant to the query.

2. Extract Relevant Code Context
    - MANDATORY: Call the "extractRelevantCode" tool to get the actual code segments relevant to this query
    - The tool will provide extracted code from agentic_outputs/expand_code/${queryId}.md
    - This extracted code contains the specific code segments that are relevant to the user's query
    - Use this extracted code as your PRIMARY reference for understanding what needs to be modified

3. Analyze Context and Plan
    - Combine the bal.md high-level context with the extracted code details
    - Identify exactly which code segments need modification, extension, or creation
    - Plan your approach based on the existing code structure


4. Carefully analyze the provided API documentation:
   - Identify the available libraries, clients, their functions and their relevant types.

5. Thoroughly read and understand the given query:
   - Identify the main requirements and objectives of the integration.
   - Determine which libraries, functions and their relevant records and types from the API documentation are needed to achieve the query and forget about unused API docs.
   - Note the libraries needed to achieve the query and plan the control flow of the application based on input and output parameters of each function of the connector according to the API documentation.

6. Plan your code structure:
   - Decide which libraries need to be imported (Avoid importing lang.string, lang.boolean, lang.float, lang.decimal, lang.int, lang.map langlibs as they are already imported by default).
   - Determine the necessary client initialization.
   - Define Types needed for the query in the types.bal file.
   - Outline the service OR main function for the query.
   - Outline the required function usages as noted in Step 3.
   - Based on the types of identified functions, plan the data flow. Transform data as necessary.

7. Generate the Ballerina code:
   - Start with the required import statements.
   - Define required configurables for the query. Use only string, int, boolean types in configurable variables.
   - Initialize any necessary clients with the correct configuration at the module level(before any function or service declarations).
   - Implement the main function OR service to address the query requirements.
   - Use defined connectors based on the query by following the API documentation.
   - Use only the functions, types, and clients specified in the API documentation.
   - Use dot notation to access a normal function. Use -> to access a remote function or resource function.
   - Ensure proper error handling and type checking.
   - Do not invoke methods on json access expressions. Always use separate statements.
   - Use langlibs ONLY IF REQUIRED.

8. Review and refine your code:
   - Check that all query requirements are met.
   - Verify that you're only using elements from the provided API documentation.
   - Ensure the code follows Ballerina best practices and conventions.

Each file which needs modifications, should have a given only the relevant codeblock segment.

**IMPORTANT CONSTRAINTS**
- Only generate relevant code segments based on the extracted code
- Only modify the extracted code - do not create entirely new files unless the extracted code indicates this is needed
- Focus on the specific modifications requested in the query
- Use the extracted code as the primary reference for what exists and what needs to be changed

Example Codeblock segment:
<code filename="main.bal">
\`\`\`ballerina
//code goes here
\`\`\`
</code>
`;
}
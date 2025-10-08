import { generateText, stepCountIs } from "ai";
import { ANTHROPIC_SONNET_4, getAnthropicClinet } from "./connection";
import { anthropic } from "@ai-sdk/anthropic";
import Anthropic from "@anthropic-ai/sdk";
import * as fs from "fs";
import * as path from "path";
import type { Library } from "../../../libs/types";
import { LANGLIBS } from "../../../libs/langlibs";

// Define the user query interface
interface UserQuery {
    id: number;
    query: string;
}

// Add interface for token usage
interface TokenUsage {
    langLibs: number;
    apiDocs: number;
    expandedCode: number;
    userQuery: number;
    systemPrompt: number;
    generatedCode: number;
    totalInput: number;
}

// Initialize Anthropic client for token counting
const anthropicClient = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

// Get the langlibs (same for all queries)
const LANG_LIB = LANGLIBS as Library[];

// Function to count tokens using official Anthropic API
async function countTokens(text: string): Promise<number> {
    try {
        const response = await anthropicClient.messages.countTokens({
            model: "claude-3-5-sonnet-20241022",
            messages: [{ role: "user", content: text }]
        });
        return response.input_tokens;
    } catch (error) {
        console.error("Error counting tokens:", error);
        return -1;
    }
}

// Function to load API docs for a specific query
function loadApiDocsForQuery(queryId: number): Library {
    const apiDocsPath = path.join(process.cwd(), "./api_docs", `${queryId}.json`);

    try {
        const apiDocsContent = fs.readFileSync(apiDocsPath, "utf-8");
        return JSON.parse(apiDocsContent) as Library;
    } catch (error) {
        throw new Error(`Failed to parse API docs for query ${queryId}: ${error}`);
    }
}

// Function to load expanded code for a specific query
function loadExpandedCodeForQuery(queryId: number): string {
    const expandedCodePath = path.join(process.cwd(), "./outputs/keyword_search_outputs/expand_code", `${queryId}.md`);

    if (!fs.existsSync(expandedCodePath)) {
        throw new Error(`Expanded code not found for query ${queryId} at path: ${expandedCodePath}`);
    }

    try {
        return fs.readFileSync(expandedCodePath, "utf-8");
    } catch (error) {
        throw new Error(`Failed to read expanded code for query ${queryId}: ${error}`);
    }
}

// Updated Generate Ballerina code function with token tracking
async function generateBallerinaCodeWithTokens(
    userQuery: string,
    API_DOC: Library,
    expandedCode: string
): Promise<{ code: string; tokenUsage: TokenUsage }> {
    const systemPromptPrefix = getSystemPromptPrefix([API_DOC], expandedCode);
    const systemPromptSuffix = getSystemPromptSuffix(LANG_LIB);
    const systemPrompt = systemPromptPrefix + "\n\n" + systemPromptSuffix;

    console.log("Counting tokens for each component...");

    // Count tokens for each component
    const [
        langLibsTokens,
        apiDocsTokens,
        expandedCodeTokens,
        userQueryTokens,
        systemPromptTokens
    ] = await Promise.all([
        countTokens(JSON.stringify(LANG_LIB)),
        countTokens(JSON.stringify(API_DOC)),
        countTokens(expandedCode),
        countTokens(userQuery),
        countTokens(systemPrompt)
    ]);

    const totalInputTokens = systemPromptTokens + userQueryTokens;

    console.log("Generating Code...");
    console.log(`Token usage - LangLibs: ${langLibsTokens}, API Docs: ${apiDocsTokens}, Expanded Code: ${expandedCodeTokens}, User Query: ${userQueryTokens}, System Prompt: ${systemPromptTokens}, Total Input: ${totalInputTokens}`);

    const result = await generateText({
        model: anthropic(getAnthropicClinet(ANTHROPIC_SONNET_4)),
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userQuery },
        ],
        stopWhen: stepCountIs(25),
        maxOutputTokens: 8192,
    });

    // Count tokens in generated code
    const generatedCodeTokens = await countTokens(result.text);

    const tokenUsage: TokenUsage = {
        langLibs: langLibsTokens,
        apiDocs: apiDocsTokens,
        expandedCode: expandedCodeTokens,
        userQuery: userQueryTokens,
        systemPrompt: systemPromptTokens,
        generatedCode: generatedCodeTokens,
        totalInput: totalInputTokens
    };

    return {
        code: result.text,
        tokenUsage
    };
}

// Updated helper function to include expanded code context
function getSystemPromptPrefix(api_docs: Library[], expandedCode: string): string {
    return `You are an expert assistant who specializes in writing Ballerina code. Your goal is to ONLY answer Ballerina related queries. You should always answer with accurate and functional Ballerina code that addresses the specified query while adhering to the constraints of the given API documentation.

You will be provided with the following inputs:

1. API_DOCS: A JSON string containing the API documentation for various Ballerina libraries and their functions, types, and clients.
<api_docs>
${JSON.stringify(api_docs)}
</api_docs>

2. EXISTING_CODE_CONTEXT: The relevant existing code segments that need to be modified or extended:
<existing_code_context>
${expandedCode}
</existing_code_context>
`;
}

function getSystemPromptSuffix(langlibs: Library[]): string {
    return `3. Langlibs
<langlibs>
${JSON.stringify(langlibs)}
</langlibs>

If the query doesn't require code examples, answer the query by utilizing the API documentation.
If the query requires code, follow these steps to generate the Ballerina code:

1. Understand the Goal and High-Level Context
    - First, analyze the user's query carefully.
    - Review the existing code context to understand the current implementation.
    - Thought: What is the user's primary goal? Am I creating a new feature, modifying existing code, or fixing a bug?

2. Carefully analyze the provided API documentation:
   - Identify the available libraries, clients, their functions and their relevant types.

3. Thoroughly read and understand the given query:
   - Identify the main requirements and objectives of the integration.
   - Determine which libraries, functions and their relevant records and types from the API documentation are needed to achieve the query and forget about unused API docs.
   - Note the libraries needed to achieve the query and plan the control flow of the application based on input and output parameters of each function of the connector according to the API documentation.
   - Consider how to modify or extend the existing code context to meet the requirements.

4. Plan your code structure:
   - Decide which libraries need to be imported (Avoid importing lang.string, lang.boolean, lang.float, lang.decimal, lang.int, lang.map langlibs as they are already imported by default).
   - Determine the necessary client initialization.
   - Define Types needed for the query in the types.bal file.
   - Outline the service OR main function for the query.
   - Outline the required function usages as noted in Step 3.
   - Based on the types of identified functions, plan the data flow. Transform data as necessary.
   - Plan how to integrate changes with existing code structure.

5. Generate the Ballerina code:
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
   - Modify existing code segments as needed to meet the query requirements.

6. Review and refine your code:
   - Check that all query requirements are met.
   - Verify that you're only using elements from the provided API documentation.
   - Ensure the code follows Ballerina best practices and conventions.
   - Verify that modifications integrate well with existing code structure.

Provide a brief explanation of how your code addresses the query and then output your generated ballerina code.

Important reminders:
- Only use the libraries, functions, types, services and clients specified in the provided API documentation.
- Always strictly respect the types given in the API Docs.
- Do not introduce any additional libraries or functions not mentioned in the API docs.
- Only use specified fields in records according to the api docs. this applies to array types of that record as well.
- Ensure your code is syntactically correct and follows Ballerina conventions.
- Do not use dynamic listener registrations.
- Do not write code in a way that requires updating/assigning values of function parameters.
- ALWAYS Use two words camel case identifiers (variable, function parameter, resource function parameter and field names).
- If the library name contains a . Always use an alias in the import statement. (import org/package.one as one;)
- Treat generated connectors/clients inside the generated folder as submodules.
- A submodule MUST BE imported before being used.  The import statement should only contain the package name and submodule name.  For package my_pkg, folder structure generated/fooApi the import should be import my_pkg.fooApi;
- If the return parameter typedesc default value is marked as <> in the given API docs, define a custom record in the code that represents the data structure based on the use case and assign to it.
- Whenever you have a Json variable, NEVER access or manipulate Json variables. ALWAYS define a record and convert the Json to that record and use it.
- When invoking resource function from a client, use the correct paths with accessor and parameters. (eg: exampleClient->/path1/["param"]/path2.get(key="value"))
- When you are accessing a field of a record, always assign it into new variable and use that variable in the next statement.
- Avoid long comments in the code. Use // for single line comments.
- Always use named arguments when providing values to any parameter. (eg: .get(key="value"))
- Mention types EXPLICITLY in variable declarations and foreach statements.
- Do not modify the README.md file unless asked to be modified explicitly in the query.
- Do not add/modify toml files(Config.toml/Ballerina.toml) unless asked.
- In the library API documentation if the service type is specified as generic, adhere to the instructions specified there on writing the service.
- For GraphQL service related queries, If the user haven't specified their own GraphQL Schema, Write the proposed GraphQL schema for the user query right after explanation before generating the ballerina code. Use same names as the GraphQL Schema when defining record types.
- When modifying existing code, preserve existing functionality while adding the requested changes.

Begin your response with the explanation, once the entire explanation is finished only, include codeblock segments(if any) in the end of the response.

Each file which needs modifications, should have a codeblock segment and it MUST have complete file content with the proposed change.

Example Codeblock segment:
<code filename="main.bal">
\`\`\`ballerina
//code goes here
\`\`\`
</code>
`;
}

// Function to save token usage statistics
function saveTokenUsage(queryId: number, tokenUsage: TokenUsage): void {
    const outputDir = path.join(process.cwd(), "outputs/keyword_search_outputs/token_usage");

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `${queryId}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(tokenUsage, null, 2), "utf-8");
    console.log(`Token usage saved to: ${outputPath}`);
}

// Function to save generated code to file
function saveGeneratedCode(queryId: number, generatedCode: string): void {
    const outputDir = path.join(process.cwd(), "outputs/keyword_search_outputs/generated_code");

    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `${queryId}.md`);
    fs.writeFileSync(outputPath, generatedCode, "utf-8");
    console.log(`Generated code saved to: ${outputPath}`);
}

// Updated function to process queries with token tracking
export async function processAllQueries(userQueries: UserQuery[]): Promise<void> {
    console.log('Generating the code with token tracking...')
    try {
        console.log(`Processing ${userQueries.length} user queries...`);

        for (let i = 0; i < userQueries.length; i++) {
            const currentQuery = userQueries[i];
            if (!currentQuery) {
                console.warn(`Skipping undefined query at index ${i}`);
                continue;
            }
            console.log(`Query: ${currentQuery.query}`);

            try {
                // Load API docs for this query
                const apiDocs = loadApiDocsForQuery(currentQuery.id);
                console.log(`Loaded API docs for query ${currentQuery.id}`);

                // Load expanded code for this query
                const expandedCode = loadExpandedCodeForQuery(currentQuery.id);
                console.log(`Loaded expanded code for query ${currentQuery.id}`);

                // Generate Ballerina code with token tracking
                const result = await generateBallerinaCodeWithTokens(
                    currentQuery.query,
                    apiDocs,
                    expandedCode
                );

                // Save generated code
                saveGeneratedCode(currentQuery.id, result.code);

                // Save token usage
                saveTokenUsage(currentQuery.id, result.tokenUsage);

                console.log(`Successfully processed query ${currentQuery.id}`);
                console.log(`Token usage:`, result.tokenUsage);

            } catch (error) {
                console.error(`Error processing query ${currentQuery.id}:`, error);
                // Continue with next query instead of stopping
            }
        }

        console.log("\nAll queries processed");

    } catch (error) {
        console.error("Error processing queries:", error);
        throw error;
    }
}

// Export individual function for single query processing (similar to your previous code)
export async function processCodeGenerationForQuery(
    queryId: number,
    queryText: string
): Promise<TokenUsage> {
    try {
        console.log(`Processing code generation for query ${queryId}: ${queryText}`);

        // Load API docs for this query
        const apiDocs = loadApiDocsForQuery(queryId);
        console.log(`Loaded API docs for query ${queryId}`);

        // Load expanded code for this query
        const expandedCode = loadExpandedCodeForQuery(queryId);
        console.log(`Loaded expanded code for query ${queryId}`);

        // Generate Ballerina code with token tracking
        const result = await generateBallerinaCodeWithTokens(
            queryText,
            apiDocs,
            expandedCode
        );

        // Save generated code
        saveGeneratedCode(queryId, result.code);

        // Save token usage
        saveTokenUsage(queryId, result.tokenUsage);

        console.log(`Successfully processed code generation for query ${queryId}`);
        console.log(`Token usage:`, result.tokenUsage);

        return result.tokenUsage;

    } catch (error) {
        console.error(`Error processing code generation for query ${queryId}:`, error);
        throw error;
    }
}
import { generateText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import * as fs from 'fs';
import path from 'path';

interface BalFile {
    filePath: string;
    content: string;
}

function getAllBalFiles(dirpath: string, fileList: string[] = []): string[] {
    const files = fs.readdirSync(dirpath);
    files.forEach((file) => {
        const filePath = path.join(dirpath, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            getAllBalFiles(filePath, fileList);
        } else if (file.endsWith('.bal')) {
            fileList.push(filePath);
        }
    });
    return fileList;
}

function readBalFiles(filePaths: string[]): BalFile[] {
    return filePaths.map((filePath) => ({
        filePath,
        content: fs.readFileSync(filePath, 'utf-8')
    }));
}

/**
 * Generate Ballerina documentation from a file or directory path
 * @param ballerinaPath - Path to .bal file or directory containing .bal files
 * @returns Promise<string> - Path to generated bal.md file
 */
export async function generateBalMd(ballerinaPath: string): Promise<string> {
    console.log('Generating bal.md...')
    if (!fs.existsSync(ballerinaPath)) {
        throw new Error(`Path does not exist: ${ballerinaPath}`);
    }

    const stat = fs.statSync(ballerinaPath);
    let balFiles: BalFile[];

    if (stat.isFile() && ballerinaPath.endsWith('.bal')) {
        balFiles = readBalFiles([ballerinaPath]);
    } else if (stat.isDirectory()) {
        const balFilePaths = getAllBalFiles(ballerinaPath);
        if (balFilePaths.length === 0) {
            throw new Error(`No .bal files found in: ${ballerinaPath}`);
        }
        balFiles = readBalFiles(balFilePaths);
    } else {
        throw new Error(`Path must be a .bal file or directory: ${ballerinaPath}`);
    }

    const systemPrompt = `
    You are an expert Ballerina developer and technical writer. Your task is to generate a comprehensive, well-structured Markdown documentation (bal.md) for a Ballerina project based on the project files provided.

    Each file has this structure:
    - filePath: string – the file path
    - content: string – the complete file content

    **CRITICAL INSTRUCTIONS:**

    1. **Use ONLY actual code elements** - Extract information directly from the provided code
    2. **Include all functions** – Include every function in the code, whether or not it has comments/doc comments. Do not skip any function.
    3. **Include doc comments and inline comments if they exist** - For functions, variables, types, and services, include comments only if present.
    4. **Be comprehensive but structured** - Include all relevant details in an organized manner
    5. **Follow the exact format structure shown below**

    **OUTPUT FORMAT:**

    Start with project overview:
    \`\`\`
    # [Project Name] Project
    ## This is the project summary of the codebase

    ## Those are the Project Files
    - \`filename.bal\` - [Brief description of file purpose]
    [... list all .bal files]

    ---
    \`\`\`

    Then for each file, follow this EXACT structure:

    \`\`\`
    ## File Name: [filename.bal]

    ### Imports
    - \`import-statement\`
    [... list all imports or "None" if no imports]

    ---

    ### Configurable Variables
    - \`variableName\` - [type] - \`"defaultValue"\`
    [... list all configurable variables or "None" if no configurable variables]

    ### Module Level Variables
    - \`variableName\` - [type]
    [... list all module-level variables or "None" if no module variables]

    ---

    ### Functions

    * **[functionName]**
    * **Comments/DocComments**: [Function documentation or "None"]
    * **Parameters**:
        * **Input Parameter**:
            * \`paramName\` - [type] - [description or "None"]
    * **Returns**: \`[ReturnType]\` or \`[ErrorType]\`

    ---

    ### Services
    [Service Type]: \`[basePath]\` on port \`[portVariable] [portNumber]\`

    ---

    ### Endpoints

    #### \`[basePath]/\`

    * **[METHOD] [path]**
    * **Parameters**:
        * **Path Parameter**:
            * \`paramName\` - [type] - [description]
        * **Query Parameter**:
            * \`paramName\` - [type] - [description]
        * **Body / Payload Parameter**:
            * \`paramName\` - [type] - [description]
    * **Returns**: \`[ReturnType]\` or \`[ErrorType]\`
    * **Status Codes**:
        - \`[code] [description]\` - [explanation based on return types and error handling]

    ---

    ### Type Definitions

    * **[TypeName]**
    * **Fields**:
        * \`fieldName\` - [type] [(optional if field is optional)]

    [... repeat for all types]
    \`\`\`

    **PARSING RULES:**

    1. **Project Name**: Derive from directory name or main service name
    2. **File Descriptions**: Analyze file content to determine purpose (Main service implementation, Type definitions, etc.)
    3. **Configurable Variables**: Look for \`configurable\` keyword variables with their types and default values
    4. **Module Variables**: Variables declared at module level (not in functions/services)
    5. **Functions**: Extract **all functions**, including:
    - Public, private, and internal functions
    - Function name and signature
    - Input parameters with their data types
    - Return types and possible error responses
    - Include doc comments if present; otherwise, mark "None"
    6. **Services**: Extract service definitions with their base paths and ports
    7. **Endpoints**: For each resource function, extract:
    - HTTP method and path from function signature
    - ALL parameter types (path, query, body) with their data types
    - Return types and possible error responses
    - Infer appropriate status codes from return types and error handling patterns
    8. **Types**: Extract all record types, enums, and custom type definitions with their exact field names and types

    **IMPORTANT:**
    - Analyze the source code for any errors, but do not modify or fix them.
    - Preserve exact variable names, type names, and paths from the code
    - Include actual default values for configurable variables
    - Always include **all functions**, even if they have no comments
    - Use "None" for empty sections instead of omitting them
    - Be precise with parameter types and return types
    - Include parameter type categories (Path Parameter, Query Parameter, Body/Payload Parameter, Input Parameter) with actual types
    `;

    const response = await generateText({
        model: anthropic('claude-3-5-sonnet-latest'),
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify(balFiles, null, 2) }
        ],
    });

    const outputDir = path.join(process.cwd(), 'outputs/agentic_outputs/');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const filePath = path.join(outputDir, 'bal.md');
    fs.writeFileSync(filePath, response.text, 'utf-8');

    return filePath;
}
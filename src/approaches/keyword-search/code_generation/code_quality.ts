import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import path from "path";

export interface KeywordChunk {
  file: string;
  type: string;
  name: string;
  line: number;
  endLine: number;
  content: string;
}

interface KeywordSearchData {
  query: string;
  expanded_code: KeywordChunk[];
}

interface QualityEvaluatorParams {
  userQuery: string;
  chunks: KeywordChunk[];
  projectPath: string;
  outputDir?: string;
  queryId?: number;
}

export async function evaluateKeywordSearchQuality(params: QualityEvaluatorParams): Promise<string> {
  const {
    userQuery,
    chunks,
    projectPath,
    outputDir = "outputs/keyword_search_outputs/quality_results",
    queryId,
  } = params;

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  try {

    // Read all .bal files in project directory
    const balFiles = fs.readdirSync(projectPath).filter((f) => f.endsWith(".bal"));
    if (balFiles.length === 0) {
      throw new Error("No .bal files found in project path.");
    }

    let allBalContent = "## Complete Source Files\n\n";
    for (const file of balFiles) {
      const fullPath = path.join(projectPath, file);
      const content = fs.readFileSync(fullPath, "utf-8");
      allBalContent += `### File: ${file}\n\n\`\`\`ballerina\n${content}\n\`\`\`\n\n`;
    }

    // Format chunks context
    let chunksContext = "## Keyword Search Retrieved Chunks\n\n";
    chunks.forEach((chunk, index) => {
      chunksContext += `### Chunk ${index + 1}: ${chunk.name}\n`;
      chunksContext += `**File:** ${chunk.file}\n`;
      chunksContext += `**Type:** ${chunk.type}\n`;
      chunksContext += `**Lines:** ${chunk.line}-${chunk.endLine}\n\n`;
      chunksContext += `\`\`\`ballerina\n${chunk.content}\n\`\`\`\n\n`;
    });

    // System prompt
    const systemPrompt = `
You are evaluating the retrieval quality in a RAG system using keyword-based code search.

CRITICAL CONTEXT: "Relevance" means the retrieved chunks would help an LLM generate code to fulfill the user's request.
These chunks are passed as context to a code generation LLM as input. A chunk is relevant if it contains:
    - Code that needs to be modified or extended based on the user query
    - Function signatures, type definitions, or patterns that inform the code generation
    - Existing implementations that provide context for the requested changes

A chunk is NOT relevant if it contains unrelated code that wouldn't inform the code generation task.

This evaluation is specifically for code generation, where the retrieved chunks serve as input context for the LLM to generate code.
Your task is to determine whether these chunks provide sufficient and relevant information for the LLM to successfully fulfill the user's request.

Note: The retrieval uses keyword-based search to identify relevant code segments based on function names, type names, and other code elements mentioned in the query.

<user_query>
${userQuery}
</user_query>

<project_file_content>
${allBalContent}
</project_file_content>

<retrieved_chunks>
${chunksContext}
</retrieved_chunks>

Provide your evaluation in the following exact format:

## User Query
[Include the full user query here without any changes.]

## Chunk Relevance
[For each chunk, evaluate if it would help the LLM generate code for the user query:
- "Chunk N: ✓ Relevant" or "Chunk N: ✗ Not Relevant"
- One brief sentence explaining why it would or wouldn't help code generation
- If relevant, add one sentence describing what it provides (e.g., "Provides function that needs modification" or "Contains type definition referenced in query" or "Shows existing pattern to extend")]

## Keyword Search Analysis
[Analyze the retrieved chunks from a keyword search perspective:
- How well did keyword matching identify relevant code segments?
- Were the identified chunks appropriate for the modification/generation task?
- Were there false positives (irrelevant matches)?
- What keywords or patterns led to successful retrieval?]

## Missing Information
IMPORTANT: This section is for identifying code that ALREADY EXISTS in the project_file_content but was NOT retrieved by keyword search.

Do NOT suggest code that doesn't exist yet or logic that needs to be created.
Only identify existing code snippets from the source files that would be useful for code generation but weren't retrieved.

[For each missing piece:
- Describe what information is missing that would help code generation
- Explain why keyword search might have missed it (e.g., "Different naming convention", "Indirect dependency", "Related functionality not keyword-matched")
- Provide the exact file path where it exists
- Provide the line number(s) or line range
- Include the actual code snippet from the source

If nothing relevant is missing from retrieval, write "None - All relevant existing code was retrieved"]

Example format:
- Missing: [Description of what's missing and why it matters for code generation]
  Reason: [Why keyword search missed it]
  File: \`path/to/file.bal\`
  Lines: 45-52
  [actual code snippet]

## Retrieval Metrics

**Precision**: [X/Y = Z%]
(Chunks useful for code generation / Total retrieved chunks)
[One sentence: How many retrieved chunks would actually help generate the requested code?]

**Recall**: [X/Y = Z%]
(Useful chunks retrieved / Total useful chunks available in project)
[One sentence: How much of the useful existing code was retrieved?]

**F1-Score**: [Z%]
(Harmonic mean: 2 × (Precision × Recall) / (Precision + Recall))
[One sentence: Balanced measure of retrieval quality for code generation]

## Overall Score: [0-100]

Scoring Guide:
- 90–100: Excellent - Retrieved chunks provide all necessary context for accurate code generation
- 70–89: Good - Minor gaps, but LLM can likely generate acceptable code with retrieved chunks
- 50–69: Fair - Significant useful code missing, may impact code generation quality
- 30–49: Poor - Major gaps, LLM will struggle to generate correct code
- 0–29: Very Poor - Most useful code not retrieved, code generation will likely fail

The score must reflect how well the retrieved chunks enable the LLM to generate accurate and complete code that fulfills the user query.

Keep your response concise, factual, and free of unnecessary text.
`;

    // Generate evaluation using Claude
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Please evaluate the keyword search retrieval quality for the query: "${userQuery}"`,
        },
      ],
      maxOutputTokens: 4096,
    });

    // Save output
    const outputDirPath = path.resolve(outputDir);
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }

    const fileName = queryId ? `${queryId}.md` : `quality_${Date.now()}.md`;
    const outputPath = path.join(outputDirPath, fileName);
    fs.writeFileSync(outputPath, text, "utf-8");

    console.log(`Keyword search quality evaluation saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("Failed to evaluate keyword search quality:", error);
    throw error;
  }
}
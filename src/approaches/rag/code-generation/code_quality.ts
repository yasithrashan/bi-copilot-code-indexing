import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import path from "path";
import type { RelevantChunk } from "../types";

interface QualityEvaluatorParams {
  chunksFilePath: string;
  projectPath: string;
  outputDir?: string;
  docId?: number;
}

export async function evaluateRelevantChunksQuality(params: QualityEvaluatorParams): Promise<string> {
  const {
    chunksFilePath,
    projectPath,
    outputDir = "outputs/rag_outputs/relevant_chunk_quality_results",
    docId,
  } = params;

  if (!fs.existsSync(chunksFilePath)) {
    throw new Error(`Relevant chunks file not found: ${chunksFilePath}`);
  }

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  try {
    // Read relevant chunks JSON
    const rawData = JSON.parse(fs.readFileSync(chunksFilePath, "utf-8"));
    const userQuery = rawData.query;
    const chunks: RelevantChunk[] = rawData.relevant_chunks || [];

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
    let chunksContext = "## Relevant Code Chunks\n\n";
    chunks.forEach((chunk, index) => {
      const score = chunk.score?.toFixed(4) ?? "0.0000";
      const payload = chunk.payload ?? {};
      const file = payload.file ?? "unknown file";
      const type = (payload as any).type ?? "unknown type";
      const name = (payload as any).name ?? "unknown name";
      const line = (payload as any).line ?? 0;
      const endLine = (payload as any).endLine ?? 0;
      const content = payload.content ?? "";

      chunksContext += `### Chunk ${index + 1} (Score: ${score})\n`;
      chunksContext += `**File:** ${file}\n`;
      chunksContext += `**Type:** ${type}\n`;
      chunksContext += `**Name:** ${name}\n`;
      chunksContext += `**Lines:** ${line}-${endLine}\n\n`;
      chunksContext += `\`\`\`ballerina\n${content}\n\`\`\`\n\n`;
    });

    // Focused system prompt
    const systemPrompt = `
    You are evaluating the retrieval quality in a RAG system using SQLite vector search with top-p (nucleus sampling).

    CRITICAL CONTEXT: "Relevance" means the retrieved chunks would help an LLM generate code to fulfill the user's request.
    These chunks are passed as context to a code generation LLM as an input. A chunk is relevant if it contains:
        - Missing chunks that are already in the code base and not captured that are related to the user query
        - A chunk is NOT relevant if it contains unrelated code that wouldn't inform the code generation task. We don't need to send this as an output for code generation.

    This evaluation is specifically for code generation, where the retrieved chunks serve as input context for the LLM to generate code.
    Your task is to determine whether these chunks provide sufficient and relevant information for the LLM to successfully fulfill the user's request.

    Note: The retrieval uses top-p sampling (probability threshold), which dynamically selects chunks until the threshold is reached.

    <user_query>
    ${userQuery}
    </user_query>

    <project_file_content>
    ${allBalContent}
    </project_file_content>

    <retrieved_chunks>
    ${chunksContext}
    </retrieved_chunks>

    ---

    ## Required Output Format

    ### 1. User Query
    [Repeat the user query exactly as provided]

    ### 2. Chunk Relevance Analysis
    For each retrieved chunk:

    **Chunk N: [✓ Relevant | ✗ Not Relevant]**
    - Why: [One sentence explaining relevance]
    - Impact: [If relevant: one sentence on how this enables code generation]

    Example:
    **Chunk 1: ✓ Relevant**
    - Why: Contains the UserRecord type definition referenced in the query
    - Impact: Provides the exact structure needed for database operations

    **Chunk 2: ✗ Not Relevant**
    - Why: Defines authentication logic unrelated to the data retrieval task

    ### 3. Missing Information

    **IMPORTANT RULES:**
    - ONLY identify code that EXISTS in project_file_content but is MISSING from retrieved_chunks
    - DO NOT suggest new code, future implementations, or "should be created" items
    - DO NOT mention functionality that doesn't exist in the codebase
    - Provide exact file paths, line numbers, and code snippets from the project

    Format for each missing item:

    - Missing: [Brief description]
      File: path/to/file.bal
      Lines: X-Y
      Code:
        [exact code snippet from project_file_content]
      Reason: [Why this was needed for the task]

    If nothing is missing: **"None - All relevant existing code was retrieved"**

    ### 4. Retrieval Metrics

    **Precision: X/Y = Z%**
    (Relevant chunks retrieved / Total chunks retrieved)
    Meaning: [One sentence on accuracy]

    **Recall: X/Y = Z%**
    (Relevant chunks retrieved / Total relevant chunks in project)
    Meaning: [One sentence on completeness]

    **F1-Score: Z%**
    (2 × (Precision × Recall) / (Precision + Recall))
    Meaning: [One sentence on balanced performance]

    ### 5. Overall Retrieval Score: [0-100]

    **Scoring Rubric:**
    - **90-100**: Excellent - All necessary code retrieved, LLM can generate complete solution
    - **70-89**: Good - Minor gaps, but core functionality retrieved
    - **50-69**: Fair - Significant gaps, missing important code elements
    - **30-49**: Poor - Major gaps, much relevant code not retrieved
    - **0-29**: Very Poor - Critical code missing, generation likely to fail

    **Score Justification:** [2-3 sentences explaining the score based on what was/wasn't retrieved]

    ---

    ## Guidelines

    - Be precise and factual
    - Use code-specific terminology
    - Focus on retrieval quality, not code quality
    - Base metrics on actual project content analysis
    - Keep explanations concise but informative
  `;

    // Generate evaluation using Claude
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Please evaluate the relevant chunk retrieval quality for the query: "${userQuery}"`,
        },
      ],
      maxOutputTokens: 4096,
    });

    // Save output
    const outputDirPath = path.resolve(outputDir);
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }

    const fileName = docId ? `${docId}.md` : `quality_${Date.now()}.md`;
    const outputPath = path.join(outputDirPath, fileName);
    fs.writeFileSync(outputPath, text, "utf-8");

    console.log(`Chunk quality evaluation saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("Failed to evaluate chunk quality:", error);
    throw error;
  }
}
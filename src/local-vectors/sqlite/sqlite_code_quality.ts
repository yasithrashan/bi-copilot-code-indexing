import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import path from "path";
import type { RelevantChunk } from "./types";

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
    outputDir = "outputs/sqlite_outputs/relevant_chunk_quality_results",
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
      const metadata = payload.metadata ?? {};
      const file = payload.file ?? metadata.file ?? "unknown file";
      const type = metadata.type ?? "unknown type";
      const name = metadata.name ?? "unknown name";
      const line = metadata.line ?? 0;
      const endLine = metadata.endLine ?? 0;
      const content = payload.content ?? "";

      chunksContext += `### Chunk ${index + 1} (Score: ${score})\n`;
      chunksContext += `**File:** ${file}\n`;
      chunksContext += `**Type:** ${type}\n`;
      chunksContext += `**Name:** ${name}\n`;
      chunksContext += `**Lines:** ${line}-${endLine}\n\n`;
      chunksContext += `\`\`\`ballerina\n${content}\n\`\`\`\n\n`;
    });

    // System prompt
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

    Provide your evaluation in the following exact format:

    ## User Query
    [Include the full user query here without any changes.]

    ## Chunk Relevance
    [For each chunk, evaluate if it would help the LLM generate code for the user query:
    - "Chunk N: ✓ Relevant (Score: X.XXXX)" or "Chunk N: ✗ Not Relevant (Score: X.XXXX)"
    - One brief sentence explaining why it would or wouldn't help code generation
    - If relevant, add one sentence describing what it provides (e.g., "Provides function signature needed for the implementation" or "Shows error handling pattern the generated code should follow" or "Contains the data structure definition required")]

    ## Top-P Sampling Analysis
    [Analyze the retrieved chunks from a top-p perspective:
    - How well did the probability threshold capture chunks useful for code generation?
    - Were high-scoring chunks more useful for code generation than lower-scoring ones?
    - Should the top-p threshold be adjusted?

    ## Missing Information
    IMPORTANT: This section is for identifying code that ALREADY EXISTS in the project_file_content but was NOT retrieved in the chunks.

    Do NOT suggest code that doesn't exist yet or logic that needs to be created.
    Only identify existing code snippets from the source files that would be useful for code generation but weren't retrieved.

    [For each missing piece:
    - Describe what information is missing that would help code generation
    - Provide the exact file path where it exists
    - Provide the line number(s) or line range
    - Include the actual code snippet from the source

    If nothing relevant is missing from retrieval, write "None - All relevant existing code was retrieved"]

    Example format:
    - Missing: [Description of what's missing and why it matters for code generation]
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
          content: `Please evaluate the SQLite vector search retrieval quality (using top-p sampling) for the query: "${userQuery}"`,
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

    console.log(`SQLite chunk quality evaluation saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("Failed to evaluate chunk quality:", error);
    throw error;
  }
}
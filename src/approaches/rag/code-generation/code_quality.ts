import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import path from "path";
import type { RelevantChunk } from "../types";

interface QualityEvaluatorParams {
  chunksFilePath: string;
  expandedCodeFilePath: string;
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
    You are evaluating the retrieval quality in a RAG system. Assess how well the retrieved chunks align with and support the user query.

    This evaluation is specifically for code generation, where the retrieved chunks are provided to the LLM to generate code.
    Your task is to determine whether these chunks are relevant and sufficient for the LLM to successfully fulfill the user's request.

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
    [For each chunk, provide:
    - "Chunk N: ✓ Relevant" or "Chunk N: ✗ Not Relevant"
    - One brief sentence explaining why it's relevant or not
    - If relevant, add one sentence describing why this chunk matters for code generation (e.g., "Provides function signature needed" or "Contains error handling pattern required")]

    ## Missing Information
    Note: If the missing information corresponds to a relevant part already present in the code, include the file name and the exact relevant code snippet from it. Do not include any guesses or assumptions — only information that actually exists in the code.
    [List any key information missing that should have been retrieved, or write "None" if the retrieval is complete.]
    [Include the file path and the relevant code snippet]


    ## Retrieval Metrics

    **Precision**: [X/Y = Z%]
    (Relevant chunks / Total retrieved chunks)
    [One sentence: How accurate are the retrieved results?]

    **Recall**: [X/Y = Z%]
    (Relevant chunks retrieved / Total relevant chunks available in project)
    [One sentence: How complete is the retrieval?]

    **F1-Score**: [Z%]
    (Harmonic mean: 2 × (Precision × Recall) / (Precision + Recall))
    [One sentence: Balanced measure of accuracy and completeness]

    ## Overall Score: [0-100]

    Scoring Guide:
    - 90–100: Complete, all relevant
    - 70–89: Minor gaps
    - 50–69: Some missing info
    - 30–49: Major gaps
    - 0–29: Mostly irrelevant

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
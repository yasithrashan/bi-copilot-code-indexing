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
    outputDir = "rag_outputs/relevant_chunk_quality_results",
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
You are evaluating the retrieval quality of chunks in a RAG (Retrieval-Augmented Generation) system. Your goal is to determine how well the retrieved chunks cover the user query based on the full project file.

Here is the user query:
<user_query>
${userQuery}
</user_query>

Here is the full project file content:
<project_file_content>
${allBalContent}
</project_file_content>

Here are the relevant chunks that were retrieved:
<relevant_chunks>
${chunksContext}
</relevant_chunks>

Your Task:

Evaluate whether the retrieved chunks are relevant and complete in relation to the user query. Focus only on how well the chunks match the query and whether any important information from the project file is missing.

Step 1: Analysis (write inside <analysis_process> tags)
In this section, reason step by step:
Identify what specific information the user query is asking for.
Quote relevant sections from the project file that could help answer it.
Quote what information is actually present in the retrieved chunks.
Compare what should have been retrieved vs. what was retrieved.
Note if any chunks are irrelevant or if key parts of the project file are missing.
Keep this section structured and concise — no unnecessary commentary.

Step 2: Evaluation (in markdown format)
After the analysis, provide a short, structured evaluation:
## Coverage Analysis
[Assess if the chunks fully cover what the user query needs.]

## Quality Assessment
[Judge the relevance and usefulness of the retrieved chunks. Mention any irrelevant ones.]

## Gap Identification
[List key missing information from the project file that should have been retrieved.]

## Overall Feedback
[Give brief improvement suggestions for retrieval quality.]

## Justification
[Summarize reasoning for the final score.]

## Score
[Numeric score from 0–100 following this scale:]
- 90–100: Excellent (complete and relevant)
- 70–89: Good (minor gaps)
- 50–69: Fair (some missing info)
- 30–49: Poor (major gaps)
- 0–29: Very poor (mostly irrelevant)

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


// Batch processing: evaluate all expanded code files
export async function batchEvaluateQuality(
  chunksDir: string,
  expandedCodeDir: string,
  projectPath: string,
  outputDir: string = "rag_outputs/relevant_chunks_code_quality_results"
) {
  if (!fs.existsSync(chunksDir)) {
    throw new Error(`Chunks directory not found: ${chunksDir}`);
  }

  if (!fs.existsSync(expandedCodeDir)) {
    throw new Error(`Expanded code directory not found: ${expandedCodeDir}`);
  }

  const chunkFiles = fs.readdirSync(chunksDir).filter((f) => f.endsWith(".json"));
  if (chunkFiles.length === 0) {
    throw new Error("No relevant_chunks JSON files found.");
  }

  // Sort numerically
  chunkFiles.sort((a, b) => parseInt(path.basename(a, ".json")) - parseInt(path.basename(b, ".json")));

  for (let i = 0; i < chunkFiles.length; i++) {
    const chunkFile = chunkFiles[i];
    if (!chunkFile) continue;

    const chunksFilePath = path.join(chunksDir, chunkFile);
    const docId = i + 1;
    const expandedCodeFilePath = path.join(expandedCodeDir, `${docId}.md`);

    if (!fs.existsSync(expandedCodeFilePath)) {
      console.warn(`⚠️  Skipping ${chunkFile}: Expanded code file not found at ${expandedCodeFilePath}`);
      continue;
    }

    console.log(`\n📊 Evaluating quality for document ${docId}...`);
    console.log(`   Chunks: ${chunksFilePath}`);
    console.log(`   Expanded: ${expandedCodeFilePath}`);

    await evaluateRelevantChunksQuality({
      chunksFilePath,
      expandedCodeFilePath,
      projectPath,
      outputDir,
      docId,
    });

    console.log(`Saved quality evaluation: ${path.join(outputDir, `${docId}.md`)}`);
  }

  console.log("\n All quality evaluations completed successfully!");
}
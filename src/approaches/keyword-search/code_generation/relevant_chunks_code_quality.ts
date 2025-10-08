import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import path from "path";

interface RelevantChunk {
  id: string;
  content: string;
  score?: number;
  payload?: Record<string, any>;
}

interface QualityEvaluatorParams {
  chunksFilePath: string;
  projectPath: string;
  outputDir?: string;
  docId?: number;
}

export async function evaluateKeywordSearchChunksQuality(params: QualityEvaluatorParams): Promise<string> {
  const {
    chunksFilePath,
    projectPath,
    outputDir = "keyword_search_outputs/relevant_chunk_quality",
    docId,
  } = params;

  if (!fs.existsSync(chunksFilePath)) {
    throw new Error(`Relevant chunks file not found: ${chunksFilePath}`);
  }

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  try {
    // Load keyword search result JSON
    const chunks: RelevantChunk[] = JSON.parse(fs.readFileSync(chunksFilePath, "utf-8"));
    if (!Array.isArray(chunks) || chunks.length === 0) {
      throw new Error("No valid chunks found in keyword search result file.");
    }

    // Try to infer query from file name or inside the chunk if available
    const fileName = path.basename(chunksFilePath, ".json");
    const userQuery = `Keyword Search Query ${fileName}`;
    console.log("THIS IS THE USER QUERY"+userQuery)

    // Collect all .bal files
    const balFiles = fs.readdirSync(projectPath).filter((f) => f.endsWith(".bal"));
    if (balFiles.length === 0) throw new Error("No .bal files found in project path.");

    let allBalContent = "## Complete Source Files\n\n";
    for (const file of balFiles) {
      const fullPath = path.join(projectPath, file);
      const content = fs.readFileSync(fullPath, "utf-8");
      allBalContent += `### File: ${file}\n\n\`\`\`ballerina\n${content}\n\`\`\`\n\n`;
    }

    // Build relevant chunks section
    let chunksContext = "## Relevant Keyword Search Chunks\n\n";
    chunks.forEach((chunk, index) => {
      const score = chunk.score?.toFixed(4) ?? "0.0000";
      const file = chunk.payload?.file ?? "unknown file";
      const type = chunk.payload?.type ?? "unknown type";
      const name = chunk.payload?.name ?? "unknown name";
      const content = chunk.content ?? "";

      chunksContext += `### Chunk ${index + 1} (Score: ${score})\n`;
      chunksContext += `**File:** ${file}\n`;
      chunksContext += `**Type:** ${type}\n`;
      chunksContext += `**Name:** ${name}\n\n`;
      chunksContext += `\`\`\`ballerina\n${content}\n\`\`\`\n\n`;
    });

    // System prompt
    const systemPrompt = `
You are a code retrieval quality evaluator. The goal is to assess the quality of keyword-based code search results in a Ballerina project.

<user_query>
${userQuery}
</user_query>

<project_source_files>
${allBalContent}
</project_source_files>

<retrieved_chunks>
${chunksContext}
</retrieved_chunks>

## Evaluation Objective

Evaluate how well the retrieved chunks match the user query in terms of **semantic and structural relevance**. You must identify:
- Whether the chunks actually address the intent of the query.
- If some retrieved code is irrelevant or redundant.
- If important related code (imports, types, functions, resources) is missing.
- How complete and contextually correct the results are.

## Steps

### Step 1: Analysis (write inside <analysis_process> tags)
- Describe what the user query is likely targeting.
- Identify which chunks directly contribute to answering the query.
- Note any irrelevant or incomplete ones.
- Compare retrieved chunks vs. what should ideally be retrieved.

### Step 2: Evaluation (Markdown sections) Explain briefly

## User Query
Display the user query for relevant chunks

## Coverage Analysis
Assess whether the keyword search captured all necessary code elements related to the query.

Evaluate how relevant and complete the retrieved chunks are.

List any missing types, resources, or helper functions that are relevant but not included.

## Final Score
Assign a score (0–100) following this scale:
- 90–100: Excellent (precise and comprehensive)
- 70–89: Good (mostly relevant, minor gaps)
- 50–69: Fair (some missing or irrelevant chunks)
- 30–49: Poor (mostly incomplete or off-topic)
- 0–29: Very poor (irrelevant retrieval)
`;

    // Generate evaluation via Claude
    const { text } = await generateText({
      model: anthropic("claude-3-5-sonnet-20240620"),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Evaluate keyword search chunk quality for ${fileName}`,
        },
      ],
      maxOutputTokens: 4096,
    });

    // Save output
    const outputDirPath = path.resolve(outputDir);
    if (!fs.existsSync(outputDirPath)) fs.mkdirSync(outputDirPath, { recursive: true });

    const outputPath = path.join(outputDirPath, `${fileName}.md`);
    fs.writeFileSync(outputPath, text, "utf-8");

    console.log(`Keyword search chunk quality saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("Failed to evaluate keyword search chunk quality:", error);
    throw error;
  }
}

// Batch mode: process all JSON files
export async function batchEvaluateKeywordSearchQuality(
  chunksDir: string,
  projectPath: string,
  outputDir = "keyword_search_outputs/relevant_chunk_quality"
) {
  if (!fs.existsSync(chunksDir)) {
    throw new Error(`Chunks directory not found: ${chunksDir}`);
  }

  const chunkFiles = fs.readdirSync(chunksDir).filter((f) => f.endsWith(".json"));
  if (chunkFiles.length === 0) {
    throw new Error("No keyword search chunk files found.");
  }

  // Sort numerically
  chunkFiles.sort((a, b) => parseInt(path.basename(a, ".json")) - parseInt(path.basename(b, ".json")));

  for (let i = 0; i < chunkFiles.length; i++) {
    const chunkFile = chunkFiles[i];
    if (!chunkFile) {
      throw new Error(`Chunk file at index ${i} is undefined.`);
    }
    const docId = i + 1;
    console.log(`\n🔍 Evaluating keyword search quality for file ${chunkFile}...`);
    const chunksFilePath = path.join(chunksDir, chunkFile as string);

    await evaluateKeywordSearchChunksQuality({
      chunksFilePath,
      projectPath,
      outputDir,
      docId,
    });
  }

  console.log("\n All keyword search chunk quality evaluations completed successfully!");
}

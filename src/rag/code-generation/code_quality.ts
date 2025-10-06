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

export async function evaluateCodeQuality(params: QualityEvaluatorParams): Promise<string> {
  const {
    chunksFilePath,
    expandedCodeFilePath,
    projectPath,
    outputDir = "rag_outputs/code_quality_results",
    docId,
  } = params;

  if (!fs.existsSync(chunksFilePath)) {
    throw new Error(`Relevant chunks file not found: ${chunksFilePath}`);
  }

  if (!fs.existsSync(expandedCodeFilePath)) {
    throw new Error(`Expanded code file not found: ${expandedCodeFilePath}`);
  }

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  try {
    // Read relevant chunks JSON
    const rawData = JSON.parse(fs.readFileSync(chunksFilePath, "utf-8"));
    const userQuery = rawData.query;
    const chunks: RelevantChunk[] = rawData.relevant_chunks || [];

    // Read expanded code markdown
    const expandedCode = fs.readFileSync(expandedCodeFilePath, "utf-8");

    // Read all .bal files in project directory
    const balFiles = fs.readdirSync(projectPath).filter((f) => f.endsWith(".bal"));
    if (balFiles.length === 0) {
      throw new Error("No .bal files found in project path.");
    }

    // Collect all source files
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

    // System prompt for quality evaluation
    const systemPrompt = `
You are a code quality evaluation assistant specializing in RAG (Retrieval-Augmented Generation) systems for code analysis.

<source_code_files>
${allBalContent}
</source_code_files>

<relevant_chunks>
${chunksContext}
</relevant_chunks>

<expanded_code>
${expandedCode}
</expanded_code>

<user_query>
${userQuery}
</user_query>

## Your Task

Evaluate the quality of both the relevant chunks retrieval and the code expansion process. Provide comprehensive feedback and scoring.

## Evaluation Criteria

### 1. Relevant Chunks Quality (50% of total score)
Assess:
- **Relevance to Query**: Do the retrieved chunks directly address the user's query?
- **Completeness**: Are all necessary code components retrieved (imports, types, functions, services)?
- **Accuracy**: Are the chunks semantically relevant to the query intent?
- **Coverage**: Do the chunks provide sufficient context from the codebase?
- **Ranking Quality**: Are the highest-scored chunks truly the most relevant?

Provide:
- Detailed feedback on what was retrieved correctly
- What relevant code pieces are missing, why that missing part relevant to code modification
- Any irrelevant chunks that were included
- Score: X/50

### 2. Code Expansion Quality (50% of total score)
Assess:
- **Correctness**: Does the expanded code accurately represent the source code without modifications?
- **Completeness**: Are all dependencies, imports, and related code included?
- **Organization**: Is the code well-structured and easy to understand?
- **Context**: Does the expansion provide sufficient context to understand the code?
- **Relevance Filtering**: Does it exclude irrelevant code while including all necessary code?

Provide:
- Detailed feedback on the expansion quality
- What was done well
- What could be improved
- Missing dependencies or context
- Score: X/50

## Output Format

Provide your evaluation in the following markdown format:

# Code Quality Evaluation Report

**Query:** [user query]

**Date:** [current date]

---

## Executive Summary

[2-3 sentence overview of the overall quality]

**Total Score: X/100**

---

## 1. Relevant Chunks Quality Evaluation

**Score: X/50**

### Strengths
- [List specific strengths]

### Weaknesses
- [List specific issues]

### Missing Relevant Code
- [List any relevant code that should have been retrieved but wasn't]

### Irrelevant Chunks
- [List any chunks that were retrieved but aren't relevant]

### Detailed Analysis
[Provide detailed analysis of the chunk retrieval quality]

---

## 2. Code Expansion Quality Evaluation

**Score: X/50**

### Strengths
- [List specific strengths]

### Weaknesses
- [List specific issues]

### Missing Components
- [List any missing imports, types, functions, or context]

### Organization Assessment
[Evaluate how well the code is organized and structured]

### Detailed Analysis
[Provide detailed analysis of the code expansion quality]

---

## Overall Recommendations

1. [Specific recommendation for improving chunk retrieval]
2. [Specific recommendation for improving code expansion]
3. [Additional recommendations]

---

## Scoring Breakdown

| Category | Score | Weight | Weighted Score |
|----------|-------|--------|----------------|
| Relevant Chunks Quality | X/50 | 50% | X/50 |
| Code Expansion Quality | X/50 | 50% | X/50 |
| **Total** | | | **X/100** |

---

*Evaluation completed at [timestamp]*

IMPORTANT:
- Be objective and specific in your evaluation
- Provide actionable feedback
- Consider the user query context when evaluating relevance
- A perfect score (100/100) means all relevant code was retrieved and perfectly expanded with complete context
- Be critical but fair in your assessment
`;

    // Generate quality evaluation using Claude
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Please evaluate the quality of the relevant chunks retrieval and code expansion for the query: "${userQuery}"`,
        },
      ],
      maxOutputTokens: 4096 * 2,
    });

    // Prepare output
    const outputDirPath = path.resolve(outputDir);
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }

    let fileName: string;
    if (docId) {
      fileName = `${docId}.md`;
    } else {
      const baseName = path.basename(chunksFilePath, ".json");
      fileName = /^\d+$/.test(baseName) ? `${baseName}_quality.md` : `quality_${Date.now()}.md`;
    }

    const outputPath = path.join(outputDirPath, fileName);
    fs.writeFileSync(outputPath, text, "utf-8");

    console.log(`Quality evaluation saved to: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error("Failed to evaluate code quality:", error);
    throw error;
  }
}

// Batch processing: evaluate all expanded code files
export async function batchEvaluateQuality(
  chunksDir: string,
  expandedCodeDir: string,
  projectPath: string,
  outputDir: string = "rag_outputs/code_quality_results"
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

    await evaluateCodeQuality({
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
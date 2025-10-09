import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import path from "path";

interface ComparatorParams {
  docId: number;
  projectPath: string;
  pineconeResultsDir?: string;
  faissResultsDir?: string;
  outputDir?: string;
}

export async function compareRAGSystems(params: ComparatorParams): Promise<string> {
  const {
    docId,
    projectPath,
    pineconeResultsDir = "outputs/rag_outputs/quality_evaluation",
    faissResultsDir = "outputs/faiss_outputs/quality_evaluation",
    outputDir = "outputs/rag_comparison_results",
  } = params;

  const pineconeFile = path.join(pineconeResultsDir, `${docId}.md`);
  const faissFile = path.join(faissResultsDir, `${docId}.md`);

  if (!fs.existsSync(pineconeFile)) {
    throw new Error(`Pinecone evaluation file not found: ${pineconeFile}`);
  }

  if (!fs.existsSync(faissFile)) {
    throw new Error(`FAISS evaluation file not found: ${faissFile}`);
  }

  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  try {
    // Read both evaluation files
    const pineconeEval = fs.readFileSync(pineconeFile, "utf-8");
    const faissEval = fs.readFileSync(faissFile, "utf-8");

    // Read all .bal files in project directory
    const balFiles = fs.readdirSync(projectPath).filter((f) => f.endsWith(".bal"));
    if (balFiles.length === 0) {
      throw new Error("No .bal files found in project path.");
    }

    let projectContent = "## Complete Project Source Files\n\n";
    for (const file of balFiles) {
      const fullPath = path.join(projectPath, file);
      const content = fs.readFileSync(fullPath, "utf-8");
      projectContent += `### File: ${file}\n\n\`\`\`ballerina\n${content}\n\`\`\`\n\n`;
    }

    // Extract metrics for summary
    const pineconeMetrics = extractMetrics(pineconeEval);
    const faissMetrics = extractMetrics(faissEval);

    // Create comprehensive comparison prompt
    const systemPrompt = `
You are an expert evaluator comparing two RAG (Retrieval-Augmented Generation) systems: Pinecone and FAISS.

Your task is to analyze the code quality evaluation results from both systems and determine which one performs better for code generation tasks.

You have access to:
1. The complete project source code
2. Pinecone's evaluation results (what it retrieved and how relevant it was)
3. FAISS's evaluation results (what it retrieved and how relevant it was)

Focus on:
- Retrieval quality (precision, recall, F1-score)
- Relevance of retrieved chunks for code generation
- Completeness of information
- Missing information analysis (verify against actual source code)
- Overall capability to support accurate code generation

Provide a clear, data-driven comparison with actionable insights.
`;

    const userPrompt = `
Analyze and compare the following RAG system evaluations for Document ID: ${docId}

${projectContent}

---

## Pinecone Evaluation Results

${pineconeEval}

---

## FAISS Evaluation Results

${faissEval}

---

Please provide your analysis in the following format:

# RAG System Comparison Report
**Document ID:** ${docId}
**Date:** ${new Date().toISOString().split('T')[0]}

## Executive Summary
[2-3 sentences on which system performed better overall and why]

## Metrics Comparison Table

| Metric | Pinecone | FAISS | Winner |
|--------|----------|-------|--------|
| Overall Score | ${pineconeMetrics.overallScore}/100 | ${faissMetrics.overallScore}/100 | [Pinecone/FAISS] |
| Precision | ${pineconeMetrics.precision}% | ${faissMetrics.precision}% | [Pinecone/FAISS] |
| Recall | ${pineconeMetrics.recall}% | ${faissMetrics.recall}% | [Pinecone/FAISS] |
| F1-Score | ${pineconeMetrics.f1Score}% | ${faissMetrics.f1Score}% | [Pinecone/FAISS] |
| Relevant Chunks | ${pineconeMetrics.relevantChunks}/${pineconeMetrics.totalChunks} | ${faissMetrics.relevantChunks}/${faissMetrics.totalChunks} | [Pinecone/FAISS] |

## Detailed Analysis

### Retrieval Quality
[Compare precision, recall, and F1-scores. Which system retrieved more relevant chunks? Which had better accuracy?]

### Chunk Relevance for Code Generation
[Analyze the quality and relevance of chunks retrieved by each system. Which provided more actionable code snippets that would help an LLM generate correct code?]

### Missing Information Analysis
[IMPORTANT: Cross-reference the "Missing Information" sections with the actual project source code provided above]
- **Pinecone Missing:** [List what Pinecone missed and verify if it actually exists in the source code]
- **FAISS Missing:** [List what FAISS missed and verify if it actually exists in the source code]
- **Impact:** [Which system's missing information is more critical for code generation?]

### Source Code Verification
[Based on the complete project source code, verify the claims made in both evaluations. Are the missing information lists accurate? Did either system retrieve chunks that aren't actually relevant when you look at the full context?]

## Winner: [Pinecone | FAISS | Tie]

### Reasoning
[Provide 3-5 bullet points explaining why one system outperformed the other, or why it's a tie. Reference specific examples from the source code.]

## Recommendations

### For This Query Type
[Which system should be used for similar queries and why?]

### System Improvements
**Pinecone:**
[Specific suggestions to improve Pinecone's performance]

**FAISS:**
[Specific suggestions to improve FAISS's performance]

### Patterns Observed
[Any patterns that could inform future optimizations]

## Final Verdict

**Winner:** [Pinecone/FAISS]
**Confidence:** [High/Medium/Low]
**Performance Gap:** ${Math.abs(pineconeMetrics.overallScore - faissMetrics.overallScore)} points

**Key Takeaway:**
[One sentence summary of the most important finding]

---

Keep the analysis objective, data-driven, and focused on practical implications for code generation quality.
`;

    // Generate comparison using Claude
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      maxOutputTokens: 4096,
    });

    // Save comparison report
    const outputDirPath = path.resolve(outputDir);
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }

    const outputPath = path.join(outputDirPath, `comparison_${docId}.md`);
    fs.writeFileSync(outputPath, text, "utf-8");

    console.log(`\n${"=".repeat(70)}`);
    console.log(`RAG System Comparison Complete!`);
    console.log(`${"=".repeat(70)}`);
    console.log(`Document ID: ${docId}`);
    console.log(`Pinecone Score: ${pineconeMetrics.overallScore}/100`);
    console.log(`FAISS Score: ${faissMetrics.overallScore}/100`);
    console.log(`Winner: ${pineconeMetrics.overallScore > faissMetrics.overallScore ? "Pinecone" : faissMetrics.overallScore > pineconeMetrics.overallScore ? "FAISS" : "Tie"}`);
    console.log(`Report saved to: ${outputPath}`);
    console.log(`${"=".repeat(70)}\n`);

    return outputPath;
  } catch (error) {
    console.error("Failed to compare RAG systems:", error);
    throw error;
  }
}

/**
 * Extract metrics from evaluation markdown file
 */
function extractMetrics(evalText: string): {
  precision: number;
  recall: number;
  f1Score: number;
  overallScore: number;
  relevantChunks: number;
  totalChunks: number;
} {
  const metrics = {
    precision: 0,
    recall: 0,
    f1Score: 0,
    overallScore: 0,
    relevantChunks: 0,
    totalChunks: 0,
  };

  // Extract Overall Score
  const scoreMatch = evalText.match(/##\s*Overall Score:\s*(\d+)/i);
  if (scoreMatch) {
    metrics.overallScore = parseInt(scoreMatch[1] ?? "0", 10);
  }

  // Extract Precision
  const precisionMatch = evalText.match(/\*\*Precision\*\*:\s*(\d+)\/(\d+)\s*=\s*([\d.]+)%/i);
  if (precisionMatch) {
    metrics.relevantChunks = parseInt(precisionMatch[1] ?? "0", 10);
    metrics.totalChunks = parseInt(precisionMatch[2] ?? "0", 10);
    metrics.precision = parseFloat(precisionMatch[3] ?? "0");
  }

  // Extract Recall
  const recallMatch = evalText.match(/\*\*Recall\*\*:.*?([\d.]+)%/i);
  if (recallMatch) {
    metrics.recall = parseFloat(recallMatch[1] ?? "0");
  }

  // Extract F1-Score
  const f1Match = evalText.match(/\*\*F1-Score\*\*:.*?([\d.]+)%/i);
  if (f1Match) {
    metrics.f1Score = parseFloat(f1Match[1] ?? "0");
  }

  return metrics;
}
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

  // Validation with clear logging
  console.log(`\nStarting RAG Comparison for Document ID: ${docId}`);

  if (!fs.existsSync(pineconeFile)) {
    throw new Error(`Pinecone file not found: ${pineconeFile}`);
  }
  if (!fs.existsSync(faissFile)) {
    throw new Error(`FAISS file not found: ${faissFile}`);
  }
  if (!fs.existsSync(projectPath)) {
    throw new Error(`Project path not found: ${projectPath}`);
  }

  console.log(`[OK] Found evaluation files`);

  try {
    // Read evaluation files
    const pineconeEval = fs.readFileSync(pineconeFile, "utf-8");
    const faissEval = fs.readFileSync(faissFile, "utf-8");

    // Read project files
    const balFiles = fs.readdirSync(projectPath).filter((f) => f.endsWith(".bal"));
    if (balFiles.length === 0) {
      throw new Error("No .bal files found in project path");
    }

    console.log(`[OK] Loaded ${balFiles.length} project file(s)`);

    let projectContent = "## Complete Project Source Files\n\n";
    for (const file of balFiles) {
      const fullPath = path.join(projectPath, file);
      const content = fs.readFileSync(fullPath, "utf-8");
      projectContent += `### File: ${file}\n\n\`\`\`ballerina\n${content}\n\`\`\`\n\n`;
    }

    // Extract metrics
    const pineconeMetrics = extractMetrics(pineconeEval);
    const faissMetrics = extractMetrics(faissEval);

    console.log(`[OK] Extracted metrics - Pinecone: ${pineconeMetrics.overallScore}/100, FAISS: ${faissMetrics.overallScore}/100`);
    console.log(`[Processing] Generating comparison analysis...`);

    // Streamlined system prompt
    const systemPrompt = `You are a RAG system evaluator. Compare Pinecone vs FAISS for code retrieval.

Analyze:
- Retrieval metrics (precision, recall, F1)
- Chunk relevance for code generation
- Missing information (verify against source code)

Be concise, data-driven, and actionable. Use the exact format requested.`;

    // Simplified user prompt
    const userPrompt = `
Compare RAG evaluations for Document ID: ${docId}

${projectContent}

---

## Pinecone Results
${pineconeEval}

---

## FAISS Results
${faissEval}

---

**Output Format:**

# RAG Comparison: Doc ${docId}
**Date:** ${new Date().toISOString().split('T')[0]}

## Summary
[2 sentences: Which system won and why]

## Metrics

| Metric | Pinecone | FAISS | Winner |
|--------|----------|-------|--------|
| Overall | ${pineconeMetrics.overallScore}/100 | ${faissMetrics.overallScore}/100 | ? |
| Precision | ${pineconeMetrics.precision}% | ${faissMetrics.precision}% | ? |
| Recall | ${pineconeMetrics.recall}% | ${faissMetrics.recall}% | ? |
| F1-Score | ${pineconeMetrics.f1Score}% | ${faissMetrics.f1Score}% | ? |
| Relevant | ${pineconeMetrics.relevantChunks}/${pineconeMetrics.totalChunks} | ${faissMetrics.relevantChunks}/${faissMetrics.totalChunks} | ? |

## Analysis

**Retrieval Quality:** [2-3 sentences comparing metrics]

**Chunk Relevance:** [2-3 sentences on code generation utility]

**Missing Info:**
- Pinecone missed: [verify against source]
- FAISS missed: [verify against source]
- Impact: [which is more critical?]

## Verdict

**Winner:** [Pinecone/FAISS/Tie]

**Why:** [3 concise bullet points with source code references]

**Recommendation:** [1 sentence on which to use for similar queries]

**Key Insight:** [1 sentence takeaway]

---
Keep it brief, clear, and actionable.
`;

    // Generate comparison
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      maxOutputTokens: 2048,
    });

    // Save report
    const outputDirPath = path.resolve(outputDir);
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }

    const outputPath = path.join(outputDirPath, `comparison_${docId}.md`);
    fs.writeFileSync(outputPath, text, "utf-8");

    // Clean, informative console output
    const winner =
      pineconeMetrics.overallScore > faissMetrics.overallScore ? "Pinecone" :
        faissMetrics.overallScore > pineconeMetrics.overallScore ? "FAISS" :
          "Tie";

    const gap = Math.abs(pineconeMetrics.overallScore - faissMetrics.overallScore);

    console.log(`\n${"═".repeat(60)}`);
    console.log(`  RAG COMPARISON RESULTS`);
    console.log(`${"═".repeat(60)}`);
    console.log(`  Document ID:  ${docId}`);
    console.log(`  Winner:       ${winner} ${winner !== "Tie" ? `(+${gap} points)` : ""}`);
    console.log(`${"─".repeat(60)}`);
    console.log(`  Pinecone:     ${pineconeMetrics.overallScore}/100 (P:${pineconeMetrics.precision}% R:${pineconeMetrics.recall}% F1:${pineconeMetrics.f1Score}%)`);
    console.log(`  FAISS:        ${faissMetrics.overallScore}/100 (P:${faissMetrics.precision}% R:${faissMetrics.recall}% F1:${faissMetrics.f1Score}%)`);
    console.log(`${"─".repeat(60)}`);
    console.log(`  Report:    ${outputPath}`);
    console.log(`${"═".repeat(60)}\n`);

    return outputPath;
  } catch (error) {
    console.error(`\n[ERROR] Comparison failed:`, error);
    throw error;
  }
}

/**
 * Extract metrics from evaluation markdown
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

  const scoreMatch = evalText.match(/##\s*Overall Score:\s*(\d+)/i);
  if (scoreMatch) metrics.overallScore = parseInt(scoreMatch[1] ?? "0", 10);

  const precisionMatch = evalText.match(/\*\*Precision\*\*:\s*(\d+)\/(\d+)\s*=\s*([\d.]+)%/i);
  if (precisionMatch) {
    metrics.relevantChunks = parseInt(precisionMatch[1] ?? "0", 10);
    metrics.totalChunks = parseInt(precisionMatch[2] ?? "0", 10);
    metrics.precision = parseFloat(precisionMatch[3] ?? "0");
  }

  const recallMatch = evalText.match(/\*\*Recall\*\*:.*?([\d.]+)%/i);
  if (recallMatch) metrics.recall = parseFloat(recallMatch[1] ?? "0");

  const f1Match = evalText.match(/\*\*F1-Score\*\*:.*?([\d.]+)%/i);
  if (f1Match) metrics.f1Score = parseFloat(f1Match[1] ?? "0");

  return metrics;
}
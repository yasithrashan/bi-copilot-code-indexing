import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import path from "path";

interface ComparatorParams {
  docId: number;
  projectPath: string;
  pineconeResultsDir?: string;
  faissResultsDir?: string;
  sqliteResultsDir?: string;
  pineconeTimeDir?: string;
  faissTimeDir?: string;
  sqliteTimeDir?: string;
  pineconeChunksDir?: string;
  faissChunksDir?: string;
  sqliteChunksDir?: string;
  outputDir?: string;
}

interface SystemMetrics {
  precision: number;
  recall: number;
  f1Score: number;
  overallScore: number;
  relevantChunks: number;
  totalChunks: number;
  retrievalTime: number;
  totalQueryTime: number;
  chunks: Array<{
    score: number;
    content: string;
    metadata?: any;
  }>;
}

export async function compareRAGSystems(params: ComparatorParams): Promise<string> {
  const {
    docId,
    projectPath,
    pineconeResultsDir = "outputs/rag_outputs/quality_evaluation",
    faissResultsDir = "outputs/faiss_outputs/quality_evaluation",
    sqliteResultsDir = "outputs/sqlite_outputs/quality_evaluation",
    pineconeTimeDir = "outputs/rag_outputs/time_consuming",
    faissTimeDir = "outputs/faiss_outputs/time_consuming",
    sqliteTimeDir = "outputs/sqlite_outputs/time_consuming",
    pineconeChunksDir = "outputs/rag_outputs/relevant_chunks",
    faissChunksDir = "outputs/faiss_outputs/relevant_chunks",
    sqliteChunksDir = "outputs/sqlite_outputs/relevant_chunks",
    outputDir = "outputs/rag_comparison_results",
  } = params;

  // File paths
  const pineconeQualityFile = path.join(pineconeResultsDir, `${docId}.md`);
  const faissQualityFile = path.join(faissResultsDir, `${docId}.md`);
  const sqliteQualityFile = path.join(sqliteResultsDir, `${docId}.md`);

  const pineconeTimeFile = path.join(pineconeTimeDir, `${docId}.json`);
  const faissTimeFile = path.join(faissTimeDir, `${docId}.json`);
  const sqliteTimeFile = path.join(sqliteTimeDir, `${docId}.json`);

  const pineconeChunksFile = path.join(pineconeChunksDir, `${docId}.json`);
  const faissChunksFile = path.join(faissChunksDir, `${docId}.json`);
  const sqliteChunksFile = path.join(sqliteChunksDir, `${docId}.json`);

  console.log(`\nStarting Enhanced RAG Comparison for Document ID: ${docId}`);

  // Validate all files exist
  const requiredFiles = [
    { path: pineconeQualityFile, name: "Pinecone quality" },
    { path: faissQualityFile, name: "FAISS quality" },
    { path: sqliteQualityFile, name: "SQLite quality" },
    { path: pineconeTimeFile, name: "Pinecone timing" },
    { path: faissTimeFile, name: "FAISS timing" },
    { path: sqliteTimeFile, name: "SQLite timing" },
    { path: pineconeChunksFile, name: "Pinecone chunks" },
    { path: faissChunksFile, name: "FAISS chunks" },
    { path: sqliteChunksFile, name: "SQLite chunks" },
    { path: projectPath, name: "Project path" },
  ];

  for (const file of requiredFiles) {
    if (!fs.existsSync(file.path)) {
      throw new Error(`${file.name} file not found: ${file.path}`);
    }
  }

  console.log(`[OK] All required files found`);

  try {
    // Read quality evaluation files
    const pineconeQuality = fs.readFileSync(pineconeQualityFile, "utf-8");
    const faissQuality = fs.readFileSync(faissQualityFile, "utf-8");
    const sqliteQuality = fs.readFileSync(sqliteQualityFile, "utf-8");

    // Read timing files
    const pineconeTime = JSON.parse(fs.readFileSync(pineconeTimeFile, "utf-8"));
    const faissTime = JSON.parse(fs.readFileSync(faissTimeFile, "utf-8"));
    const sqliteTime = JSON.parse(fs.readFileSync(sqliteTimeFile, "utf-8"));

    // Read chunks files
    const pineconeChunks = JSON.parse(fs.readFileSync(pineconeChunksFile, "utf-8"));
    const faissChunks = JSON.parse(fs.readFileSync(faissChunksFile, "utf-8"));
    const sqliteChunks = JSON.parse(fs.readFileSync(sqliteChunksFile, "utf-8"));

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

    // Extract comprehensive metrics
    const pineconeMetrics = extractComprehensiveMetrics(pineconeQuality, pineconeTime, pineconeChunks);
    const faissMetrics = extractComprehensiveMetrics(faissQuality, faissTime, faissChunks);
    const sqliteMetrics = extractComprehensiveMetrics(sqliteQuality, sqliteTime, sqliteChunks);

    console.log(`[OK] Extracted comprehensive metrics`);
    console.log(`  Pinecone: ${pineconeMetrics.overallScore}/100, ${pineconeMetrics.retrievalTime}ms`);
    console.log(`  FAISS: ${faissMetrics.overallScore}/100, ${faissMetrics.retrievalTime}ms`);
    console.log(`  SQLite: ${sqliteMetrics.overallScore}/100, ${sqliteMetrics.retrievalTime}ms`);

    // Generate metrics matrix markdown
    const metricsMatrix = generateMetricsMatrix(docId, pineconeMetrics, faissMetrics, sqliteMetrics, pineconeChunks.query);

    // Save metrics matrix
    const outputDirPath = path.resolve(outputDir);
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }

    const metricsPath = path.join(outputDirPath, `metrics_${docId}.md`);
    fs.writeFileSync(metricsPath, metricsMatrix, "utf-8");

    console.log(`[Processing] Generating AI-powered comparison analysis...`);

    // Enhanced system prompt
    const systemPrompt = `You are a comprehensive RAG system evaluator. Compare Pinecone vs FAISS vs SQLite for code retrieval across multiple dimensions:

Analyze:
1. Retrieval Quality (precision, recall, F1)
2. Performance (retrieval time, total query time)
3. Chunk Relevance (scores, content quality)
4. Missing Information (verify against source code)
5. System Trade-offs (speed vs accuracy)

Be concise, data-driven, and actionable. Focus on practical insights.`;

    // Enhanced user prompt
    const userPrompt = `
Compare RAG systems for Document ID: ${docId}

Query: "${pineconeChunks.query}"

${projectContent}

---

## Pinecone Evaluation
${pineconeQuality}

## FAISS Evaluation
${faissQuality}

## SQLite Evaluation
${sqliteQuality}

---

## Performance Metrics

### Pinecone
- Retrieval Time: ${pineconeMetrics.retrievalTime}ms
- Total Query Time: ${pineconeMetrics.totalQueryTime}ms
- Chunks Retrieved: ${pineconeMetrics.totalChunks}
- Top Score: ${pineconeMetrics.chunks[0]?.score.toFixed(4) ?? 'N/A'}

### FAISS
- Retrieval Time: ${faissMetrics.retrievalTime}ms
- Total Query Time: ${faissMetrics.totalQueryTime}ms
- Chunks Retrieved: ${faissMetrics.totalChunks}
- Top Score: ${faissMetrics.chunks[0]?.score.toFixed(4) ?? 'N/A'}

### SQLite
- Retrieval Time: ${sqliteMetrics.retrievalTime}ms
- Total Query Time: ${sqliteMetrics.totalQueryTime}ms
- Chunks Retrieved: ${sqliteMetrics.totalChunks}
- Top Score: ${sqliteMetrics.chunks[0]?.score.toFixed(4) ?? 'N/A'}

---

**Output Format:**

# RAG System Comparison: Doc ${docId}
**Date:** ${new Date().toISOString().split('T')[0]}
**Query:** "${pineconeChunks.query}"

## Executive Summary
[3-4 sentences: Overall winner, key differentiators, and recommendation]

## Comparative Metrics

| Metric | Pinecone | FAISS | SQLite | Winner | Margin |
|--------|----------|-------|--------|--------|---------|
| Overall Score | ${pineconeMetrics.overallScore}/100 | ${faissMetrics.overallScore}/100 | ${sqliteMetrics.overallScore}/100 | ? | ? |
| Precision | ${pineconeMetrics.precision}% | ${faissMetrics.precision}% | ${sqliteMetrics.precision}% | ? | ? |
| Recall | ${pineconeMetrics.recall}% | ${faissMetrics.recall}% | ${sqliteMetrics.recall}% | ? | ? |
| F1-Score | ${pineconeMetrics.f1Score}% | ${faissMetrics.f1Score}% | ${sqliteMetrics.f1Score}% | ? | ? |
| Retrieval Time | ${pineconeMetrics.retrievalTime}ms | ${faissMetrics.retrievalTime}ms | ${sqliteMetrics.retrievalTime}ms | ? | ? |
| Total Time | ${pineconeMetrics.totalQueryTime}ms | ${faissMetrics.totalQueryTime}ms | ${sqliteMetrics.totalQueryTime}ms | ? | ? |
| Relevant Chunks | ${pineconeMetrics.relevantChunks}/${pineconeMetrics.totalChunks} | ${faissMetrics.relevantChunks}/${faissMetrics.totalChunks} | ${sqliteMetrics.relevantChunks}/${sqliteMetrics.totalChunks} | ? | ? |

## Quality Analysis

**Retrieval Accuracy:** [Compare precision, recall, F1 across systems]

**Chunk Quality:** [Analyze top scores and relevance distribution]

**Missing Information:**
- Pinecone: [Critical gaps with source verification]
- FAISS: [Critical gaps with source verification]
- SQLite: [Critical gaps with source verification]

## Performance Analysis

**Speed Comparison:** [Analyze retrieval and total query times]

**Efficiency:** [Time per relevant chunk retrieved]

**Trade-offs:** [Speed vs accuracy analysis]

## System Characteristics

**Pinecone:**
- Strengths: [2-3 points]
- Weaknesses: [1-2 points]
- Best for: [Use case]

**FAISS:**
- Strengths: [2-3 points]
- Weaknesses: [1-2 points]
- Best for: [Use case]

**SQLite:**
- Strengths: [2-3 points]
- Weaknesses: [1-2 points]
- Best for: [Use case]

## Verdict

**Overall Winner:** [System name]

**Quality Winner:** [System name] (${Math.max(pineconeMetrics.overallScore, faissMetrics.overallScore, sqliteMetrics.overallScore)}/100)

**Speed Winner:** [System name] (${Math.min(pineconeMetrics.retrievalTime, faissMetrics.retrievalTime, sqliteMetrics.retrievalTime)}ms)

**Best Value:** [System name - balance of quality and speed]

**Key Insights:**
- [Insight 1 with data]
- [Insight 2 with data]
- [Insight 3 with data]

**Recommendation:** [Which system to use for this type of query and why]

---
`;

    // Generate AI comparison
    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      maxOutputTokens: 3072,
    });

    // Save AI comparison report
    const comparisonPath = path.join(outputDirPath, `comparison_${docId}.md`);
    fs.writeFileSync(comparisonPath, text, "utf-8");

    // Generate console summary
    printComparisonSummary(docId, pineconeMetrics, faissMetrics, sqliteMetrics, metricsPath, comparisonPath);

    return comparisonPath;
  } catch (error) {
    console.error(`\n[ERROR] Comparison failed:`, error);
    throw error;
  }
}

/**
 * Extract comprehensive metrics including timing and chunks
 */
function extractComprehensiveMetrics(
  qualityEval: string,
  timingData: any,
  chunksData: any
): SystemMetrics {
  const metrics: SystemMetrics = {
    precision: 0,
    recall: 0,
    f1Score: 0,
    overallScore: 0,
    relevantChunks: 0,
    totalChunks: 0,
    retrievalTime: 0,
    totalQueryTime: 0,
    chunks: [],
  };

  // Try multiple patterns for Overall Score
  let scoreMatch = qualityEval.match(/##\s*\d+\.\s*Overall\s+Retrieval\s+Score:\s*(\d+)/i);
  if (!scoreMatch) scoreMatch = qualityEval.match(/##\s*Overall Score:\s*(\d+)/i);
  if (!scoreMatch) scoreMatch = qualityEval.match(/Overall\s+(?:Retrieval\s+)?Score[:\s]+(\d+)/i);
  if (!scoreMatch) scoreMatch = qualityEval.match(/Score[:\s]+(\d+)\/100/i);
  if (scoreMatch) {
    metrics.overallScore = parseInt(scoreMatch[1] ?? "0", 10);
  }

  // Try multiple patterns for Precision
  let precisionMatch = qualityEval.match(/\*\*Precision[:\s]+(\d+)\/(\d+)\s*=\s*([\d.]+)%\*\*/i);
  if (!precisionMatch) precisionMatch = qualityEval.match(/Precision[:\s]+(\d+)\/(\d+)\s*=\s*([\d.]+)%/i);
  if (!precisionMatch) precisionMatch = qualityEval.match(/\*\*Precision\*\*:\s*(\d+)\/(\d+)\s*=\s*([\d.]+)%/i);
  if (!precisionMatch) precisionMatch = qualityEval.match(/Precision[:\s]+([\d.]+)%/i);

  if (precisionMatch) {
    if (precisionMatch[3]) {
      // Format: X/Y = Z%
      metrics.relevantChunks = parseInt(precisionMatch[1] ?? "0", 10);
      metrics.totalChunks = parseInt(precisionMatch[2] ?? "0", 10);
      metrics.precision = parseFloat(precisionMatch[3] ?? "0");
    } else if (precisionMatch[1]) {
      // Format: Z%
      metrics.precision = parseFloat(precisionMatch[1] ?? "0");
    }
  }

  // Try multiple patterns for Recall
  let recallMatch = qualityEval.match(/\*\*Recall[:\s]+(\d+)\/(\d+)\s*=\s*([\d.]+)%\*\*/i);
  if (!recallMatch) recallMatch = qualityEval.match(/Recall[:\s]+(\d+)\/(\d+)\s*=\s*([\d.]+)%/i);
  if (!recallMatch) recallMatch = qualityEval.match(/\*\*Recall\*\*:.*?([\d.]+)%/i);
  if (!recallMatch) recallMatch = qualityEval.match(/Recall[:\s]+([\d.]+)%/i);
  if (recallMatch) {
    const recallValue = recallMatch[3] || recallMatch[1];
    if (recallValue) metrics.recall = parseFloat(recallValue);
  }

  // Try multiple patterns for F1-Score
  let f1Match = qualityEval.match(/\*\*F1-Score[:\s]+([\d.]+)%\*\*/i);
  if (!f1Match) f1Match = qualityEval.match(/F1-Score[:\s]+([\d.]+)%/i);
  if (!f1Match) f1Match = qualityEval.match(/\*\*F1-Score\*\*:.*?([\d.]+)%/i);
  if (!f1Match) f1Match = qualityEval.match(/F1[- ]?Score[:\s]+([\d.]+)%/i);
  if (!f1Match) f1Match = qualityEval.match(/F1[:\s]+([\d.]+)%/i);
  if (f1Match) metrics.f1Score = parseFloat(f1Match[1] ?? "0");

  // If totalChunks not found from precision, try to get from chunks count
  if (metrics.totalChunks === 0 && chunksData.relevant_chunks) {
    metrics.totalChunks = Array.isArray(chunksData.relevant_chunks) ? chunksData.relevant_chunks.length : 0;
  }

  // Extract timing metrics
  metrics.retrievalTime = timingData.retrieval_time_ms ?? 0;
  metrics.totalQueryTime = timingData.total_query_time_ms ?? 0;

  // Extract chunks
  if (chunksData.relevant_chunks && Array.isArray(chunksData.relevant_chunks)) {
    metrics.chunks = chunksData.relevant_chunks.map((chunk: any) => ({
      score: chunk.score ?? 0,
      content: chunk.payload?.content ?? "",
      metadata: chunk.payload?.metadata,
    }));
  }

  // Debug logging for failed extractions
  if (metrics.overallScore === 0) {
    console.warn(`[DEBUG] Could not extract overall score from evaluation. First 200 chars:\n${qualityEval.substring(0, 200)}`);
  }

  return metrics;
}

/**
 * Generate comprehensive metrics matrix markdown
 */
function generateMetricsMatrix(
  docId: number,
  pinecone: SystemMetrics,
  faiss: SystemMetrics,
  sqlite: SystemMetrics,
  query: string
): string {
  const calculateWinner = (p: number, f: number, s: number, higher: boolean = true) => {
    const max = Math.max(p, f, s);
    const min = Math.min(p, f, s);
    const target = higher ? max : min;

    if (p === target) return "Pinecone";
    if (f === target) return "FAISS";
    return "SQLite";
  };

  const calculateMargin = (winner: number, others: number[]) => {
    const secondBest = Math.max(...others.filter(v => v !== winner));
    return (winner - secondBest).toFixed(2);
  };

  return `# RAG Systems Metrics Matrix - Document ${docId}

**Generated:** ${new Date().toISOString()}
**Query:** "${query}"

---

## 📊 Quality Metrics

| Metric | Pinecone | FAISS | SQLite | Winner | Margin |
|--------|----------|-------|--------|--------|---------|
| **Overall Score** | ${pinecone.overallScore}/100 | ${faiss.overallScore}/100 | ${sqlite.overallScore}/100 | ${calculateWinner(pinecone.overallScore, faiss.overallScore, sqlite.overallScore)} | ${calculateMargin(Math.max(pinecone.overallScore, faiss.overallScore, sqlite.overallScore), [pinecone.overallScore, faiss.overallScore, sqlite.overallScore])} pts |
| **Precision** | ${pinecone.precision.toFixed(2)}% | ${faiss.precision.toFixed(2)}% | ${sqlite.precision.toFixed(2)}% | ${calculateWinner(pinecone.precision, faiss.precision, sqlite.precision)} | ${calculateMargin(Math.max(pinecone.precision, faiss.precision, sqlite.precision), [pinecone.precision, faiss.precision, sqlite.precision])}% |
| **Recall** | ${pinecone.recall.toFixed(2)}% | ${faiss.recall.toFixed(2)}% | ${sqlite.recall.toFixed(2)}% | ${calculateWinner(pinecone.recall, faiss.recall, sqlite.recall)} | ${calculateMargin(Math.max(pinecone.recall, faiss.recall, sqlite.recall), [pinecone.recall, faiss.recall, sqlite.recall])}% |
| **F1-Score** | ${pinecone.f1Score.toFixed(2)}% | ${faiss.f1Score.toFixed(2)}% | ${sqlite.f1Score.toFixed(2)}% | ${calculateWinner(pinecone.f1Score, faiss.f1Score, sqlite.f1Score)} | ${calculateMargin(Math.max(pinecone.f1Score, faiss.f1Score, sqlite.f1Score), [pinecone.f1Score, faiss.f1Score, sqlite.f1Score])}% |
| **Relevant Chunks** | ${pinecone.relevantChunks}/${pinecone.totalChunks} | ${faiss.relevantChunks}/${faiss.totalChunks} | ${sqlite.relevantChunks}/${sqlite.totalChunks} | ${calculateWinner(pinecone.relevantChunks, faiss.relevantChunks, sqlite.relevantChunks)} | - |

---

## ⚡ Performance Metrics

| Metric | Pinecone | FAISS | SQLite | Winner | Margin |
|--------|----------|-------|--------|--------|---------|
| **Retrieval Time** | ${pinecone.retrievalTime.toFixed(2)}ms | ${faiss.retrievalTime.toFixed(2)}ms | ${sqlite.retrievalTime.toFixed(2)}ms | ${calculateWinner(pinecone.retrievalTime, faiss.retrievalTime, sqlite.retrievalTime, false)} | ${calculateMargin(Math.min(pinecone.retrievalTime, faiss.retrievalTime, sqlite.retrievalTime), [pinecone.retrievalTime, faiss.retrievalTime, sqlite.retrievalTime])}ms |
| **Total Query Time** | ${pinecone.totalQueryTime.toFixed(2)}ms | ${faiss.totalQueryTime.toFixed(2)}ms | ${sqlite.totalQueryTime.toFixed(2)}ms | ${calculateWinner(pinecone.totalQueryTime, faiss.totalQueryTime, sqlite.totalQueryTime, false)} | ${calculateMargin(Math.min(pinecone.totalQueryTime, faiss.totalQueryTime, sqlite.totalQueryTime), [pinecone.totalQueryTime, faiss.totalQueryTime, sqlite.totalQueryTime])}ms |
| **Time/Chunk** | ${(pinecone.retrievalTime / pinecone.totalChunks).toFixed(2)}ms | ${(faiss.retrievalTime / faiss.totalChunks).toFixed(2)}ms | ${(sqlite.retrievalTime / sqlite.totalChunks).toFixed(2)}ms | ${calculateWinner(pinecone.retrievalTime / pinecone.totalChunks, faiss.retrievalTime / faiss.totalChunks, sqlite.retrievalTime / sqlite.totalChunks, false)} | - |

---

## 🎯 Chunk Score Distribution

### Pinecone
${generateChunkScoreTable(pinecone.chunks)}

### FAISS
${generateChunkScoreTable(faiss.chunks)}

### SQLite
${generateChunkScoreTable(sqlite.chunks)}

---

## 📈 Performance vs Quality Trade-off

| System | Quality Rank | Speed Rank | Balanced Score* |
|--------|-------------|-----------|----------------|
| Pinecone | ${rankSystem(pinecone.overallScore, faiss.overallScore, sqlite.overallScore)} | ${rankSystem(pinecone.retrievalTime, faiss.retrievalTime, sqlite.retrievalTime, false)} | ${((pinecone.overallScore / 100) * 0.7 + (1 - pinecone.retrievalTime / Math.max(pinecone.retrievalTime, faiss.retrievalTime, sqlite.retrievalTime)) * 0.3).toFixed(3)} |
| FAISS | ${rankSystem(faiss.overallScore, pinecone.overallScore, sqlite.overallScore)} | ${rankSystem(faiss.retrievalTime, pinecone.retrievalTime, sqlite.retrievalTime, false)} | ${((faiss.overallScore / 100) * 0.7 + (1 - faiss.retrievalTime / Math.max(pinecone.retrievalTime, faiss.retrievalTime, sqlite.retrievalTime)) * 0.3).toFixed(3)} |
| SQLite | ${rankSystem(sqlite.overallScore, pinecone.overallScore, faiss.overallScore)} | ${rankSystem(sqlite.retrievalTime, pinecone.retrievalTime, faiss.retrievalTime, false)} | ${((sqlite.overallScore / 100) * 0.7 + (1 - sqlite.retrievalTime / Math.max(pinecone.retrievalTime, faiss.retrievalTime, sqlite.retrievalTime)) * 0.3).toFixed(3)} |

*Balanced Score = (Quality × 0.7) + (Speed × 0.3)

---

## 🏆 Summary

- **Quality Leader:** ${calculateWinner(pinecone.overallScore, faiss.overallScore, sqlite.overallScore)}
- **Speed Leader:** ${calculateWinner(pinecone.retrievalTime, faiss.retrievalTime, sqlite.retrievalTime, false)}
- **Best Precision:** ${calculateWinner(pinecone.precision, faiss.precision, sqlite.precision)}
- **Best Recall:** ${calculateWinner(pinecone.recall, faiss.recall, sqlite.recall)}
- **Most Efficient:** ${calculateWinner(pinecone.retrievalTime / pinecone.totalChunks, faiss.retrievalTime / faiss.totalChunks, sqlite.retrievalTime / sqlite.totalChunks, false)}

---

*This metrics matrix provides quantitative comparison. See comparison_${docId}.md for detailed qualitative analysis.*
`;
}

/**
 * Generate chunk score table
 */
function generateChunkScoreTable(chunks: Array<{ score: number; content: string }>): string {
  if (!chunks || chunks.length === 0) return "No chunks available\n";

  const topChunks = chunks.slice(0, 5);
  let table = "| Rank | Score | Preview |\n|------|-------|----------|\n";

  topChunks.forEach((chunk, idx) => {
    const preview = chunk.content.substring(0, 60).replace(/\n/g, " ") + "...";
    table += `| ${idx + 1} | ${chunk.score.toFixed(4)} | ${preview} |\n`;
  });

  const avgScore = chunks.reduce((sum, c) => sum + c.score, 0) / chunks.length;
  table += `\n**Average Score:** ${avgScore.toFixed(4)}\n`;

  return table;
}

/**
 * Rank a system's value against others
 */
function rankSystem(value: number, other1: number, other2: number, higher: boolean = true): number {
  const values = [value, other1, other2].sort((a, b) => higher ? b - a : a - b);
  return values.indexOf(value) + 1;
}

/**
 * Print comparison summary to console
 */
function printComparisonSummary(
  docId: number,
  pinecone: SystemMetrics,
  faiss: SystemMetrics,
  sqlite: SystemMetrics,
  metricsPath: string,
  comparisonPath: string
): void {
  const scores = [
    { name: "Pinecone", score: pinecone.overallScore, time: pinecone.retrievalTime },
    { name: "FAISS", score: faiss.overallScore, time: faiss.retrievalTime },
    { name: "SQLite", score: sqlite.overallScore, time: sqlite.retrievalTime },
  ];

  const qualityWinner = [...scores].sort((a, b) => b.score - a.score)[0];
  const speedWinner = [...scores].sort((a, b) => a.time - b.time)[0];

  console.log(`\n${"═".repeat(80)}`);
  console.log(`  RAG SYSTEMS COMPREHENSIVE COMPARISON`);
  console.log(`${"═".repeat(80)}`);
  console.log(`  Document ID:     ${docId}`);
  console.log(`  Quality Winner:  ${qualityWinner?.name} (${qualityWinner?.score}/100)`);
  console.log(`  Speed Winner:    ${speedWinner?.name} (${speedWinner?.time.toFixed(2)}ms)`);
  console.log(`${"─".repeat(80)}`);
  console.log(`  Pinecone:  ${pinecone.overallScore}/100  |  ${pinecone.retrievalTime.toFixed(2)}ms  |  P:${pinecone.precision.toFixed(1)}% R:${pinecone.recall.toFixed(1)}% F1:${pinecone.f1Score.toFixed(1)}%`);
  console.log(`  FAISS:     ${faiss.overallScore}/100  |  ${faiss.retrievalTime.toFixed(2)}ms  |  P:${faiss.precision.toFixed(1)}% R:${faiss.recall.toFixed(1)}% F1:${faiss.f1Score.toFixed(1)}%`);
  console.log(`  SQLite:    ${sqlite.overallScore}/100  |  ${sqlite.retrievalTime.toFixed(2)}ms  |  P:${sqlite.precision.toFixed(1)}% R:${sqlite.recall.toFixed(1)}% F1:${sqlite.f1Score.toFixed(1)}%`);
  console.log(`${"─".repeat(80)}`);
  console.log(`  Metrics Matrix:  ${metricsPath}`);
  console.log(`  AI Analysis:     ${comparisonPath}`);
  console.log(`${"═".repeat(80)}\n`);
}
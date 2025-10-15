import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import * as fs from "fs";
import path from "path";

interface RAGApproach {
  name: string;
  outputsDir: string;
}

interface ComparatorParams {
  queryId: number;
  projectPath: string;
  approaches?: RAGApproach[];
  outputDir?: string;
}

const DEFAULT_APPROACHES: RAGApproach[] = [
  { name: "Pinecone", outputsDir: "outputs/rag_outputs" },
  { name: "FAISS", outputsDir: "outputs/faiss_outputs" },
  { name: "SQLite", outputsDir: "outputs/sqlite_outputs" },
  { name: "Keyword Search", outputsDir: "outputs/keyword_search_outputs" },
];

export async function compareSystems(params: ComparatorParams): Promise<void> {
  const {
    queryId,
    projectPath,
    approaches = DEFAULT_APPROACHES,
    outputDir = "outputs/comparison_results",
  } = params;

  try {
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path not found: ${projectPath}`);
    }

    console.log(`Query ${queryId}: Processing...`);

    // Collect all evaluation data
    const approachEvaluations = new Map<string, { content: string; files: string[] }>();

    for (const approach of approaches) {
      const qualityFile = path.join(approach.outputsDir, "quality_evaluation", `${queryId}.md`);
      const timingFile = path.join(approach.outputsDir, "time_consuming", `${queryId}.json`);
      const chunksFile = path.join(approach.outputsDir, "relevant_chunks", `${queryId}.json`);

      if (!fs.existsSync(qualityFile) || !fs.existsSync(timingFile) || !fs.existsSync(chunksFile)) {
        console.warn(`Missing files for ${approach.name}`);
        continue;
      }

      try {
        const qualityContent = fs.readFileSync(qualityFile, "utf-8");
        const timingContent = fs.readFileSync(timingFile, "utf-8");
        const chunksContent = fs.readFileSync(chunksFile, "utf-8");

        const combinedEval = `## ${approach.name}

### Quality Evaluation
${qualityContent}

### Timing Data
\`\`\`json
${timingContent}
\`\`\`

### Relevant Chunks
\`\`\`json
${chunksContent}
\`\`\``;

        approachEvaluations.set(approach.name, {
          content: combinedEval,
          files: [qualityFile, timingFile, chunksFile],
        });
      } catch (error) {
        console.warn(`Failed to load ${approach.name}`);
      }
    }

    if (approachEvaluations.size === 0) {
      throw new Error("No valid approach data found");
    }

    // Combine all evaluations
    const allEvaluations = Array.from(approachEvaluations.values())
      .map((e) => e.content)
      .join("\n\n---\n\n");

    // Send to LLM for analysis
    console.log(`Query ${queryId}: Sending to LLM for analysis...`);
    console.log(`\n[FILES SENT TO LLM]`);
    for (const [name, data] of approachEvaluations) {
      console.log(`  ✓ ${name}:`);
      data.files.forEach((file) => console.log(`    - ${file}`));
    }
    console.log();

    const systemPrompt = `You are an expert RAG (Retrieval-Augmented Generation) system evaluator with deep knowledge of information retrieval metrics and performance analysis.

    Your task is to:
    1. Extract precise numerical metrics from quality evaluations (Precision, Recall, F1-Score, Overall Score)
    2. Parse timing data accurately (retrieval time, total query time in milliseconds/seconds)
    3. Count relevant chunks retrieved by each system
    4. Calculate derived metrics (quality-to-speed ratio, efficiency scores)
    5. Provide objective rankings based on different criteria
    6. Identify meaningful patterns, trade-offs, and performance characteristics

    Important guidelines:
    - Extract EXACT numbers from the provided evaluations - do not estimate or approximate
    - If a metric is missing or unclear, explicitly note it as "N/A" rather than guessing
    - Maintain consistent units across all systems (convert if necessary)
    - Consider both speed and quality when determining "Most Efficient" system
    - Provide actionable insights that help understand which system excels in which scenarios
    - Be objective and data-driven in your analysis

    Output format: Structured markdown with clear tables, rankings, and concise insights.`;

    const userPrompt = `Analyze these RAG system evaluations for Query ID ${queryId} and generate a comprehensive metrics comparison matrix:

${allEvaluations}

    Provide your analysis in the following format:

    # Multi-System RAG Comparison - Query ${queryId}

    ## Quality Metrics Table
    | System | Overall Score | Precision | Recall | F1-Score |
    |--------|---------------|-----------|--------|----------|
    [Fill with data from above]

    ## Performance Metrics Table
    | System | Retrieval Time | Total Time | Chunks Retrieved |
    |--------|----------------|-----------|------------------|
    [Fill with data from above]

    ## Rankings
    - Quality Winner: [System with highest score]
    - Speed Winner: [System with fastest retrieval]
    - Precision Leader: [System with highest precision]
    - Recall Leader: [System with highest recall]
    - Most Efficient: [Best quality-to-speed ratio]

    ## Key Insights
    - [Notable findings from the comparison]
    - [Performance differences]
    - [Trade-offs between approaches]

    Extract exact numbers from the evaluations above to populate the tables.`;

    const { text } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
      maxOutputTokens: 2048,
    });

    // Save metrics file
    const outputDirPath = path.resolve(outputDir);
    if (!fs.existsSync(outputDirPath)) {
      fs.mkdirSync(outputDirPath, { recursive: true });
    }

    const metricsPath = path.join(outputDirPath, `metrics_${queryId}.md`);
    fs.writeFileSync(metricsPath, text, "utf-8");
    console.log(`Query ${queryId}: Metrics saved to ${metricsPath}`);

  } catch (error) {
    console.error(`Query ${queryId}: Error -`, error instanceof Error ? error.message : error);
    throw error;
  }
}

// Runner Code
const queryIds = [1, 2, 3, 4, 5];

async function runComparisons() {
  console.log("Starting RAG System Comparisons...\n");

  for (const queryId of queryIds) {
    try {
      await compareSystems({
        queryId,
        projectPath: "ballerina/",
        outputDir: "outputs/comparison_results",
      });
    } catch (error) {
      console.error(`Failed to process Query ID: ${queryId}:`, error);
    }
  }

  console.log("\nAll comparisons completed!");
}

runComparisons().catch(console.error);
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import fs from "fs";
import path from "path";

interface RelevantChunk {
    id: string;
    content: string;
    score: number;
}

interface UserQuery {
    id: number;
    query: string;
}

interface QualityEvaluation {
    queryId: number;
    query: string;
    evaluation: string;
    score: number;
}

/**
 * Evaluates the quality of retrieved chunks for a given user query.
 */
export async function evaluateChunkQuality(
    userQuery: string,
    chunks: RelevantChunk[],
    balContent: string,
    outputDir: string,
    queryId: string | number
): Promise<QualityEvaluation | null> {
    if (!chunks || chunks.length === 0) {
        console.log(`Query ${queryId}: No chunks found`);
        return null;
    }

    // Build chunks context
    const chunksContext = chunks
        .map(
            (chunk, index) => `### Chunk ${index + 1} (Score: ${chunk.score.toFixed(4)})
**ID:** ${chunk.id}

\`\`\`ballerina
${chunk.content}
\`\`\`
`
        )
        .join("\n");

    // System prompt
    const systemPrompt = `
    You are evaluating the retrieval quality in a BM25 Keyword Search. Assess how well the retrieved chunks align with and support the user query.

    This evaluation is specifically for code generation, where the retrieved chunks are provided to the LLM to generate code.
    Your task is to determine whether these chunks are relevant and sufficient for the LLM to successfully fulfill the user's request.

    <user_query>
    ${userQuery}
    </user_query>

    <project_file_content>
    ${balContent}
    </project_file_content>

    <retrieved_chunks>
    ${chunksContext}
    </retrieved_chunks>

    Provide your evaluation in the following exact format:

    ## User Query
    [Include the full user query here without any changes.]

    ## Chunk Relevance
    [For each chunk, write: "Chunk N: ✓ Relevant" or "Chunk N: ✗ Not Relevant" followed by one brief sentence explaining why.]

    ## Missing Information
    [List any key information missing that should have been retrieved, or write "None" if the retrieval is complete.]

    ## Score: [0-100]

    Scoring Guide:
    - 90–100: Complete, all relevant
    - 70–89: Minor gaps
    - 50–69: Some missing info
    - 30–49: Major gaps
    - 0–29: Mostly irrelevant

    The score must reflect how well the retrieved chunks enable the LLM to generate accurate and complete code that fulfills the user query.

    Keep your response concise, factual, and free of unnecessary text.
    `;

    // Generate evaluation
    const { text } = await generateText({
        model: anthropic("claude-3-5-sonnet-20240620"),
        system: systemPrompt,
        messages: [{ role: "user", content: `Evaluate the retrieval quality for this query.` }],
        maxOutputTokens: 2048,
    });

    // Extract score from the evaluation text
    const scoreMatch = text.match(/##\s*Score:\s*(\d+)/i);
    const score = scoreMatch ? parseInt(scoreMatch[1] ?? "0", 10) : 0;

    const reportContent = `# Retrieval Quality Evaluation
**Query ID:** ${queryId}
**Query:** ${userQuery}

---

${text}

---
**Generated on:** ${new Date().toISOString()}
`;

    // Ensure output directory exists
    const outputDirPath = path.resolve(outputDir);
    if (!fs.existsSync(outputDirPath)) {
        fs.mkdirSync(outputDirPath, { recursive: true });
    }

    const outputPath = path.join(outputDirPath, `${queryId}.md`);
    fs.writeFileSync(outputPath, reportContent, "utf-8");

    console.log(`Query ${queryId}: ✓ Score ${score}/100`);

    return {
        queryId: typeof queryId === "string" ? parseInt(queryId, 10) : queryId,
        query: userQuery,
        evaluation: text,
        score: score,
    };
}

/**
 * Processes an array of user queries to evaluate chunk retrieval quality.
 */
export async function codeQualityEvaluator(userQueries: UserQuery[]) {
    try {
        console.log("Quality evaluation started");

        const chunksDir = path.resolve("./outputs/keyword_search_outputs/keyword_search_result");
        const projectPath = path.resolve("./ballerina");
        const outputDir = path.resolve("./outputs/keyword_search_outputs/quality_evaluation");

        // Load all Ballerina files
        const balFiles = fs.readdirSync(projectPath).filter((f) => f.endsWith(".bal"));
        if (balFiles.length === 0) throw new Error("No .bal files found in project path.");

        const balContent = balFiles
            .map((file) => {
                const content = fs.readFileSync(path.join(projectPath, file), "utf-8");
                return `### File: ${file}
\`\`\`ballerina
${content}
\`\`\`
`;
            })
            .join("\n");

        const evaluations: QualityEvaluation[] = [];

        // Process each user query
        for (const { id, query } of userQueries) {
            console.log(`Query ${id}: Evaluating...`);

            const chunkFilePath = path.join(chunksDir, `${id}.json`);
            if (!fs.existsSync(chunkFilePath)) {
                console.log(`Query ${id}: Chunks file not found`);
                continue;
            }

            const chunks: RelevantChunk[] = JSON.parse(fs.readFileSync(chunkFilePath, "utf-8"));

            const evaluation = await evaluateChunkQuality(query, chunks, balContent, outputDir, id);
            if (evaluation) {
                evaluations.push(evaluation);
            }
        }

        // Generate summary report
        if (evaluations.length > 0) {
            const summaryPath = path.join(outputDir, "summary.json");
            const avgScore = evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length;

            const summary = {
                totalQueries: evaluations.length,
                averageScore: Math.round(avgScore * 100) / 100,
                evaluations: evaluations.map(e => ({
                    queryId: e.queryId,
                    query: e.query,
                    score: e.score
                }))
            };

            fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
            console.log(`✓ Average score: ${summary.averageScore}/100`);
        }

        console.log("✓ All evaluations completed");
    } catch (error) {
        console.error("Error:", error);
    }
}
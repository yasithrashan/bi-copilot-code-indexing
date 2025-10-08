import { generateBalMd } from "./generate-bal";
import { processAllQueries } from "./expand_code";
import { generateCodeForAllQueries } from "./code";

const balFilePath = 'ballerina';

export async function agentWorkflow() {
    try {
        console.log("Starting agent workflow...");

        // Step 1: Generate bal.md file
        console.log("Step 1: Generating bal.md file...");
        await generateBalMd(balFilePath);
        console.log("bal.md file generated successfully");

        // Step 2: Process all queries from Excel
        console.log("Step 2: Processing all user queries...");
        await processAllQueries();

        // Step 3: Process all queries from Excel
        console.log("Step 3: Generating code for all user queries...");
        await generateCodeForAllQueries();

        console.log("All queries processed successfully");

        console.log("Agent workflow completed!");
    } catch (error) {
        console.error("Agent workflow failed:", error);
        throw error;
    }
}
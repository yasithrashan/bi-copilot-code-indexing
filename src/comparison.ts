import { compareSystems } from "./analyse/analyse_by_doc";

const queryIds = [1, 2, 3, 4, 5];

async function runComparisons() {
  console.log("Starting RAG System Comparisons...\n");

  for (const queryId of queryIds) {
    try {
      console.log(`Processing Query ID: ${queryId}`);

      const result = await compareSystems({
        queryId,
        projectPath: "ballerina/",
        outputDir: "outputs/comparison_results",
      });

      console.log(`Completed Query ID: ${queryId}`);
      console.log(`Output: ${result}\n`);
    } catch (error) {
      console.error(`Failed to process Query ID: ${queryId}:`, error);
    }
  }

  console.log("All comparisons completed!");
}

runComparisons().catch(console.error);
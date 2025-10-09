import { compareRAGSystems } from "./analyse/analyse_by_doc";

const docIds = [1, 2, 3, 4, 5];

for (const docId of docIds) {
  await compareRAGSystems({
    docId,
    projectPath: "ballerina/",
    pineconeResultsDir: "outputs/rag_outputs/quality_evaluation",
    faissResultsDir: "outputs/faiss_outputs/quality_evaluation",
    outputDir: "outputs/rag_comparison_results"
  });
}

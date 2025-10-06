import { ragPipeline } from "./rag/main";
import { keywordSearch } from "./keyword-search/main";
import { agentWorkflow } from "./agentic/main";

const balFilePath = process.env.BAL_PROJECT_DIRECTORY;
const voyageApiKey = process.env.VOYAGE_API_KEY;
const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
const pineconeApiKey = process.env.PINECONE_API_KEY || "";

if (!balFilePath) {
	throw new Error("BAL_PROJECT_DIRECTORY environment variable is not set.");
}
if (!voyageApiKey) {
	throw new Error("VOYAGE_API_KEY environment variable is not set.");
}

await ragPipeline(balFilePath, voyageApiKey, pineconeApiKey);
// await keywordSearch();
// await agentWorkflow();

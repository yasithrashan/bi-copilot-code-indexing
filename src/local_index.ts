import { faissPipeline } from "./local-vectors/faiss/faiss_main";
import { sqlitePipeline } from "./local-vectors/sqlite/sqlite_main";

const balFilePath = process.env.BAL_PROJECT_DIRECTORY;
const voyageApiKey = process.env.VOYAGE_API_KEY;

if (!balFilePath) throw new Error("BAL_PROJECT_DIRECTORY environment variable is not set.");

if (!voyageApiKey) throw new Error("VOYAGE_API_KEY environment variable is not set.");

console.log('Running Faiss..')
await faissPipeline(balFilePath, voyageApiKey);

console.log('Running SQLite')
await sqlitePipeline(balFilePath,voyageApiKey);
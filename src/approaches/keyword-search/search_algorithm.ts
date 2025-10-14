import * as fs from "fs";

// Types
interface Chunk {
  id: string;
  content: string;
}

interface BM25Result {
  id: string;
  content: string;
  score: number;
}

// Tokenizer (keep lowercase, preserve underscores and slashes for imports)
function tokenizeUserQuery(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9_/]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Build doc frequency + avg length
function buildIndex(docs: string[]) {
  const tokenizedDocs = docs.map(d => tokenizeUserQuery(d));
  const docFreq = new Map<string, number>();
  let totalLen = 0;

  tokenizedDocs.forEach(doc => {
    totalLen += doc.length;
    const seen = new Set<string>();
    doc.forEach(term => {
      if (!seen.has(term)) {
        docFreq.set(term, (docFreq.get(term) || 0) + 1);
        seen.add(term);
      }
    });
  });

  const avgdl = totalLen / docs.length;
  return { tokenizedDocs, docFreq, avgdl };
}

// Compute IDF
function idf(term: string, docFreq: Map<string, number>, totalDocs: number): number {
  const df = docFreq.get(term) || 0;
  return Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));
}

// BM25 search function - returns all relevant results above threshold
export async function bm25Search(
  jsonPath: string,
  query: string,
  minScore = 0.4,
  k1 = 1.5,
  b = 0.75
): Promise<BM25Result[]> {
  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data = JSON.parse(raw);
  const chunks: Chunk[] = data.chunks;

  const docs = chunks.map(c => c.content);
  const { tokenizedDocs, docFreq, avgdl } = buildIndex(docs);
  const totalDocs = docs.length;

  const qTokens = tokenizeUserQuery(query);

  // Score each doc
  const scores = docs.map((_, idx) => {
    const doc = tokenizedDocs[idx];
    let score = 0;

    if (!doc) {
      return score;
    }

    qTokens.forEach(term => {
      const f = doc.filter(t => t === term).length;
      if (f === 0) return;

      const numerator = f * (k1 + 1);
      const denominator = f + k1 * (1 - b + b * (doc.length / avgdl));
      score += idf(term, docFreq, totalDocs) * (numerator / denominator);
    });

    return score;
  });

  return scores
    .map((score, idx) => {
      const chunk = chunks[idx];
      return {
        id: chunk ? chunk.id : "",
        content: chunk ? chunk.content : "",
        score
      };
    })
    .filter(result => result.score >= minScore)
    .sort((a, b) => b.score - a.score);
}
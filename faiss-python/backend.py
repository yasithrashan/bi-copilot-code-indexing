import os
from dotenv import load_dotenv
import json
import faiss
import numpy as np
import pickle
from typing import List
import voyageai  # Voyage client

# ------------------------------
# File paths
# ------------------------------
INDEX_FILE = "faiss.index"
META_FILE = "metadata.pkl"
RESULTS_FILE = "search_results.txt"

# ------------------------------
# Load environment variables
# ------------------------------
load_dotenv()
api_key = os.getenv("VOYAGE_API_KEY")
if not api_key:
    raise ValueError("VOYAGE_API_KEY not set in .env")

# ------------------------------
# Init Voyage client
# ------------------------------
vo = voyageai.Client(api_key=api_key)
MODEL_NAME = "voyage-code-3"  # Embedding model

# ------------------------------
# Functions
# ------------------------------
def embed_texts(texts: List[str]) -> np.ndarray:
    response = vo.embed(texts, model=MODEL_NAME)
    return np.array(response.embeddings, dtype="float32")

def load_chunks(json_path: str) -> List[dict]:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["chunks"]

def create_or_load_index(dimension: int):
    """Load existing FAISS index, or create a new one if missing or dimension mismatch."""
    rebuild_needed = False
    if os.path.exists(INDEX_FILE):
        print("Loading existing FAISS index...")
        index = faiss.read_index(INDEX_FILE)
        if index.d != dimension:
            print(f"Dimension mismatch (index: {index.d}, embeddings: {dimension}), rebuilding index...")
            rebuild_needed = True
        else:
            with open(META_FILE, "rb") as f:
                metadata = pickle.load(f)
    else:
        rebuild_needed = True

    if rebuild_needed:
        index = faiss.IndexFlatL2(dimension)  # L2 distance
        metadata = []
        # Remove old files if exist
        if os.path.exists(INDEX_FILE):
            os.remove(INDEX_FILE)
        if os.path.exists(META_FILE):
            os.remove(META_FILE)
        print("Created new FAISS index.")

    return index, metadata

def add_chunks_to_index(chunks: List[dict], index, metadata):
    texts = [chunk["content"] for chunk in chunks]
    ids = [chunk["id"] for chunk in chunks]

    # Voyage embeddings
    embeddings = embed_texts(texts)

    if embeddings.shape[1] != index.d:
        raise ValueError(f"Embedding dimension {embeddings.shape[1]} does not match index dimension {index.d}")

    # Add to FAISS
    index.add(embeddings)
    metadata.extend([{"id": cid, "content": ctext} for cid, ctext in zip(ids, texts)])

    # Save index + metadata
    faiss.write_index(index, INDEX_FILE)
    with open(META_FILE, "wb") as f:
        pickle.dump(metadata, f)

    print(f"Added {len(texts)} chunks. Total vectors: {index.ntotal}")

def search(query: str, top_k: int = 5):
    if not os.path.exists(INDEX_FILE):
        raise ValueError("No FAISS index found. Run indexing first.")

    # Load index + metadata
    index = faiss.read_index(INDEX_FILE)
    with open(META_FILE, "rb") as f:
        metadata = pickle.load(f)

    # Voyage query embedding
    q_embedding = embed_texts([query])
    distances, indices = index.search(q_embedding, top_k)

    results = []
    for dist, idx in zip(distances[0], indices[0]):
        if idx < len(metadata):
            results.append({
                "id": metadata[idx]["id"],
                "content": metadata[idx]["content"],
                "distance": float(dist)
            })

    # Save results to file
    with open(RESULTS_FILE, "w", encoding="utf-8") as f:
        for i, r in enumerate(results, 1):
            f.write(f"[{i}] ID: {r['id']} | Distance: {r['distance']:.4f}\n{r['content']}\n\n")

    print(f"Saved {len(results)} relevant chunks to {RESULTS_FILE}")
    return results

# ------------------------------
# Main
# ------------------------------
if __name__ == "__main__":
    # 1. Load chunks from JSON
    json_path = "/Users/yasithrashan/Documents/workspace/wso2/bi-copilot-code-indexing/src/faiss/faiss_outputs/source_code_split.json"
    chunks = load_chunks(json_path)
    print(f"Loaded {len(chunks)} chunks from JSON")

    # 2. Get sample embedding to determine dimension
    sample_embedding = embed_texts([chunks[0]["content"]])
    dim = sample_embedding.shape[1]

    # 3. Create/load FAISS index (auto-rebuild if dimension mismatch)
    index, metadata = create_or_load_index(dim)

    # 4. Add chunks to FAISS
    add_chunks_to_index(chunks, index, metadata)

    # 5. Example search
    query = "Update the pagination logic so it validates 'page' and 'limit' values, returning a 400 Bad Request if they are less than or equal to zero."
    results = search(query, top_k=5)

    print("\nSearch results:")
    for r in results:
        print(f"- {r['id']} | {r['distance']:.4f}\n  {r['content']}\n")

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import json
import faiss
import numpy as np
import pickle
from typing import List, Dict, Any
import voyageai

# ------------------------------
# Configuration
# ------------------------------
app = Flask(__name__)
CORS(app)

INDEX_FILE = "faiss.index"
META_FILE = "metadata.pkl"

load_dotenv()
api_key = os.getenv("VOYAGE_API_KEY")
if not api_key:
    raise ValueError("VOYAGE_API_KEY not set in .env")

vo = voyageai.Client(api_key=api_key)
MODEL_NAME = "voyage-code-3"

# ------------------------------
# Helper Functions
# ------------------------------
def embed_texts(texts: List[str]) -> np.ndarray:
    """Generate embeddings using Voyage API"""
    response = vo.embed(texts, model=MODEL_NAME)
    return np.array(response.embeddings, dtype="float32")

def load_or_create_index(dimension: int):
    """Load existing FAISS index or create new one"""
    if os.path.exists(INDEX_FILE) and os.path.exists(META_FILE):
        try:
            index = faiss.read_index(INDEX_FILE)
            if index.d == dimension:
                with open(META_FILE, "rb") as f:
                    metadata = pickle.load(f)
                print(f"Loaded existing index with {index.ntotal} vectors")
                return index, metadata
            else:
                print(f"Dimension mismatch. Creating new index...")
        except Exception as e:
            print(f"Error loading index: {e}. Creating new index...")

    # Create new index
    index = faiss.IndexFlatL2(dimension)
    metadata = []
    print("Created new FAISS index")
    return index, metadata

def save_index(index, metadata):
    """Save index and metadata to disk"""
    faiss.write_index(index, INDEX_FILE)
    with open(META_FILE, "wb") as f:
        pickle.dump(metadata, f)

# ------------------------------
# API Endpoints
# ------------------------------
@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "FAISS Vector DB"})

@app.route('/create_collection', methods=['POST'])
def create_collection():
    """
    Create/reset the FAISS collection
    Body: { "dimension": 1024 }
    """
    try:
        data = request.json
        dimension = data.get('dimension', 1024)

        # Create new index
        index = faiss.IndexFlatL2(dimension)
        metadata = []

        # Save to disk
        save_index(index, metadata)

        return jsonify({
            "success": True,
            "message": f"Created new collection with dimension {dimension}"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/upsert', methods=['POST'])
def upsert_chunks():
    """
    Upsert chunks with embeddings
    Body: {
        "chunks": [...],  # Array of chunk objects with metadata
        "embeddings": [[...], ...],  # Array of embedding vectors
        "texts": [...]  # Original texts for embedding
    }
    """
    try:
        data = request.json
        chunks = data.get('chunks', [])
        embeddings = data.get('embeddings', [])
        texts = data.get('texts', [])

        if not chunks or not embeddings:
            return jsonify({"success": False, "error": "Missing chunks or embeddings"}), 400

        if len(chunks) != len(embeddings):
            return jsonify({
                "success": False,
                "error": "Chunks and embeddings length mismatch"
            }), 400

        # Convert embeddings to numpy array
        embeddings_array = np.array(embeddings, dtype="float32")
        dimension = embeddings_array.shape[1]

        # Load or create index
        index, metadata = load_or_create_index(dimension)

        # Check dimension compatibility
        if index.d != dimension:
            return jsonify({
                "success": False,
                "error": f"Dimension mismatch: index={index.d}, embeddings={dimension}"
            }), 400

        # Add to FAISS
        start_id = index.ntotal
        index.add(embeddings_array)

        # Store metadata with internal IDs
        for i, (chunk, text) in enumerate(zip(chunks, texts)):
            metadata.append({
                "id": start_id + i,
                "content": chunk.get('content', ''),
                "metadata": chunk.get('metadata', {}),
                "textForEmbedding": text
            })

        # Save to disk
        save_index(index, metadata)

        return jsonify({
            "success": True,
            "message": f"Added {len(chunks)} chunks. Total vectors: {index.ntotal}"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/search', methods=['POST'])
def search_chunks():
    """
    Search for similar chunks
    Body: {
        "query_embedding": [...],  # Query embedding vector
        "top_k": 5  # Number of results to return
    }
    """
    try:
        data = request.json
        query_embedding = data.get('query_embedding', [])
        top_k = data.get('top_k', 5)

        if not query_embedding:
            return jsonify({"success": False, "error": "Missing query_embedding"}), 400

        if not os.path.exists(INDEX_FILE):
            return jsonify({"success": False, "error": "No index found. Please index data first."}), 404

        # Load index and metadata
        index = faiss.read_index(INDEX_FILE)
        with open(META_FILE, "rb") as f:
            metadata = pickle.load(f)

        # Convert query to numpy array
        query_array = np.array([query_embedding], dtype="float32")

        # Search
        distances, indices = index.search(query_array, min(top_k, index.ntotal))

        # Format results
        results = []
        for dist, idx in zip(distances[0], indices[0]):
            if idx < len(metadata) and idx >= 0:
                meta = metadata[idx]
                # Convert L2 distance to similarity score (inverted)
                # Lower distance = higher similarity
                score = 1.0 / (1.0 + float(dist))

                results.append({
                    "score": score,
                    "payload": {
                        "content": meta.get('content', ''),
                        "metadata": meta.get('metadata', {}),
                        "file": meta.get('metadata', {}).get('file', ''),
                        "textForEmbedding": meta.get('textForEmbedding', '')
                    }
                })

        return jsonify({
            "success": True,
            "results": results
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/stats', methods=['GET'])
def get_stats():
    """Get statistics about the index"""
    try:
        if not os.path.exists(INDEX_FILE):
            return jsonify({
                "success": True,
                "total_vectors": 0,
                "dimension": 0
            })

        index = faiss.read_index(INDEX_FILE)
        with open(META_FILE, "rb") as f:
            metadata = pickle.load(f)

        return jsonify({
            "success": True,
            "total_vectors": index.ntotal,
            "dimension": index.d,
            "metadata_count": len(metadata)
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/clear', methods=['POST'])
def clear_index():
    """Clear the entire index"""
    try:
        if os.path.exists(INDEX_FILE):
            os.remove(INDEX_FILE)
        if os.path.exists(META_FILE):
            os.remove(META_FILE)

        return jsonify({
            "success": True,
            "message": "Index cleared successfully"
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------------------
# Main
# ------------------------------
if __name__ == "__main__":
    port = int(os.getenv("FAISS_SERVICE_PORT", 5001))
    print(f"Starting FAISS service on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
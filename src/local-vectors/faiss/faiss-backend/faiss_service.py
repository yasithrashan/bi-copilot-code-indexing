from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv
import json
import faiss
import numpy as np
import pickle
from typing import List, Dict, Any

app = Flask(__name__)
CORS(app)

INDEX_FILE = "faiss.index"
META_FILE = "metadata.pkl"

load_dotenv()

# ============================================
# Helper Functions
# ============================================
def normalize_vector(vector: np.ndarray) -> np.ndarray:
    """Normalize vector to unit length for cosine similarity"""
    norm = np.linalg.norm(vector, axis=1, keepdims=True)
    norm[norm == 0] = 1  # Avoid division by zero
    return vector / norm

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
        except Exception as e:
            print(f"Error loading index: {e}. Creating new index...")

    index = faiss.IndexFlatL2(dimension)
    metadata = []
    print("Created new FAISS index")
    return index, metadata

def save_index(index, metadata):
    """Save index and metadata to disk"""
    faiss.write_index(index, INDEX_FILE)
    with open(META_FILE, "wb") as f:
        pickle.dump(metadata, f)

# ============================================
# API Endpoints
# ============================================
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

        index = faiss.IndexFlatL2(dimension)
        metadata = []

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
    Upsert chunks with normalized embeddings
    Body: {
        "chunks": [...],
        "embeddings": [[...], ...],
        "texts": [...]
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

        # Convert to numpy and normalize
        embeddings_array = np.array(embeddings, dtype="float32")
        embeddings_array = normalize_vector(embeddings_array)
        dimension = embeddings_array.shape[1]

        # Load or create index
        index, metadata = load_or_create_index(dimension)

        if index.d != dimension:
            return jsonify({
                "success": False,
                "error": f"Dimension mismatch: index={index.d}, embeddings={dimension}"
            }), 400

        # Add to FAISS
        start_id = index.ntotal
        index.add(embeddings_array)

        # Store metadata
        for i, (chunk, text) in enumerate(zip(chunks, texts)):
            metadata.append({
                "id": start_id + i,
                "content": chunk.get('content', ''),
                "metadata": chunk.get('metadata', {}),
                "textForEmbedding": text
            })

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
    Search for similar chunks - returns ALL results sorted by score
    Threshold filtering is done on CLIENT SIDE
    Body: {
        "query_embedding": [...]
    }
    """
    try:
        data = request.json
        query_embedding = data.get('query_embedding', [])

        if not query_embedding:
            return jsonify({"success": False, "error": "Missing query_embedding"}), 400

        if not os.path.exists(INDEX_FILE):
            return jsonify({"success": False, "error": "No index found"}), 404

        # Load index and metadata
        index = faiss.read_index(INDEX_FILE)
        with open(META_FILE, "rb") as f:
            metadata = pickle.load(f)

        # Normalize query
        query_array = np.array([query_embedding], dtype="float32")
        query_array = normalize_vector(query_array)

        # Get all vectors and normalize
        all_vectors = index.reconstruct_n(0, index.ntotal)
        all_vectors = normalize_vector(all_vectors)

        # Calculate cosine similarity
        scores = np.dot(all_vectors, query_array.T).flatten()

        # Sort by score (highest first) - NO THRESHOLD FILTERING
        sorted_indices = np.argsort(-scores)

        # Format results
        results = []
        for idx in sorted_indices:
            if idx < len(metadata):
                meta = metadata[idx]
                results.append({
                    "score": float(scores[idx]),
                    "payload": {
                        "content": meta.get('content', ''),
                        "metadata": meta.get('metadata', {}),
                        "file": meta.get('metadata', {}).get('file', ''),
                        "textForEmbedding": meta.get('textForEmbedding', '')
                    }
                })

        return jsonify({
            "success": True,
            "results": results,
            "total_results": len(results)
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

# ============================================
# Main
# ============================================
if __name__ == "__main__":
    port = int(os.getenv("FAISS_SERVICE_PORT", 5001))
    print(f"Starting FAISS service on port {port}...")
    app.run(host="0.0.0.0", port=port, debug=True)
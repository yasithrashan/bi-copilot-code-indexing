# Ballerina Copilot Code Indexing POC

A proof-of-concept implementation exploring multiple approaches for intelligent code indexing and retrieval in Ballerina projects. This repository compares the effectiveness of agentic workflows, keyword-based search, and vector-based RAG systems for code understanding and generation.

## Project Overview

This POC evaluates distinct methodologies for code intelligence:

1. **Agentic Approach** - AI agents with specialized tools for code analysis and documentation
2. **Keyword Search** - Traditional BM25-based text search with semantic ranking
3. **Vector RAG** - Embedding-based semantic search with retrieval-augmented generation
4. **Local Vector Storage** - SQLite with vector extensions and FAISS for offline processing

## Architecture

```
src/
├── approaches/
│   ├── agentic/          # Agent-based code intelligence
│   ├── keyword-search/   # BM25 + semantic search
│   └── rag/             # Vector embeddings + RAG
├── shared/              # Common utilities and types
├── local-vectors/       # Local SQLite vector storage with FAISS
└── analyse/            # Evaluation and comparison tools
```

## Vector Storage Options

The system supports multiple vector storage backends:

- **Qdrant** - Production-ready vector database
- **Pinecone** - Cloud-based vector service
- **SQLite + sqlite-vec** - Local vector storage with SQL interface
- **FAISS** - Facebook AI Similarity Search for local indexing

## Quick Start

### Prerequisites
- **Runtime**: Bun/Node.js
- **APIs**: Anthropic API key
- **Vector Storage**: VoyageAI + Qdrant/Pinecone (for cloud RAG)
- **Local Storage**: SQLite with vector extensions, FAISS (for local processing)

### Installation
```bash
# Clone and install dependencies
bun install
```

### Environment Configuration
```bash
# Required for all approaches
ANTHROPIC_API_KEY="your_anthropic_key"
BAL_PROJECT_DIRECTORY="/path/to/ballerina/project"

# Required for cloud Vector RAG approach
VOYAGE_API_KEY="your_voyage_key"
PINECONE_API_KEY="your_pinecone_key"  # Optional: use Qdrant instead
QDRANT_URL="http://localhost:6333"    # Optional: use Pinecone instead
```

## Usage

### Run Individual Approaches
```bash
# Run all approaches (default: RAG + Keyword Search)
bun start

# Run with local vector storage (SQLite + FAISS)
bun run start:local

# Run comparison analysis
bun run start:comparison
```

### Start Vector Database (if using Qdrant)
```bash
docker run -p 6333:6333 qdrant/qdrant
```

## Approach Comparison

| Approach | Best For | Storage | Strengths | Limitations |
|----------|----------|---------|-----------|-------------|
| **Agentic** | Complex workflows, documentation | Memory | Context-aware, reasoning | Higher latency |
| **Keyword Search** | Quick lookups, exact matches | In-memory | Fast, reliable | Limited semantics |
| **Vector RAG (Cloud)** | Semantic queries, similarity | Qdrant/Pinecone | Deep understanding | Setup complexity |
| **Local Vectors** | Offline processing, privacy | SQLite + FAISS | No external deps | Limited scalability |

## Key Files

- `src/index.ts` - Main entry point for cloud-based approaches
- `src/local_index.ts` - Local vector storage with SQLite and FAISS
- `src/comparison.ts` - Comparative analysis between approaches
- `outputs/` - Generated results and analysis reports
- `vector_database.db` - Local SQLite vector database
- `user_queries.txt` - Sample queries for testing

## Evaluation

The POC includes comprehensive evaluation metrics:
- **Relevance scoring** for retrieved code chunks
- **Response quality** assessment
- **Performance timing** analysis
- **Comparative studies** across approaches

Results are stored in `outputs/comparison_results/` with detailed metrics and analysis.

## Development

### Key Dependencies
- `@anthropic-ai/sdk` - AI model integration
- `@qdrant/js-client-rest` - Cloud vector database
- `better-sqlite3` - Local SQLite database
- `sqlite-vec` - Vector extensions for SQLite
- `axios` - HTTP client for external APIs

### Project Structure
- TypeScript with Bun runtime
- Modular approach-specific implementations
- Shared utilities for code parsing and analysis
- Local and cloud vector storage options
- Comprehensive evaluation framework

---

**Status**: Active POC evaluating code indexing approaches for Ballerina projects with both cloud and local storage options.
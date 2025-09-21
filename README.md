# Ballerina Copilot Code Indexing - Multi-Modal Code Intelligence

A comprehensive AI-powered Ballerina code assistant that combines three complementary approaches for intelligent code generation, analysis, and retrieval.

## Architecture

The system integrates three proven methodologies:

1. **Agentic Indexing** - Context-aware documentation and code generation
2. **Keyword Search** - BM25-based semantic code retrieval
3. **Vector RAG** - Embedding-based semantic search and AI generation

## Quick Start

### Prerequisites
- Node.js/Bun runtime
- Anthropic API key
- VoyageAI API key (for vector approach)
- Qdrant server (for vector approach)

### Installation
```bash
bun install
bun add ai @ai-sdk/anthropic @anthropic-ai/sdk @qdrant/js-client-rest
```

### Environment Setup
```bash
export ANTHROPIC_API_KEY="your_key"
export VOYAGE_API_KEY="your_key"        # Vector approach only
export QDRANT_URL="http://localhost:6333"  # Vector approach only
```

## Usage Modes

### 1. Agentic Mode
Best for: New projects, comprehensive documentation, structured workflows

### 2. Keyword Search Mode
Best for: Quick code retrieval, pattern matching, existing codebases

### 3. Vector RAG Mode
Best for: Semantic understanding, complex queries, intelligent code relationships

```bash
# Start Qdrant server
docker run -p 6333:6333 qdrant/qdrant
```
---

**Note**: This unified system provides flexibility to choose the optimal approach for your specific use case while maintaining simplicity and clean architecture.
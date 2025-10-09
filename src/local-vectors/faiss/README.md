# User Guide: FAISS Local Vector DB

## Architecture Overview

```
┌─────────────────────┐         HTTP API         ┌─────────────────────┐
│  TypeScript RAG     │ ──────────────────────>  │  Python FAISS       │
│  Pipeline           │                          │  Service (Flask)    │
│                     │ <──────────────────────  │                     │
│  - Chunking         │                          │  - FAISS Index      │
│  - Embeddings       │                          │  - Vector Search    │
│  - Query Processing │                          │  - Persistence      │
└─────────────────────┘                          └─────────────────────┘
```

## Setup Instructions

### 1. Python FAISS Service Setup

#### Install Python dependencies:
```bash
cd python_service
pip install -r requirements.txt
```

#### Create `.env` file:
```bash
VOYAGE_API_KEY=your_voyage_api_key_here
FAISS_SERVICE_PORT=5000
```

#### Start the FAISS service:
```bash
python faiss_service.py
```

The service will run on `http://localhost:5000`

### 2. TypeScript Project Setup

#### Update your `.env` file:
```bash
VOYAGE_API_KEY=your_voyage_api_key_here
FAISS_SERVICE_URL=http://localhost:5000
```
# Co.meta RAG System

This module implements a Retrieval-Augmented Generation (RAG) system for the Co.meta chatbot, enhancing its responses with information from a vector database of relevant documentation.

## Overview

The RAG system improves the chatbot's responses by:

1. Retrieving relevant documentation based on the user's query
2. Augmenting the prompt to the LLM with this context
3. Generating more accurate and helpful responses

## Components

The RAG system consists of the following components:

### 1. Vector Store

- Uses ChromaDB for storing and retrieving document embeddings
- Supports persistent storage of embeddings
- Provides methods for adding, querying, and deleting documents

### 2. Embedding Model

- Uses IBM Granite Embedding model for generating embeddings
- Handles batching and error recovery for efficient processing
- Supports CPU and GPU inference

### 3. Document Processor

- Loads documents from various formats (PDF, Markdown, HTML, text)
- Chunks documents into manageable pieces
- Cleans and normalizes text
- Generates embeddings and stores in vector database

### 4. RAG Engine

- Retrieves relevant context based on user queries
- Creates augmented prompts with retrieved context
- Formats context for optimal LLM consumption

### 5. Django Integration

- Models for tracking documents and chunks
- Admin interface for managing documents
- API endpoints for querying the RAG system
- Management commands for ingesting documents

## Usage

### Ingesting Documents

To add documents to the RAG system, use the `ingest_document` management command:

```bash
python manage.py ingest_document /path/to/document.pdf --title "Document Title" --description "Document description"
```

Options:
- `--title`: Document title (default: filename)
- `--type`: Document type (pdf, markdown, html, text) (default: auto-detect)
- `--description`: Document description
- `--chunk-size`: Chunk size in characters (default: 1000)
- `--chunk-overlap`: Chunk overlap in characters (default: 200)

### Testing the RAG System

To test the RAG system with a query:

```bash
python manage.py test_rag "How do I create a new test in Co.meta?" --top-k 5
```

Options:
- `--top-k`: Number of results to retrieve (default: 5)
- `--json`: Output as JSON

### Using the RAG API

The RAG system exposes an API endpoint for querying:

```
POST /api/rag/query/
```

Request body:
```json
{
  "query": "How do I create a new test?",
  "top_k": 5
}
```

Response:
```json
{
  "success": true,
  "data": {
    "query": "How do I create a new test?",
    "has_context": true,
    "system_prompt": "...",
    "context_docs": [
      {
        "id": "...",
        "content": "...",
        "metadata": { ... },
        "relevance_score": 0.95
      },
      ...
    ]
  }
}
```

### Chatbot Integration

The RAG system is integrated with the Co.meta chatbot. Users can control RAG features with the following commands:

- `/rag on` or `/rag enable`: Enable RAG for enhanced responses
- `/rag off` or `/rag disable`: Disable RAG
- `/rag debug on`: Show RAG debug information with responses
- `/rag debug off`: Hide RAG debug information

## Configuration

The RAG system can be configured through environment variables:

- `CHROMA_PERSIST_DIRECTORY`: Path to store ChromaDB data (default: `data/chromadb`)
- `EMBEDDING_MODEL`: Name of the embedding model to use (default: `ibm/granite-embedding-base-v2`)
- `RAG_CHUNK_SIZE`: Default chunk size for documents (default: 1000)
- `RAG_CHUNK_OVERLAP`: Default chunk overlap (default: 200)
- `RAG_TOP_K`: Default number of results to retrieve (default: 5)

## Development

### Adding New Document Types

To add support for a new document type:

1. Add a new document type constant in the `Document` model
2. Implement a loader method in the `DocumentProcessor` class
3. Update the document type detection logic

### Using a Different Embedding Model

To use a different embedding model:

1. Create a new subclass of `EmbeddingModel`
2. Implement the `get_embeddings` method
3. Update the `get_embedder` factory function

## Troubleshooting

### Common Issues

- **Out of Memory Errors**: Reduce batch size or use a smaller embedding model
- **Slow Queries**: Check index size and consider optimizing chunk size
- **Missing Context**: Ensure documents are properly ingested and chunked

### Logs

The RAG system logs information to the standard Django logger. Check the logs for detailed information about document processing, embedding generation, and query processing. 
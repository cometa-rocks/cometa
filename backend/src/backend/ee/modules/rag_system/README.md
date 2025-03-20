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
- Lets ChromaDB handle embeddings internally to avoid dimension mismatches

### 2. Embedding Model

- Uses Ollama with the `granite3.1-dense` model for ChromaDB's internal embeddings
- No custom embedding generation is used - all embedding handled by ChromaDB
- Consistent embedding generation across document ingestion and querying

### 3. Document Processor

- Loads documents from various formats (PDF, Markdown, HTML, text)
- Chunks documents into manageable pieces
- Cleans and normalizes text
- Generates embeddings and stores in vector database

### 4. RAG Engine

- Retrieves relevant context based on user queries
- Creates augmented prompts with retrieved context
- Formats context for optimal LLM consumption
- Consistently converts distance metrics to similarity/relevance scores

### 5. Django Integration

- Models for tracking documents and chunks
- Admin interface for managing documents
- Integration with the Co.meta chat completion API
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

### Using the Chat Completion API

The RAG system is integrated directly into the chat completion API:

```
POST /api/chat/completion/
```

Request body:
```json
{
  "message": "How do I create a new test?",
  "history": [
    {"text": "Hello", "isUser": true},
    {"text": "Hi there! How can I help you today?", "isUser": false}
  ]
}
```

The backend will automatically use RAG to enhance responses. The system handles document retrieval and context integration internally.

## Configuration

The RAG system can be configured through environment variables:

- `CHROMA_PERSIST_DIRECTORY`: Path to store ChromaDB data (default: `data/chromadb`)
- `OLLAMA_HOST`: Host for the Ollama API (default: `http://cometa-ollama.ai-1:8083`)
- `OLLAMA_PORT`: Port for the Ollama API (default: `8083`)
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

1. Update the `RAG_MODEL` constant in `embeddings.py`
2. Ensure the model is available in your Ollama instance
3. The system will automatically use the new model for all embedding operations

## Troubleshooting

### Common Issues

- **Dimension Mismatches**: The system uses ChromaDB's internal embedding handling to avoid dimension mismatches
- **Slow Queries**: Check index size and consider optimizing chunk size or adjusting HNSW parameters
- **Missing Context**: Ensure documents are properly ingested and chunked
- **Ollama Connection Issues**: Verify that Ollama is running and the model is available

### Logs

The RAG system logs detailed information to the standard Django logger. Check the logs for information about document processing, embedding generation, and query processing, including specific distance/similarity scores for retrieved documents. 
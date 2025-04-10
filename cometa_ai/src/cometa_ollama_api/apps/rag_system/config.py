"""
Configuration settings for the RAG (Retrieval-Augmented Generation) system.
This module centralizes all configurable parameters for the RAG system.
"""

# Model Configuration
RAG_MODEL = "granite3.2"
CHATBOT_MODEL_NAME = "granite3.2"

# RAG Engine Configuration
DEFAULT_TOP_K = 5
MIN_RELEVANCE_THRESHOLD = 0.2
DEFAULT_NUM_RESULTS = 3
INITIAL_K_MULTIPLIER = 2  # Initial k = max(10, top_k * INITIAL_K_MULTIPLIER)
MIN_INITIAL_K = 10

# Vector Store Configuration
DEFAULT_CHROMA_PATH = "/app/data/chromadb"
DEFAULT_COLLECTION_NAME = "cometa_docs"

# Vector Store HNSW Parameters (Hierarchical Navigable Small World)
HNSW_SPACE = "cosine"
HNSW_CONSTRUCTION_EF = 128
HNSW_SEARCH_EF = 96
HNSW_M = 16

# Document Chunking Configuration
CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
MAX_OVERLAP_RATIO = 0.25  # Limit overlap to 25% of chunk size

# Default System Prompt for RAG
DEFAULT_SYSTEM_PROMPT = """
You are a helpful AI assistant for Co.meta, a software testing platform. 
If you don't know the answer based on the context, say so - 
DO NOT make up information. 
RESPOND USING MARKDOWN FORMAT
"""

# Redis Configuration
REDIS_CHATBOT_QUEUE_NAME = "chatbot_queue"
JOB_TIMEOUT = 60
MAX_WAIT_TIME = 30
POLL_INTERVAL = 0.5

# Ollama API Configuration
OLLAMA_TEMPERATURE = 0.0
OLLAMA_TOP_P = 0.95
OLLAMA_TOP_K = 100
OLLAMA_NUM_PREDICT = 3000 
OLLAMA_NUM_CTX = 6000
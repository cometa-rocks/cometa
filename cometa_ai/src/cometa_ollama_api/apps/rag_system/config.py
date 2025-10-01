"""
Configuration settings for the RAG (Retrieval-Augmented Generation) system.
This module centralizes all configurable parameters for the RAG system.
"""

# Model Configuration
# Use ChromaDB's built-in embedder when no external model is configured
RAG_MODEL = None
# Chatbot LLM (served by Ollama)
CHATBOT_MODEL_NAME = "granite3.3:8b"

# RAG Engine Configuration
DEFAULT_TOP_K = 8  # Increased from 5 for better recall
MIN_RELEVANCE_THRESHOLD = 0.4  # Increased from 0.2 for better precision
DEFAULT_NUM_RESULTS = 5  # Increased from 3 for more context
INITIAL_K_MULTIPLIER = 3  # Increased for better initial retrieval
MIN_INITIAL_K = 15  # Increased from 10

# Vector Store Configuration
DEFAULT_CHROMA_PATH = "/app/data/chromadb"
DEFAULT_COLLECTION_NAME = "cometa_docs"

# Vector Store HNSW Parameters (Hierarchical Navigable Small World)
HNSW_SPACE = "cosine"
HNSW_CONSTRUCTION_EF = 256  # Increased for better index quality
HNSW_SEARCH_EF = 128  # Increased for better search quality
HNSW_M = 32  # Increased for better connectivity

# Document Chunking Configuration
CHUNK_SIZE = 1500  # Increased from 1000 for better context
CHUNK_OVERLAP = 300  # Increased from 200 for better continuity
MAX_OVERLAP_RATIO = 0.3  # Increased from 0.25

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

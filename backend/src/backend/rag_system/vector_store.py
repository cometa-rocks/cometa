"""
Vector store integration using ChromaDB for Co.meta RAG system.
"""
import os
import logging
import shutil
from typing import Optional, Dict, List, Any, Union
import chromadb
from chromadb.config import Settings
from django.conf import settings
import numpy as np

logger = logging.getLogger(__name__)

# Update the default path to use the Docker container's data directory
DEFAULT_CHROMA_PATH = "/opt/code/data/chromadb"

class VectorStore:
    """ChromaDB vector store for document embeddings."""
    
    def __init__(self, 
                 persistent_path: Optional[str] = None, 
                 collection_name: str = "cometa_docs"):
        """
        Initialize the vector store.
        
        Args:
            persistent_path: Path to store ChromaDB data. If None, uses in-memory storage.
            collection_name: Name of the collection to use.
        """
        self.persistent_path = persistent_path or os.environ.get('CHROMA_PATH', DEFAULT_CHROMA_PATH)
        self.collection_name = collection_name
        self.client = None
        self.collection = None
        
        # Initialize ChromaDB
        self._initialize_client()
        self._initialize_collection()
        
    def _initialize_client(self) -> None:
        """Initialize the ChromaDB client."""
        try:
            # Ensure directory exists for persistent storage
            if self.persistent_path:
                os.makedirs(self.persistent_path, exist_ok=True)
                logger.info(f"Using persistent ChromaDB at: {self.persistent_path}")
                
                # Check for SQLite file - if it's there but corrupted, recreate it
                sqlite_file = os.path.join(self.persistent_path, "chroma.sqlite3")
                if os.path.exists(sqlite_file):
                    try:
                        # Try to initialize with existing database
                        self.client = chromadb.PersistentClient(path=self.persistent_path)
                    except ValueError as e:
                        if "Could not connect to tenant" in str(e):
                            logger.warning(f"Existing ChromaDB appears corrupted, recreating: {e}")
                            
                            # Backup the corrupted file just in case
                            if os.path.exists(sqlite_file):
                                backup_path = f"{sqlite_file}.bak"
                                try:
                                    shutil.copy2(sqlite_file, backup_path)
                                    logger.info(f"Backed up corrupted database to {backup_path}")
                                except Exception as backup_error:
                                    logger.warning(f"Could not create backup: {backup_error}")
                            
                            # Remove all files in the persistent path
                            try:
                                for item in os.listdir(self.persistent_path):
                                    item_path = os.path.join(self.persistent_path, item)
                                    if os.path.isfile(item_path):
                                        os.remove(item_path)
                                    elif os.path.isdir(item_path):
                                        shutil.rmtree(item_path)
                                logger.info(f"Cleared ChromaDB directory: {self.persistent_path}")
                            except Exception as clear_error:
                                logger.warning(f"Error clearing ChromaDB directory: {clear_error}")
                            
                            # Create a fresh client
                            self.client = chromadb.PersistentClient(path=self.persistent_path)
                            logger.info("Created fresh ChromaDB client")
                        else:
                            raise
                else:
                    # Normal initialization for new database
                    self.client = chromadb.PersistentClient(path=self.persistent_path)
            else:
                logger.warning("Using in-memory ChromaDB - data will be lost when server restarts")
                self.client = chromadb.Client()
        except Exception as e:
            logger.error(f"Error initializing ChromaDB client: {e}")
            # Fall back to in-memory client if persistent fails
            logger.warning("Falling back to in-memory ChromaDB client")
            try:
                self.client = chromadb.Client()
            except Exception as fallback_error:
                logger.error(f"Could not create fallback in-memory client: {fallback_error}")
                raise
            
    def _initialize_collection(self) -> None:
        """Initialize or get the ChromaDB collection."""
        try:
            if not self.client:
                raise ValueError("ChromaDB client not initialized")
                
            # Try to get existing collection
            try:
                self.collection = self.client.get_collection(self.collection_name)
                logger.info(f"Using existing collection: {self.collection_name}")
            except Exception as get_error:
                # Create new collection if it doesn't exist
                logger.info(f"Collection not found, creating new: {self.collection_name} ({get_error})")
                self.collection = self.client.create_collection(
                    name=self.collection_name,
                    metadata={
                        "hnsw:space": "cosine",  # Similarity metric
                        "hnsw:construction_ef": 100,  # Trade-off: build time vs. accuracy
                        "hnsw:search_ef": 50,  # Trade-off: query time vs. accuracy
                        "hnsw:M": 16  # Trade-off: memory usage vs. accuracy
                    }
                )
                logger.info(f"Created new collection: {self.collection_name}")
        except Exception as e:
            logger.error(f"Error initializing ChromaDB collection: {e}")
            raise
            
    def add_documents(self, 
                      ids: List[str], 
                      embeddings: List[List[float]], 
                      documents: List[str], 
                      metadatas: Optional[List[Dict[str, Any]]] = None) -> None:
        """
        Add documents to the vector store.
        
        Args:
            ids: Unique identifiers for the documents
            embeddings: Document embeddings
            documents: Document text content
            metadatas: Optional metadata for each document
        """
        try:
            if not self.collection:
                self._initialize_collection()
                
            self.collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas
            )
            logger.info(f"Added {len(ids)} documents to vector store")
        except Exception as e:
            logger.error(f"Error adding documents to vector store: {e}")
            raise
            
    def query(self, 
              query_text: str = None,
              query_embedding: List[float] = None, 
              n_results: int = 3, 
              where: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Query the vector store for similar documents.
        
        Args:
            query_text: Text query (will be converted to embedding if query_embedding not provided)
            query_embedding: Embedding vector for the query
            n_results: Number of results to return
            where: Optional filter for the query
            
        Returns:
            Dictionary with query results
        """
        try:
            if not self.collection:
                self._initialize_collection()
                
            if query_embedding is None and query_text is None:
                raise ValueError("Either query_text or query_embedding must be provided")
                
            results = self.collection.query(
                query_embeddings=[query_embedding] if query_embedding is not None else None,
                query_texts=[query_text] if query_text is not None else None,
                n_results=n_results,
                where=where,
                include=["documents", "metadatas", "distances", "embeddings"]
            )
            return results
        except Exception as e:
            logger.error(f"Error querying vector store: {e}")
            raise
            
    def get_collection_count(self) -> int:
        """Get the number of documents in the collection."""
        try:
            if not self.collection:
                self._initialize_collection()
            return self.collection.count()
        except Exception as e:
            logger.error(f"Error getting collection count: {e}")
            return 0

    def reset_collection(self) -> None:
        """Reset the collection (delete all documents)."""
        try:
            if self.collection:
                self.client.delete_collection(self.collection_name)
            self._initialize_collection()
            logger.warning(f"Reset collection: {self.collection_name}")
        except Exception as e:
            logger.error(f"Error resetting collection: {e}")
            raise
            
    def delete_collection(self) -> None:
        """Delete the collection entirely."""
        try:
            if self.client:
                try:
                    self.client.delete_collection(self.collection_name)
                    logger.warning(f"Deleted collection: {self.collection_name}")
                except Exception as e:
                    logger.error(f"Error deleting collection: {e}")
            
            # Re-initialize the client and collection to ensure database structure is recreated
            self._initialize_client()
            self._initialize_collection()
            
            self.collection = None
        except Exception as e:
            logger.error(f"Error in delete_collection: {e}")
            raise

# Singleton instance for app-wide use
_vector_store_instance = None

def get_vector_store(persistent_path: Optional[str] = None, 
                     collection_name: str = "cometa_docs") -> VectorStore:
    """
    Get a singleton instance of the vector store.
    
    Args:
        persistent_path: Path for persistent storage (only used if instance doesn't exist)
        collection_name: Collection name (only used if instance doesn't exist)
        
    Returns:
        VectorStore instance
    """
    global _vector_store_instance
    if _vector_store_instance is None:
        _vector_store_instance = VectorStore(
            persistent_path=persistent_path,
            collection_name=collection_name
        )
    return _vector_store_instance
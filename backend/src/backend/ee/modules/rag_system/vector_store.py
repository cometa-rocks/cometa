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
            
            # Log collection info
            try:
                collection_info = self.client.get_collection(self.collection_name)
                logger.info(f"Collection name: {self.collection_name}")
                logger.info(f"Collection count: {collection_info.count()}")
                # Try to get dimensionality from collection
                metadata = collection_info.metadata()
                if metadata:
                    logger.info(f"Collection metadata: {metadata}")
            except Exception as e:
                logger.warning(f"Could not retrieve collection info: {e}")
            
            # IMPORTANT: If text query is provided but no embedding, set query_text to None
            # and let ChromaDB handle the embedding generation internally.
            # This avoids dimension mismatch issues when using different embedders.
            if query_text is not None and query_embedding is None:
                logger.info(f"Using text query directly without pre-computing embedding: {query_text}")
                use_query_text = True
                use_query_embedding = False
            elif query_embedding is not None:
                # Log query embedding information
                embedding_dim = len(query_embedding)
                logger.info(f"Query embedding dimension: {embedding_dim}")
                embedding_array = np.array(query_embedding)
                logger.info(f"Query embedding stats - Min: {embedding_array.min():.4f}, Max: {embedding_array.max():.4f}, Mean: {embedding_array.mean():.4f}")
                use_query_text = False
                use_query_embedding = True
            
            try:
                # If we have a pre-computed embedding, use it; otherwise use query_text directly
                results = self.collection.query(
                    query_embeddings=[query_embedding] if use_query_embedding else None,
                    query_texts=[query_text] if use_query_text else None,
                    n_results=n_results,
                    where=where,
                    include=["documents", "metadatas", "distances", "embeddings"]
                )
                # Log query results info
                if results:
                    # Safely handle documents array
                    if 'documents' in results and isinstance(results['documents'], list) and len(results['documents']) > 0:
                        doc_list = results['documents'][0]
                        docs_count = len(doc_list) if isinstance(doc_list, list) else 0
                        logger.info(f"Query returned {docs_count} results")
                    else:
                        logger.info("Query returned no documents")
                        
                    # Safely handle embeddings array
                    if 'embeddings' in results and isinstance(results['embeddings'], list) and len(results['embeddings']) > 0:
                        if isinstance(results['embeddings'][0], list) and len(results['embeddings'][0]) > 0:
                            if isinstance(results['embeddings'][0][0], (list, np.ndarray)):
                                result_embedding_dim = len(results['embeddings'][0][0])
                                logger.info(f"Result embedding dimension: {result_embedding_dim}")
                return results
            except Exception as e:
                logger.error(f"Error querying vector store: {e}")
                # Add more detailed error information
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                if "dimension" in str(e).lower():
                    logger.error(f"Dimension mismatch detected. Query embedding dim: {len(query_embedding) if query_embedding else 'N/A'}")
                    # Try to get collection dimension
                    try:
                        # Check first document in collection to get dimension
                        peek_results = self.collection.peek(limit=1)
                        if peek_results and 'embeddings' in peek_results and peek_results['embeddings']:
                            # Make sure we safely handle the embedding array
                            if isinstance(peek_results['embeddings'], list) and len(peek_results['embeddings']) > 0:
                                collection_dim = len(peek_results['embeddings'][0])
                                logger.error(f"Collection dimension from peek: {collection_dim}")
                    except Exception as peek_error:
                        logger.error(f"Could not peek collection: {peek_error}")
                raise
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
            
    def diagnose_dimension_mismatch(self, test_query_embedding=None) -> Dict[str, Any]:
        """
        Diagnose dimension mismatch issues between embeddings and collection.
        
        Args:
            test_query_embedding: Optional test embedding to compare with collection
            
        Returns:
            Dictionary with diagnostic information
        """
        logger.info("Running vector store dimension mismatch diagnostics...")
        
        diagnostics = {
            "collection_name": self.collection_name,
            "collection_exists": False,
            "collection_count": 0,
            "collection_dim": None,
            "test_query_dim": None if test_query_embedding is None else len(test_query_embedding),
            "dimension_mismatch": False,
            "issues_found": []
        }
        
        try:
            if not self.collection:
                logger.warning("Collection not initialized")
                diagnostics["issues_found"].append("Collection not initialized")
                return diagnostics
                
            # Check if collection exists and has documents
            diagnostics["collection_exists"] = True
            count = self.collection.count()
            diagnostics["collection_count"] = count
            
            if count == 0:
                logger.warning("Collection is empty - no documents to check dimensions")
                diagnostics["issues_found"].append("Collection is empty")
                return diagnostics
            
            # Try to get embedding dimension from collection
            try:
                peek_results = self.collection.peek(limit=1)
                # Safely handle embeddings array
                if peek_results and 'embeddings' in peek_results:
                    if isinstance(peek_results['embeddings'], list) and len(peek_results['embeddings']) > 0:
                        diagnostics["collection_dim"] = len(peek_results['embeddings'][0])
                        logger.info(f"Collection has embedding dimension: {diagnostics['collection_dim']}")
                        
                        # Check for dimension mismatch
                        if test_query_embedding is not None:
                            if len(test_query_embedding) != diagnostics["collection_dim"]:
                                diagnostics["dimension_mismatch"] = True
                                logger.error(f"Dimension mismatch detected: Query dim = {len(test_query_embedding)}, Collection dim = {diagnostics['collection_dim']}")
                                diagnostics["issues_found"].append(f"Dimension mismatch: {len(test_query_embedding)} vs {diagnostics['collection_dim']}")
            except Exception as peek_error:
                logger.error(f"Error getting collection dimensions: {peek_error}")
                diagnostics["issues_found"].append(f"Error getting collection dimensions: {str(peek_error)}")
            
            return diagnostics
            
        except Exception as e:
            logger.error(f"Error in diagnose_dimension_mismatch: {e}")
            diagnostics["issues_found"].append(f"Diagnostic error: {str(e)}")
            return diagnostics

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
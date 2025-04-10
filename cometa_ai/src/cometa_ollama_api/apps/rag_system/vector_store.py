"""
Vector store integration using ChromaDB for Co.meta RAG system.
"""
import os
import logging
import shutil
from typing import Optional, Dict, List, Any, Union
import chromadb
import numpy as np

from apps.rag_system.config import (
    RAG_MODEL,
    DEFAULT_CHROMA_PATH,
    DEFAULT_COLLECTION_NAME,
    HNSW_SPACE,
    HNSW_CONSTRUCTION_EF,
    HNSW_SEARCH_EF,
    HNSW_M
)

logger = logging.getLogger(__name__)

class VectorStore:
    """ChromaDB vector store for document embeddings."""
    
    def __init__(self, 
                 persistent_path: Optional[str] = None, 
                 collection_name: str = DEFAULT_COLLECTION_NAME):
        """
        Initialize the vector store.
        
        Args:
            persistent_path: Path to store ChromaDB data. If None, uses in-memory storage.
            collection_name: Name of the collection to use.
        """
        logger.info(f"Initializing VectorStore with persistent_path={persistent_path}, collection_name={collection_name}")
        self.persistent_path = persistent_path or DEFAULT_CHROMA_PATH
        self.collection_name = collection_name
        self.client = None
        self.collection = None
        logger.info(f"Actual persistent_path set to: {self.persistent_path}")
        
        # Initialize ChromaDB
        self._initialize_client()
        self._initialize_collection()
        logger.info(f"VectorStore initialization complete for collection: {self.collection_name}")
        
    def _initialize_client(self) -> None:
        """Initialize the ChromaDB client."""
        logger.info(f"Starting ChromaDB client initialization with path: {self.persistent_path}")
        try:
            # Ensure directory exists for persistent storage
            if self.persistent_path:
                os.makedirs(self.persistent_path, exist_ok=True)
                logger.info(f"Using persistent ChromaDB at: {self.persistent_path}, directory exists: {os.path.exists(self.persistent_path)}")
                
                # Check for SQLite file - if it's there but corrupted, recreate it
                sqlite_file = os.path.join(self.persistent_path, "chroma.sqlite3")
                sqlite_exists = os.path.exists(sqlite_file)
                logger.info(f"Checking SQLite file: {sqlite_file}, exists: {sqlite_exists}")
                if sqlite_exists:
                    try:
                        # Try to initialize with existing database
                        logger.info(f"Attempting to initialize client with existing database: {sqlite_file}")
                        # Use new client format
                        self.client = chromadb.PersistentClient(path=self.persistent_path)
                        logger.info(f"Successfully initialized ChromaDB client with existing database")
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
                                logger.info(f"Clearing ChromaDB directory: {self.persistent_path}")
                                for item in os.listdir(self.persistent_path):
                                    item_path = os.path.join(self.persistent_path, item)
                                    if os.path.isfile(item_path):
                                        logger.info(f"Removing file: {item_path}")
                                        os.remove(item_path)
                                    elif os.path.isdir(item_path):
                                        logger.info(f"Removing directory: {item_path}")
                                        shutil.rmtree(item_path)
                                logger.info(f"Cleared ChromaDB directory: {self.persistent_path}")
                            except Exception as clear_error:
                                logger.warning(f"Error clearing ChromaDB directory: {clear_error}")
                            
                            # Create a fresh client
                            logger.info("Creating fresh ChromaDB client after clearing directory")
                            # Use new client format
                            self.client = chromadb.PersistentClient(path=self.persistent_path)
                            logger.info("Created fresh ChromaDB client")
                        else:
                            logger.error(f"Unexpected ValueError when initializing ChromaDB: {e}")
                            raise
                else:
                    # Normal initialization for new database
                    logger.info(f"SQLite file not found, creating new database at: {self.persistent_path}")
                    # Use new client format
                    self.client = chromadb.PersistentClient(path=self.persistent_path)
                    logger.info("Initialized new persistent ChromaDB client")
            else:
                logger.warning("Using in-memory ChromaDB - data will be lost when server restarts")
                # Use new client format
                self.client = chromadb.Client()
                logger.info("Initialized in-memory ChromaDB client")
            
            logger.info(f"ChromaDB client initialized successfully: {self.client}")
        except Exception as e:
            logger.error(f"Error initializing ChromaDB client: {e}, type: {type(e)}")
            logger.error(f"Error details: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            # Fall back to in-memory client if persistent fails
            logger.warning("Falling back to in-memory ChromaDB client")
            try:
                # Use new client format
                self.client = chromadb.Client()
                logger.info("Successfully created fallback in-memory client")
            except Exception as fallback_error:
                logger.error(f"Could not create fallback in-memory client: {fallback_error}")
                logger.error(f"Fallback error details: {str(fallback_error)}")
                logger.error(f"Fallback traceback: {traceback.format_exc()}")
                raise
            
    def _initialize_collection(self) -> None:
        """Initialize or get the ChromaDB collection."""
        logger.info(f"Starting collection initialization: {self.collection_name}")
        try:
            if not self.client:
                logger.error("ChromaDB client not initialized before collection initialization")
                raise ValueError("ChromaDB client not initialized")
            
            logger.info(f"ChromaDB client status before collection initialization: {self.client}")
                
            # Try to get existing collection
            try:
                logger.info(f"Attempting to get existing collection: {self.collection_name}")
                self.collection = self.client.get_collection(self.collection_name)
                count = self.collection.count() if self.collection else 0
                logger.info(f"Using existing collection: {self.collection_name}, document count: {count}")
            except Exception as get_error:
                # Create new collection if it doesn't exist
                logger.info(f"Collection not found, creating new: {self.collection_name} (Error: {get_error})")
                logger.info("Creating collection with the following settings:")
                metadata = {
                    "hnsw:space": HNSW_SPACE,
                    "hnsw:construction_ef": HNSW_CONSTRUCTION_EF,
                    "hnsw:search_ef": HNSW_SEARCH_EF,
                    "hnsw:M": HNSW_M,
                    "model_name": RAG_MODEL
                }
                logger.info(f"Collection metadata: {metadata}")
                
                self.collection = self.client.create_collection(
                    name=self.collection_name,
                    metadata=metadata,
                    embedding_function=None  # Let ChromaDB handle embeddings
                )
                logger.info(f"Created new collection: {self.collection_name}")
            
            # Check collection status
            if self.collection:
                logger.info(f"Collection initialized successfully: {self.collection_name}")
                try:
                    count = self.collection.count()
                    logger.info(f"Collection document count: {count}")
                except Exception as count_error:
                    logger.warning(f"Could not get collection count: {count_error}")
        except Exception as e:
            logger.error(f"Error initializing ChromaDB collection: {e}")
            logger.error(f"Error details: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
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
        logger.info(f"Adding {len(ids)} documents to vector store")
        logger.info(f"First document id: {ids[0] if ids else 'None'}")
        logger.info(f"First document length: {len(documents[0]) if documents else 'None'}")
        if embeddings:
            embedding_dim = len(embeddings[0]) if embeddings and embeddings[0] else 0
            logger.info(f"Embedding dimension: {embedding_dim}")
        
        try:
            if not self.collection:
                logger.info("Collection not initialized, initializing now")
                self._initialize_collection()
                
            logger.info(f"Adding documents to collection: {self.collection_name}")
            self.collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=documents,
                metadatas=metadatas
            )
            logger.info(f"Successfully added {len(ids)} documents to vector store")
            
            # Verify documents were added
            try:
                new_count = self.collection.count()
                logger.info(f"Collection count after adding documents: {new_count}")
            except Exception as count_error:
                logger.warning(f"Could not verify document count after adding: {count_error}")
        except Exception as e:
            logger.error(f"Error adding documents to vector store: {e}")
            logger.error(f"Error details: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
            
    def query(self, 
              query_text: str = None,
              query_embedding: List[float] = None, 
              n_results: int = 10,  # Increased from default 3 to 10 
              where: Optional[Dict[str, Any]] = None,
              distance_threshold: float = 0.75) -> Dict[str, Any]:
        """
        Query the vector store for similar documents.
        
        Args:
            query_text: Text query (will be converted to embedding if query_embedding not provided)
            query_embedding: Embedding vector for the query
            n_results: Number of results to return
            where: Optional filter for the query
            distance_threshold: Maximum distance to include a result (0 to 1, where 0 is perfect match)
            
        Returns:
            Dictionary with query results
        """
        logger.info("========== STARTING RAG QUERY ==========")
        logger.info(f"Query text: {query_text}")
        logger.info(f"Query embedding provided: {query_embedding is not None}")
        logger.info(f"Number of results requested: {n_results}")
        logger.info(f"Query filters: {where}")
        logger.info(f"Distance threshold: {distance_threshold}")
        
        try:
            if not self.collection:
                logger.info("Collection not initialized before query, initializing now")
                self._initialize_collection()
                logger.info(f"Collection initialized: {self.collection_name}")
                
            if query_embedding is None and query_text is None:
                logger.error("Both query_text and query_embedding are None")
                raise ValueError("Either query_text or query_embedding must be provided")
            
            # Log collection info
            try:
                logger.info(f"Getting collection info for: {self.collection_name}")
                collection_info = self.client.get_collection(self.collection_name)
                logger.info(f"Collection name: {self.collection_name}")
                count = collection_info.count()
                logger.info(f"Collection count: {count}")
                # Try to get dimensionality from collection
                metadata = collection_info.metadata
                if metadata:
                    logger.info(f"Collection metadata: {metadata}")
                else:
                    logger.info("No collection metadata available")
            except Exception as e:
                logger.warning(f"Could not retrieve collection info: {e}")
                logger.warning(f"Collection info error details: {str(e)}")
            
            # IMPORTANT: If text query is provided but no embedding, set query_text to None
            # and let ChromaDB handle the embedding generation internally.
            # This avoids dimension mismatch issues when using different embedders.
            use_query_text = False
            use_query_embedding = False
            
            if query_text is not None and query_embedding is None:
                logger.info(f"Using text query directly without pre-computing embedding: {query_text}")
                logger.info(f"Query text length: {len(query_text)}")
                use_query_text = True
                use_query_embedding = False
            elif query_embedding is not None:
                # Log query embedding information
                embedding_dim = len(query_embedding)
                logger.info(f"Using pre-computed embedding for query")
                logger.info(f"Query embedding dimension: {embedding_dim}")
                embedding_array = np.array(query_embedding)
                logger.info(f"Query embedding stats - Min: {embedding_array.min():.4f}, Max: {embedding_array.max():.4f}, Mean: {embedding_array.mean():.4f}")
                use_query_text = False
                use_query_embedding = True
            
            logger.info(f"Query strategy - use_query_text: {use_query_text}, use_query_embedding: {use_query_embedding}")
            
            try:
                # If we have a pre-computed embedding, use it; otherwise use query_text directly
                logger.info("Executing vector search query...")
                query_start_params = {
                    "query_embeddings": "[vector data]" if use_query_embedding else None,
                    "query_texts": [query_text] if use_query_text else None,
                    "n_results": n_results,
                    "where": where,
                    "include": ["documents", "metadatas", "distances", "embeddings"]
                }
                logger.info(f"Query parameters: {query_start_params}")
                
                results = self.collection.query(
                    query_embeddings=[query_embedding] if use_query_embedding else None,
                    query_texts=[query_text] if use_query_text else None,
                    n_results=n_results,
                    where=where,
                    include=["documents", "metadatas", "distances", "embeddings"]
                )
                
                logger.info("Query execution completed")
                logger.info(f"Result keys: {list(results.keys()) if results else 'None'}")
                
                # Apply distance threshold filtering
                if 'distances' in results and isinstance(results['distances'], list) and len(results['distances']) > 0:
                    filtered_results = {}
                    for key in results.keys():
                        filtered_results[key] = []
                    
                    # Only include results below the distance threshold
                    for i, distances in enumerate(results['distances']):
                        filtered_indices = []
                        filtered_results['distances'].append([])
                        
                        for j, distance in enumerate(distances):
                            if distance <= distance_threshold:
                                filtered_indices.append(j)
                                filtered_results['distances'][i].append(distance)
                        
                        # Filter other result arrays by the same indices
                        for key in results.keys():
                            if key != 'distances':
                                filtered_results[key].append([])
                                for j in filtered_indices:
                                    if (results[key] is not None and 
                                        isinstance(results[key], list) and 
                                        len(results[key]) > i and 
                                        isinstance(results[key][i], list) and 
                                        j < len(results[key][i])):
                                        filtered_results[key][i].append(results[key][i][j])
                    
                    # Update results with filtered values
                    results = filtered_results
                    logger.info(f"Applied distance threshold {distance_threshold}: Filtered to {len(results['distances'][0])} results")
                
                # Log query results info
                if results:
                    # Safely handle documents array
                    if 'documents' in results and isinstance(results['documents'], list) and len(results['documents']) > 0:
                        doc_list = results['documents'][0]
                        docs_count = len(doc_list) if isinstance(doc_list, list) else 0
                        logger.info(f"Query returned {docs_count} results")
                        
                        # Log first few results details
                        if docs_count > 0 and isinstance(doc_list, list):
                            for i, doc in enumerate(doc_list[:min(3, docs_count)]):
                                doc_preview = doc[:100] + "..." if len(doc) > 100 else doc
                                logger.info(f"Result {i+1} preview: {doc_preview}")
                                
                                # Log metadata if available
                                if 'metadatas' in results and isinstance(results['metadatas'], list) and len(results['metadatas']) > 0:
                                    if isinstance(results['metadatas'][0], list) and i < len(results['metadatas'][0]):
                                        metadata = results['metadatas'][0][i]
                                        logger.info(f"Result {i+1} metadata: {metadata}")
                                
                                # Log distance if available
                                if 'distances' in results and isinstance(results['distances'], list) and len(results['distances']) > 0:
                                    if isinstance(results['distances'][0], list) and i < len(results['distances'][0]):
                                        distance = results['distances'][0][i]
                                        logger.info(f"Result {i+1} distance: {distance}")
                    else:
                        logger.info("Query returned no documents")
                        
                    # Safely handle embeddings array
                    if 'embeddings' in results and isinstance(results['embeddings'], list) and len(results['embeddings']) > 0:
                        if isinstance(results['embeddings'][0], list) and len(results['embeddings'][0]) > 0:
                            if isinstance(results['embeddings'][0][0], (list, np.ndarray)):
                                result_embedding_dim = len(results['embeddings'][0][0])
                                logger.info(f"Result embedding dimension: {result_embedding_dim}")
                                
                logger.info("========== COMPLETED RAG QUERY SUCCESSFULLY ==========")
                return results
            except Exception as e:
                logger.error(f"Error querying vector store: {e}")
                logger.error(f"Query error details: {str(e)}")
                # Add more detailed error information
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                if "dimension" in str(e).lower():
                    logger.error(f"Dimension mismatch detected. Query embedding dim: {len(query_embedding) if query_embedding else 'N/A'}")
                    # Try to get collection dimension
                    try:
                        # Check first document in collection to get dimension
                        logger.info("Attempting to peek collection to diagnose dimension mismatch")
                        peek_results = self.collection.peek(limit=1)
                        if peek_results and 'embeddings' in peek_results and peek_results['embeddings']:
                            # Make sure we safely handle the embedding array
                            if isinstance(peek_results['embeddings'], list) and len(peek_results['embeddings']) > 0:
                                collection_dim = len(peek_results['embeddings'][0])
                                logger.error(f"Collection dimension from peek: {collection_dim}")
                                logger.error(f"Dimension mismatch: query={len(query_embedding)}, collection={collection_dim}")
                    except Exception as peek_error:
                        logger.error(f"Could not peek collection: {peek_error}")
                        logger.error(f"Peek error details: {str(peek_error)}")
                logger.error("========== RAG QUERY FAILED ==========")
                raise
        except Exception as e:
            logger.error(f"Error in RAG query: {e}")
            logger.error(f"Error type: {type(e)}")
            logger.error(f"Error details: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            logger.error("========== RAG QUERY FAILED ==========")
            raise
            
    def get_collection_count(self) -> int:
        """Get the number of documents in the collection."""
        logger.info(f"Getting document count for collection: {self.collection_name}")
        try:
            if not self.collection:
                logger.info("Collection not initialized, initializing now")
                self._initialize_collection()
            count = self.collection.count()
            logger.info(f"Collection document count: {count}")
            return count
        except Exception as e:
            logger.error(f"Error getting collection count: {e}")
            logger.error(f"Error details: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return 0

    def reset_collection(self) -> None:
        """Reset the collection (delete all documents)."""
        logger.info(f"Resetting collection: {self.collection_name}")
        try:
            if self.collection:
                logger.info(f"Deleting existing collection: {self.collection_name}")
                self.client.delete_collection(self.collection_name)
                logger.info(f"Collection deleted: {self.collection_name}")
            
            logger.info("Re-initializing collection")
            self._initialize_collection()
            logger.info(f"Reset collection completed: {self.collection_name}")
            
            # Verify reset
            try:
                count = self.collection.count()
                logger.info(f"Collection count after reset: {count}")
            except Exception as count_error:
                logger.warning(f"Could not verify collection count after reset: {count_error}")
        except Exception as e:
            logger.error(f"Error resetting collection: {e}")
            logger.error(f"Error details: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
            
    def delete_collection(self) -> None:
        """Delete the collection entirely."""
        logger.info(f"Deleting collection: {self.collection_name}")
        try:
            if self.client:
                try:
                    logger.info(f"Attempting to delete collection: {self.collection_name}")
                    self.client.delete_collection(self.collection_name)
                    logger.warning(f"Deleted collection: {self.collection_name}")
                except Exception as e:
                    logger.error(f"Error deleting collection: {e}")
                    logger.error(f"Error details: {str(e)}")
            
            # Re-initialize the client and collection to ensure database structure is recreated
            logger.info("Re-initializing client and collection")
            self._initialize_client()
            self._initialize_collection()
            
            self.collection = None
            logger.info("Collection deletion and re-initialization complete")
        except Exception as e:
            logger.error(f"Error in delete_collection: {e}")
            logger.error(f"Error details: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise
            
    def diagnose_dimension_mismatch(self, test_query_embedding=None) -> Dict[str, Any]:
        """
        Diagnose dimension mismatch issues between embeddings and collection.
        
        Args:
            test_query_embedding: Optional test embedding to compare with collection
            
        Returns:
            Dictionary with diagnostic information
        """
        logger.info("========== RUNNING DIMENSION MISMATCH DIAGNOSTICS ==========")
        logger.info(f"Collection name: {self.collection_name}")
        if test_query_embedding is not None:
            logger.info(f"Test query embedding dimension: {len(test_query_embedding)}")
        else:
            logger.info("No test query embedding provided")
        
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
                logger.info(f"Diagnostic result: {diagnostics}")
                return diagnostics
                
            # Check if collection exists and has documents
            diagnostics["collection_exists"] = True
            logger.info("Getting collection document count")
            count = self.collection.count()
            diagnostics["collection_count"] = count
            logger.info(f"Collection document count: {count}")
            
            if count == 0:
                logger.warning("Collection is empty - no documents to check dimensions")
                diagnostics["issues_found"].append("Collection is empty")
                logger.info(f"Diagnostic result: {diagnostics}")
                return diagnostics
            
            # Try to get embedding dimension from collection
            try:
                logger.info("Peeking collection to get embedding dimensions")
                peek_results = self.collection.peek(limit=1)
                logger.info(f"Peek results keys: {list(peek_results.keys()) if peek_results else 'None'}")
                
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
                            else:
                                logger.info(f"Dimensions match: Query dim = {len(test_query_embedding)}, Collection dim = {diagnostics['collection_dim']}")
                    else:
                        logger.warning("No embeddings found in peek results or empty embedding list")
                        diagnostics["issues_found"].append("No embeddings found in collection peek")
                else:
                    logger.warning("No 'embeddings' key in peek results")
                    logger.info(f"Available keys in peek results: {list(peek_results.keys()) if peek_results else 'None'}")
                    diagnostics["issues_found"].append("No embeddings key in collection peek")
            except Exception as peek_error:
                logger.error(f"Error getting collection dimensions: {peek_error}")
                logger.error(f"Error details: {str(peek_error)}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                diagnostics["issues_found"].append(f"Error getting collection dimensions: {str(peek_error)}")
            
            logger.info(f"Dimension diagnostics complete. Result: {diagnostics}")
            logger.info("========== COMPLETED DIMENSION MISMATCH DIAGNOSTICS ==========")
            return diagnostics
            
        except Exception as e:
            logger.error(f"Error in diagnose_dimension_mismatch: {e}")
            logger.error(f"Error details: {str(e)}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            diagnostics["issues_found"].append(f"Diagnostic error: {str(e)}")
            logger.info("========== DIMENSION MISMATCH DIAGNOSTICS FAILED ==========")
            return diagnostics
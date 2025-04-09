"""
RAG (Retrieval-Augmented Generation) Engine for the Co.meta Chatbot.

This module handles:
1. Retrieving relevant documents from the vector store
2. Creating an augmented prompt with the retrieved context
3. Generating responses based on the user query and retrieved context
"""
import logging
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
from chatbot.rag_system.vector_store import VectorStore
from chatbot.rag_system.config import DEFAULT_TOP_K, MIN_RELEVANCE_THRESHOLD, MIN_INITIAL_K, INITIAL_K_MULTIPLIER, DEFAULT_SYSTEM_PROMPT, DEFAULT_NUM_RESULTS

logger = logging.getLogger(__name__)

class RAGEngine:
    
    def __init__(self, 
                 vector_store: Optional[VectorStore] = None,
                 top_k: int = DEFAULT_TOP_K):
        """
        Initialize the RAG engine.
        
        Args:
            vector_store: Vector store for document retrieval
            top_k: Number of top results to retrieve
        """
        self.vector_store = vector_store or VectorStore()
        self.top_k = top_k
        
        logger.info(f"Initialized RAGEngine with top_k={top_k}")
    
    def has_rag_data(self) -> bool:
        """
        Check if the RAG system has any documents loaded.
        
        Returns:
            bool: True if documents are available, False otherwise
        """
        try:
            count = self.vector_store.get_collection_count()
            return count > 0
        except Exception as e:
            logger.error(f"Error checking RAG data availability: {e}")
            return False
    
    def retrieve_context(self, query: str) -> List[Dict[str, Any]]:
        """
        Retrieve relevant context from the vector store.
        
        Args:
            query: User query text
            
        Returns:
            List of context documents with metadata and relevance scores
        """
        logger.info(f"Retrieving context for query: '{query}'")
        
        try:
            # Query the vector store with a higher limit than needed to filter for quality
            initial_k = max(MIN_INITIAL_K, self.top_k * INITIAL_K_MULTIPLIER)
            
            # Log vector store collection info if possible
            try:
                collection_name = getattr(self.vector_store, 'collection_name', 'Unknown')
                collection_count = self.vector_store.get_collection_count()
                logger.info(f"Using vector store collection: {collection_name} with {collection_count} documents")
            except Exception as vs_error:
                logger.warning(f"Could not get vector store info: {vs_error}")
            
            # Query the vector store
            logger.info(f"Querying vector store for {initial_k} relevant documents...")
            results = self.vector_store.query(
                query_text=query,
                n_results=initial_k
            )
            
            # Process the results
            context_docs = []
            if results:
                documents = results.get('documents', [[]])
                metadatas = results.get('metadatas', [[]])
                distances = results.get('distances', [[]])
                ids = results.get('ids', [[]])
                
                # Safely handle document results
                docs_count = 0
                if isinstance(documents, list) and len(documents) > 0:
                    if isinstance(documents[0], list):
                        docs_count = len(documents[0])
                
                logger.info(f"Retrieved {docs_count} documents from vector store")
                
                # Handle empty results
                if docs_count == 0:
                    logger.warning("Empty results returned from vector store")
                    return []
                    
                # Extract information from results and convert distances to relevance scores
                for i in range(docs_count):
                    doc_id = ids[0][i] if ids and len(ids) > 0 and len(ids[0]) > i else f"unknown-{i}"
                    distance = distances[0][i] if distances and len(distances) > 0 and len(distances[0]) > i else 1.0
                    relevance_score = 1.0 - distance  # Convert distance to relevance (higher is better)
                    
                    # Only include if relevance score meets minimum threshold
                    # This helps filter out irrelevant results even if they were returned
                    if relevance_score >= MIN_RELEVANCE_THRESHOLD:  # Minimum relevance threshold
                        context_doc = {
                            'id': doc_id,
                            'content': documents[0][i],
                            'metadata': metadatas[0][i] if metadatas and len(metadatas) > 0 and len(metadatas[0]) > i else {},
                            'relevance_score': relevance_score
                        }
                        context_docs.append(context_doc)
                
                # Sort by relevance score (highest first) and limit to top_k
                context_docs = sorted(context_docs, key=lambda x: x.get('relevance_score', 0), reverse=True)[:self.top_k]
            
            logger.info(f"Retrieved and filtered to {len(context_docs)} context documents")
            return context_docs
            
        except Exception as e:
            logger.error(f"Error retrieving context: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            return []
    
    def format_context_for_prompt(self, context_docs: List[Dict[str, Any]]) -> str:
        """
        Format retrieved context for inclusion in prompt.
        
        Args:
            context_docs: List of context documents retrieved from vector store
            
        Returns:
            Formatted context string
        """
        if not context_docs:
            return ""
            
        context_parts = []
        
        for i, doc in enumerate(context_docs):
            # Extract metadata for citation
            metadata = doc.get('metadata', {})
            source = metadata.get('source', 'Unknown Source')
            title = metadata.get('title', metadata.get('document_title', 'Untitled'))
            relevance = doc.get('relevance_score', 0.0)

            logger.info(f"Document {i+1}: {title} - Relevance: {relevance:.4f} - Source: {source}")

            context_part = f"[Document {i+1}: {title}]\n{doc['content'].strip()}\n"
            context_parts.append(context_part)
            
        return "\n".join(context_parts)
    
    def create_augmented_prompt(self, 
                               query: str, 
                               context_docs: List[Dict[str, Any]],
                               system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Create an augmented prompt with retrieved context.
        
        Args:
            query: User query
            context_docs: Retrieved context documents
            system_prompt: Optional custom system prompt
            
        Returns:
            Dictionary with prompt components
        """
        # Format context
        context_str = self.format_context_for_prompt(context_docs)
        
        # Default system prompt if none provided
        if system_prompt is None:
            system_prompt = DEFAULT_SYSTEM_PROMPT
        
        # Create augmented system prompt with context and improved instructions
        if context_str:
            augmented_system_prompt = (
                f"{system_prompt}\n\n"
                f"Based on the following information, answer the user's query directly and concisely.\n"
                f"---BEGIN CONTEXT---\n{context_str}\n---END CONTEXT---\n\n"
                f"When the context is insufficient to fully answer, acknowledge that limitation.\n"
                f"You can use the context to answer the question, but you should not mention the context in your response.\n"
            )
        else:
            augmented_system_prompt = system_prompt
            
        return {
            "system": augmented_system_prompt,
            "query": query,
            "has_context": bool(context_str)
        }
    
    def process_query(self, query: str, system_prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Process a user query with the RAG system.
        
        Args:
            query: User query
            system_prompt: Optional custom system prompt
            
        Returns:
            Dictionary with augmented prompt and context information
        """
        logger.info(f"Processing RAG query: '{query}'")
        
        # Check if we have RAG data
        has_rag_data = self.has_rag_data()
        logger.info(f"RAG data available: {has_rag_data}")
        
        if not has_rag_data:
            logger.warning("No documents in RAG system, returning query without context")
            return {
                "system": system_prompt or "You are a helpful AI assistant for Co.meta, a software testing platform.",
                "query": query,
                "has_context": False,
                "context_docs": [],
                "rag_available": False
            }
        
        try:
            # Retrieve relevant context
            logger.info("Retrieving context documents...")
            context_docs = self.retrieve_context(query)
            logger.info(f"Retrieved {len(context_docs)} context documents")
            
            # Create augmented prompt
            logger.info("Creating augmented prompt...")
            prompt_data = self.create_augmented_prompt(
                query=query,
                context_docs=context_docs,
                system_prompt=system_prompt
            )
            
            # Add context docs for reference
            prompt_data['context_docs'] = context_docs
            prompt_data['rag_available'] = True
            
            logger.info("RAG query processing completed successfully")
            return prompt_data
            
        except Exception as e:
            logger.error(f"Error processing RAG query: {e}")
            import traceback
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Fallback return
            logger.warning("Returning query without context due to error")
            return {
                "system": system_prompt or "You are a helpful AI assistant for Co.meta, a software testing platform.",
                "query": query,
                "has_context": False,
                "context_docs": [],
                "rag_available": True,
                "error": str(e)
            }
        
    def query(self, query: str, num_results: int = DEFAULT_NUM_RESULTS) -> Dict[str, Any]:
        """
        Query the RAG system to retrieve relevant documents.
        
        Args:
            query: User query
            num_results: Number of results to return
            
        Returns:
            Dictionary containing retrieved documents and RAG availability status
        """
        logger.info(f"Starting direct RAG query: '{query}' for {num_results} results")
        
        # Check if we have RAG data
        has_rag_data = self.has_rag_data()
        logger.info(f"RAG data available: {has_rag_data}")
        
        if not has_rag_data:
            logger.warning("No documents in RAG system, returning empty results")
            return {
                "results": [],
                "query": query,
                "rag_available": False
            }
        
        try:
            # IMPORTANT: Use text query directly instead of pre-generating embeddings
            # This avoids embedding dimension mismatches by letting ChromaDB handle embeddings internally
            logger.info("Using text query directly to avoid embedding dimension mismatches")
            
            # Query vector store with text
            logger.info(f"Querying vector store with text query: '{query}'")
            try:
                results = self.vector_store.query(
                    query_text=query,
                    n_results=num_results
                )
                logger.info("Vector store query successful")
            except Exception as query_error:
                logger.error(f"Error querying vector store: {query_error}")
                import traceback
                logger.error(f"Query error traceback: {traceback.format_exc()}")
                raise
            
            # Process and format results
            formatted_results = []
            if results:
                documents = results.get('documents', [[]])
                metadatas = results.get('metadatas', [[]])
                distances = results.get('distances', [[]])
                
                # Log retrieved document info
                doc_count = len(documents[0]) if documents and documents[0] else 0
                logger.info(f"Retrieved {doc_count} documents")
                
                # Handle empty results
                if not documents[0]:
                    return {"results": [], "query": query, "rag_available": True}
                    
                # Format results
                for i in range(len(documents[0])):
                    if i < len(documents[0]) and i < len(metadatas[0]) and i < len(distances[0]):
                        formatted_results.append({
                            'text': documents[0][i],
                            'metadata': metadatas[0][i],
                            'similarity': 1.0 - distances[0][i]  # Convert distance to similarity score
                        })
            
            return {
                "results": formatted_results,
                "query": query,
                "rag_available": True
            }
        except Exception as e:
            logger.error(f"Error querying RAG system: {e}")
            return {
                "results": [],
                "query": query,
                "rag_available": False,
                "error": str(e)
            } 
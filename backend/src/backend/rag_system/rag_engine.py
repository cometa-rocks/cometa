"""
RAG (Retrieval-Augmented Generation) Engine for the Co.meta Chatbot.

This module handles:
1. Retrieving relevant documents from the vector store
2. Creating an augmented prompt with the retrieved context
3. Generating responses based on the user query and retrieved context
"""
import logging
from typing import List, Dict, Any, Optional, Tuple

# Internal imports
from .vector_store import VectorStore
from .embeddings import EmbeddingModel, get_embedder

logger = logging.getLogger(__name__)

class RAGEngine:
    
    def __init__(self, 
                 vector_store: Optional[VectorStore] = None,
                 embedding_model: Optional[EmbeddingModel] = None,
                 top_k: int = 5):
        """
        Initialize the RAG Engine.
        
        Args:
            vector_store: Vector store for document retrieval
            embedding_model: Model for generating embeddings
            top_k: Number of top documents to retrieve
        """
        self.vector_store = vector_store or VectorStore()
        self.embedding_model = embedding_model or get_embedder()
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
            query: User query
            
        Returns:
            List of documents with their content and metadata
        """
        logger.info(f"Retrieving context for query: {query}")
        
        # First check if we have any data
        if not self.has_rag_data():
            logger.warning("No documents in RAG system, returning empty context")
            return []
        
        # Query the vector store
        results = self.vector_store.query(
            query_text=query,
            n_results=self.top_k
        )
        
        # Process the results
        context_docs = []
        if results:
            documents = results.get('documents', [[]])
            metadatas = results.get('metadatas', [[]])
            distances = results.get('distances', [[]])
            ids = results.get('ids', [[]])
            
            # Handle empty results
            if not documents[0]:
                return []
                
            # Extract information from results
            for i in range(len(documents[0])):
                context_docs.append({
                    'id': ids[0][i],
                    'content': documents[0][i],
                    'metadata': metadatas[0][i] if i < len(metadatas[0]) else {},
                    'relevance_score': 1.0 - distances[0][i] if i < len(distances[0]) else 0.0
                })
        
        logger.info(f"Retrieved {len(context_docs)} context documents")
        return context_docs
    
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
            title = metadata.get('title', 'Untitled')
            
            # Format the context entry
            context_part = f"[Document {i+1}: {title} from {source}]\n{doc['content']}\n"
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
            system_prompt = (
                "You are a helpful AI assistant for Co.meta, a software testing platform. "
                "Answer the user's question based on the context provided. "
                "If you don't know the answer based on the context, say so - "
                "DO NOT make up information. "
                "Use the context to provide accurate, helpful and concise answers."
            )
        
        # Create augmented system prompt with context
        if context_str:
            augmented_system_prompt = (
                f"{system_prompt}\n\n"
                f"Context information is below. Use this information to answer the user's query.\n"
                f"---BEGIN CONTEXT---\n{context_str}\n---END CONTEXT---\n\n"
                f"Given this context, please provide a helpful response to the user's query."
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
        # Check if we have RAG data
        has_rag_data = self.has_rag_data()
        
        if not has_rag_data:
            logger.warning("No documents in RAG system, returning query without context")
            return {
                "system": system_prompt or "You are a helpful AI assistant for Co.meta, a software testing platform.",
                "query": query,
                "has_context": False,
                "context_docs": [],
                "rag_available": False
            }
        
        # Retrieve relevant context
        context_docs = self.retrieve_context(query)
        
        # Create augmented prompt
        prompt_data = self.create_augmented_prompt(
            query=query,
            context_docs=context_docs,
            system_prompt=system_prompt
        )
        
        # Add context docs for reference
        prompt_data['context_docs'] = context_docs
        prompt_data['rag_available'] = True
        
        return prompt_data
        
    def query(self, query: str, num_results: int = 3) -> Dict[str, Any]:
        """
        Query the RAG system to retrieve relevant documents.
        
        Args:
            query: User query
            num_results: Number of results to return
            
        Returns:
            Dictionary containing retrieved documents and RAG availability status
        """
        # Check if we have RAG data
        has_rag_data = self.has_rag_data()
        
        if not has_rag_data:
            logger.warning("No documents in RAG system, returning empty results")
            return {
                "results": [],
                "query": query,
                "rag_available": False
            }
        
        try:
            # Get query embedding
            query_embedding = self.embedding_model.get_embedding(query)
            
            # Query vector store with embedding
            results = self.vector_store.query(
                query_embedding=query_embedding,
                n_results=num_results
            )
            
            # Process and format results
            formatted_results = []
            if results:
                documents = results.get('documents', [[]])
                metadatas = results.get('metadatas', [[]])
                distances = results.get('distances', [[]])
                
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
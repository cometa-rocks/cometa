"""
Embedding models for Co.meta RAG system.
"""
import os
import logging
import requests
from typing import List, Optional, Union, Dict, Any
import numpy as np

logger = logging.getLogger(__name__)

class EmbeddingModel:
    """Base class for embedding models."""
    
    def __init__(self):
        """Initialize the embedding model."""
        pass
        
    def get_embeddings(self, texts: List[str]) -> np.ndarray:
        """
        Generate embeddings for a list of texts.
        
        Args:
            texts: List of text strings to embed
            
        Returns:
            NumPy array of embeddings with shape (len(texts), embedding_dim)
        """
        raise NotImplementedError("Subclasses must implement get_embeddings")

class OllamaEmbedder(EmbeddingModel):
    """Ollama API-based embedding model."""
    
    def __init__(self, 
                 model_name: str = "granite-embedding:278m",
                 host: Optional[str] = None,
                 batch_size: int = 8):
        """
        Initialize the Ollama embedder.
        
        Args:
            model_name: Name of the model to use
            host: Ollama API host (e.g., 'http://cometa-ollama.ai-1:8083')
            batch_size: Batch size for embedding generation
        """
        super().__init__()
        
        # Always use granite-embedding:278m for embeddings
        self.model_name = "granite-embedding:278m"
        self.batch_size = batch_size
        self.host = host or os.environ.get('OLLAMA_HOST', 'http://cometa-ollama.ai-1:8083')
        
        logger.info(f"Initializing Ollama Embedder with model: {self.model_name} on {self.host}")
        
        # Verify the model is available
        try:
            self._verify_model()
            logger.info(f"Successfully connected to Ollama API for model: {self.model_name}")
        except Exception as e:
            logger.error(f"Error connecting to Ollama API: {e}")
            raise
        
    def _verify_model(self):
        """Verify that the model is available in Ollama."""
        try:
            response = requests.get(f"{self.host}/api/tags")
            if response.status_code != 200:
                raise Exception(f"Failed to connect to Ollama API: {response.text}")
            
            models = response.json().get('models', [])
            model_names = [model.get('name') for model in models]
            
            if self.model_name not in model_names:
                raise Exception(f"Model {self.model_name} not found in Ollama. Available models: {model_names}")
                
        except requests.RequestException as e:
            raise Exception(f"Error connecting to Ollama API: {str(e)}")
        
    def get_embedding(self, text: str) -> np.ndarray:
        """
        Generate embedding for a single text string.
        
        Args:
            text: Text string to embed
            
        Returns:
            NumPy array of embedding with shape (embedding_dim,)
        """
        try:
            logger.info(f"Generating embedding with model: {self.model_name}")
            logger.info(f"Text length: {len(text)} characters")
            
            response = requests.post(
                f"{self.host}/api/embeddings",
                json={"model": self.model_name, "prompt": text}
            )
            
            if response.status_code != 200:
                logger.error(f"Error from Ollama API: {response.text}")
                raise Exception(f"Failed to get embedding: {response.text}")
                
            data = response.json()
            embedding = data.get('embedding', [])
            
            # Log embedding details
            embedding_array = np.array(embedding, dtype=np.float32)
            embedding_dim = embedding_array.shape[0]
            logger.info(f"Generated embedding dimension: {embedding_dim}")
            logger.info(f"Embedding stats - Min: {embedding_array.min():.4f}, Max: {embedding_array.max():.4f}, Mean: {embedding_array.mean():.4f}")
            
            # Handle dimension inconsistency - granite-embedding:278m can return either 384 or 768 dimensions
            # For consistency, always ensure we have 768 dimensions
            expected_dim = 768
            
            if embedding_dim != expected_dim:
                logger.warning(f"Embedding dimension mismatch. Got {embedding_dim}, expected {expected_dim}")
                
                if embedding_dim == 384 and expected_dim == 768:
                    # If we received 384 dimensions but expected 768, pad with zeros
                    logger.info("Padding embedding from 384 to 768 dimensions")
                    padded_embedding = np.zeros(expected_dim, dtype=np.float32)
                    padded_embedding[:embedding_dim] = embedding_array
                    embedding_array = padded_embedding
                    logger.info(f"Padded embedding to dimension: {len(embedding_array)}")
                elif embedding_dim == 768 and expected_dim == 384:
                    # If we received 768 dimensions but expected 384, truncate
                    logger.info("Truncating embedding from 768 to 384 dimensions")
                    embedding_array = embedding_array[:expected_dim]
                    logger.info(f"Truncated embedding to dimension: {len(embedding_array)}")
                else:
                    logger.error(f"Unexpected embedding dimensions: {embedding_dim}")
            
            return embedding_array
            
        except Exception as e:
            logger.error(f"Error generating embedding via Ollama API: {e}")
            raise
        
    def get_embeddings(self, texts: List[str]) -> np.ndarray:
        """
        Generate embeddings for a list of texts.
        
        Args:
            texts: List of text strings to embed
            
        Returns:
            NumPy array of embeddings with shape (len(texts), embedding_dim)
        """
        if not texts:
            return np.array([])
            
        all_embeddings = []
        expected_dim = 768  # Always expect 768 dimensions
        logger.info(f"Generating embeddings for {len(texts)} texts with expected dimension {expected_dim}")
        
        # Process in batches
        for i in range(0, len(texts), self.batch_size):
            batch_texts = texts[i:i+self.batch_size]
            logger.info(f"Processing batch {i//self.batch_size + 1}/{(len(texts) + self.batch_size - 1)//self.batch_size}")
            
            batch_embeddings = []
            for text in batch_texts:
                try:
                    embedding = self.get_embedding(text)
                    # Note: get_embedding now handles dimension standardization
                    batch_embeddings.append(embedding)
                except Exception as e:
                    logger.error(f"Error generating embedding for text: {e}")
                    # Use a zero vector as fallback with the expected dimension
                    batch_embeddings.append(np.zeros(expected_dim, dtype=np.float32))
            
            all_embeddings.extend(batch_embeddings)
            
        # Final verification of dimensions
        embeddings_array = np.array(all_embeddings)
        logger.info(f"Generated {len(embeddings_array)} embeddings with shape {embeddings_array.shape}")
        
        # Verify all embeddings have the expected dimension
        if embeddings_array.shape[1] != expected_dim:
            logger.error(f"Embedding dimension mismatch in batch. Got {embeddings_array.shape[1]}, expected {expected_dim}")
            
        return embeddings_array

# Factory function to get the appropriate embedder
def get_embedder(**kwargs) -> EmbeddingModel:
    """
    Get an instance of the OllamaEmbedder with granite-embedding:278m.
    
    Args:
        **kwargs: Additional arguments to pass to the embedder
        
    Returns:
        An instance of OllamaEmbedder
    """
    # Force model_name to be granite-embedding:278m if it's in kwargs
    if 'model_name' in kwargs:
        kwargs['model_name'] = "granite-embedding:278m"
        
    return OllamaEmbedder(**kwargs) 
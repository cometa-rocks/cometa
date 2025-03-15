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
            response = requests.post(
                f"{self.host}/api/embeddings",
                json={"model": self.model_name, "prompt": text}
            )
            
            if response.status_code != 200:
                logger.error(f"Error from Ollama API: {response.text}")
                raise Exception(f"Failed to get embedding: {response.text}")
                
            data = response.json()
            embedding = data.get('embedding', [])
            
            return np.array(embedding, dtype=np.float32)
            
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
        
        # Process in batches
        for i in range(0, len(texts), self.batch_size):
            batch_texts = texts[i:i+self.batch_size]
            
            batch_embeddings = []
            for text in batch_texts:
                try:
                    embedding = self.get_embedding(text)
                    batch_embeddings.append(embedding)
                except Exception as e:
                    logger.error(f"Error generating embedding for text: {e}")
                    # Use a zero vector as fallback
                    # Use the first successful embedding's shape if available
                    if batch_embeddings:
                        batch_embeddings.append(np.zeros_like(batch_embeddings[0]))
                    else:
                        # If no embeddings yet, try to get the dimension from a simple test
                        try:
                            test_embedding = self.get_embedding("test")
                            batch_embeddings.append(np.zeros_like(test_embedding))
                        except:
                            # Last resort: typical embedding size
                            batch_embeddings.append(np.zeros(1024, dtype=np.float32))
            
            all_embeddings.extend(batch_embeddings)
            
        return np.array(all_embeddings)

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
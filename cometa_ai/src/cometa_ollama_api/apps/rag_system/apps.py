"""
Django app configuration for RAG system.
"""
from django.apps import AppConfig
import os
import logging
import ollama

logger = logging.getLogger(__name__)

class RagSystemConfig(AppConfig):
    """
    Configuration for the RAG system Django app.
    """
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.rag_system'
    verbose_name = 'RAG System'
    
    def ready(self):
        """
        Initialize the RAG system when Django starts.
        This is called once when Django starts.
        """
        # Create data directory if it doesn't exist
        from django.conf import settings
        
        # Set up RAG data directory
        rag_data_dir = os.path.join(settings.BASE_DIR, 'data', 'chromadb')
        os.makedirs(rag_data_dir, exist_ok=True)

        # Ensure required models are available  
        self._ensure_ollama_models()
        
        # Register signals after everything is ready
        try:
            from . import signals
        except ImportError:
            pass
    
    def _ensure_ollama_models(self):
        """Ensure required Ollama models are available."""
        from .config import RAG_MODEL, CHATBOT_MODEL_NAME
        
        ollama_host = os.environ.get('OLLAMA_HOST', 'http://localhost:8083')
        if not ollama_host.startswith(('http://', 'https://')):
            ollama_host = f'http://{ollama_host}'
            
        required_models = [m for m in [RAG_MODEL, CHATBOT_MODEL_NAME] if m]
        pullable_models = required_models
        client = ollama.Client(host=ollama_host)
        
        try:
            # Get existing models
            models_response = client.list()
            existing = {m.get('name', '') for m in models_response.get('models', [])}
            
            # Pull missing models
            for model in set(pullable_models) - existing:
                logger.info(f"Pulling missing model: {model}")
                client.pull(model)
                
        except Exception as e:
            logger.warning(f"Model validation skipped: {e}") 

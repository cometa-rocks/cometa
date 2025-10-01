"""
Django app configuration for RAG system.
"""
from django.apps import AppConfig
import os
import logging

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

        # Register signals after everything is ready
        try:
            from . import signals
        except ImportError:
            pass 

"""
Django signals for the RAG system.
"""
import logging
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from .models import Document, DocumentChunk
from .vector_store import VectorStore

logger = logging.getLogger(__name__)

@receiver(post_delete, sender=DocumentChunk)
def remove_chunk_from_vector_store(sender, instance, **kwargs):
    """
    When a document chunk is deleted, remove it from the vector store.
    """
    if not instance.embedding_id:
        return
        
    try:
        vector_store = VectorStore()
        vector_store.delete_documents([instance.embedding_id])
        logger.info(f"Removed chunk {instance.embedding_id} from vector store")
    except Exception as e:
        logger.error(f"Error removing chunk {instance.embedding_id} from vector store: {e}")

@receiver(post_delete, sender=Document)
def remove_document_chunks_from_vector_store(sender, instance, **kwargs):
    """
    When a document is deleted, remove all its chunks from the vector store.
    """
    # Get all embedding IDs for this document's chunks
    embedding_ids = list(instance.chunks.filter(
        embedding_id__isnull=False
    ).values_list('embedding_id', flat=True))
    
    if not embedding_ids:
        return
        
    try:
        vector_store = VectorStore()
        vector_store.delete_documents(embedding_ids)
        logger.info(f"Removed {len(embedding_ids)} chunks for document {instance.id} from vector store")
    except Exception as e:
        logger.error(f"Error removing chunks for document {instance.id} from vector store: {e}") 
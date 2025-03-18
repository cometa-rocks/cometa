"""
Database models for the RAG system document pipeline.
"""
from django.db import models
import uuid

class Document(models.Model):
    """Model to track documents ingested into the RAG system."""
    
    # Document types
    TYPE_PDF = 'pdf'
    TYPE_MARKDOWN = 'markdown'
    TYPE_HTML = 'html'
    TYPE_TEXT = 'text'
    
    TYPE_CHOICES = [
        (TYPE_PDF, 'PDF'),
        (TYPE_MARKDOWN, 'Markdown'),
        (TYPE_HTML, 'HTML'),
        (TYPE_TEXT, 'Plain Text'),
    ]
    
    # Document status
    STATUS_PENDING = 'pending'
    STATUS_PROCESSING = 'processing'
    STATUS_COMPLETED = 'completed'
    STATUS_FAILED = 'failed'
    
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Pending'),
        (STATUS_PROCESSING, 'Processing'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_FAILED, 'Failed'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    source = models.CharField(max_length=1024, help_text="URL, file path, etc.")
    description = models.TextField(blank=True)
    content_type = models.CharField(max_length=50, choices=TYPE_CHOICES)
    content = models.TextField(blank=True, help_text="Raw document content")
    
    status = models.CharField(
        max_length=20, 
        choices=STATUS_CHOICES,
        default=STATUS_PENDING
    )
    
    error_message = models.TextField(blank=True, help_text="Error message if processing failed")
    chunk_count = models.IntegerField(default=0, help_text="Number of chunks created from this document")
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return self.title
        
    class Meta:
        verbose_name = "Document"
        verbose_name_plural = "Documents"
        ordering = ['-created_at']

class DocumentChunk(models.Model):
    """Model to track chunks of documents."""
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.ForeignKey(
        Document, 
        on_delete=models.CASCADE,
        related_name='chunks'
    )
    
    content = models.TextField()
    chunk_index = models.IntegerField(help_text="Order of this chunk within the document")
    embedding_id = models.CharField(
        max_length=100, 
        null=True, 
        blank=True,
        help_text="ID in ChromaDB"
    )
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ['document', 'chunk_index']
        verbose_name = "Document Chunk"
        verbose_name_plural = "Document Chunks"
        ordering = ['document', 'chunk_index']
        
    def __str__(self):
        return f"{self.document.title} - Chunk {self.chunk_index}" 
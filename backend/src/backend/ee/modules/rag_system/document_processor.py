"""
Document processing utilities for the RAG system.
This module handles loading, chunking, and processing documents for ingestion into the vector store.
"""
import os
import logging
import uuid
from typing import List, Optional, Dict, Any, Tuple
import re
import html
from pathlib import Path

# For document processing
from io import BytesIO
import PyPDF2
import markdown
from bs4 import BeautifulSoup

# Internal imports
from .vector_store import VectorStore
from .embeddings import EmbeddingModel, OllamaEmbedder, get_embedder
from .models import DocumentChunk

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """
    Handles document processing for the RAG system, including:
    - Loading documents from various sources (PDF, Markdown, HTML, plain text)
    - Chunking documents into smaller pieces
    - Cleaning and normalizing text
    - Generating embeddings and storing in vector database
    """
    
    def __init__(self, 
                 vector_store: Optional[VectorStore] = None,
                 embedding_model: Optional[EmbeddingModel] = None,
                 chunk_size: int = 1000,
                 chunk_overlap: int = 200):
        """
        Initialize the document processor.
        
        Args:
            vector_store: VectorStore instance for storing document embeddings
            embedding_model: Model for generating embeddings
            chunk_size: Target size of text chunks in characters
            chunk_overlap: Number of characters to overlap between chunks
        """
        self.vector_store = vector_store or VectorStore()
        self.embedding_model = embedding_model or get_embedder()
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        logger.info(f"Initialized DocumentProcessor with chunk_size={chunk_size}, "
                   f"chunk_overlap={chunk_overlap}")
    
    def load_document(self, file_path: str, document_type: Optional[str] = None) -> str:
        """
        Load document content from a file.
        
        Args:
            file_path: Path to the document file
            document_type: Type of document (pdf, markdown, html, text)
                If None, will be inferred from file extension
                
        Returns:
            Document content as text
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Document not found: {file_path}")
            
        if document_type is None:
            # Infer document type from file extension
            ext = os.path.splitext(file_path)[1].lower().lstrip('.')
            if ext == 'pdf':
                document_type = 'pdf'
            elif ext in ('md', 'markdown'):
                document_type = 'markdown'
            elif ext in ('html', 'htm'):
                document_type = 'html'
            else:
                document_type = 'text'
        
        logger.info(f"Loading document from {file_path} as {document_type}")
        
        try:
            if document_type == 'pdf':
                return self._load_pdf(file_path)
            elif document_type == 'markdown':
                return self._load_markdown(file_path)
            elif document_type == 'html':
                return self._load_html(file_path)
            else:  # text
                return self._load_text(file_path)
        except Exception as e:
            logger.error(f"Error loading document {file_path}: {e}")
            raise
    
    def _load_pdf(self, file_path: str) -> str:
        """Extract text from a PDF file."""
        text = ""
        try:
            with open(file_path, 'rb') as file:
                reader = PyPDF2.PdfReader(file)
                for page_num in range(len(reader.pages)):
                    page = reader.pages[page_num]
                    text += page.extract_text() + "\n\n"
            return text
        except Exception as e:
            logger.error(f"Error extracting text from PDF {file_path}: {e}")
            raise
    
    def _load_markdown(self, file_path: str) -> str:
        """Load and convert markdown to plain text."""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                md_content = file.read()
            
            # Convert Markdown to HTML
            html_content = markdown.markdown(md_content)
            
            # Extract text from HTML
            soup = BeautifulSoup(html_content, 'html.parser')
            return soup.get_text(separator='\n\n')
        except Exception as e:
            logger.error(f"Error processing markdown file {file_path}: {e}")
            raise
    
    def _load_html(self, file_path: str) -> str:
        """Load and extract text from HTML."""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                html_content = file.read()
            
            soup = BeautifulSoup(html_content, 'html.parser')
            
            # Remove script and style elements
            for script in soup(["script", "style"]):
                script.extract()
                
            return soup.get_text(separator='\n\n')
        except Exception as e:
            logger.error(f"Error processing HTML file {file_path}: {e}")
            raise
    
    def _load_text(self, file_path: str) -> str:
        """Load plain text file."""
        try:
            with open(file_path, 'r', encoding='utf-8') as file:
                return file.read()
        except UnicodeDecodeError:
            # Try with different encoding if UTF-8 fails
            with open(file_path, 'r', encoding='latin-1') as file:
                return file.read()
        except Exception as e:
            logger.error(f"Error loading text file {file_path}: {e}")
            raise
    
    def clean_text(self, text: str) -> str:
        """
        Clean and normalize text content.
        
        Args:
            text: Raw text content
            
        Returns:
            Cleaned text
        """
        if not text:
            return ""
            
        # Decode HTML entities
        text = html.unescape(text)
        
        # Replace multiple newlines with a single one
        text = re.sub(r'\n{3,}', '\n\n', text)
        
        # Replace multiple spaces with a single space
        text = re.sub(r' {2,}', ' ', text)
        
        # Strip whitespace from each line
        lines = [line.strip() for line in text.split('\n')]
        text = '\n'.join(lines)
        
        return text.strip()
    
    def chunk_text(self, text: str) -> List[str]:
        """
        Split text into overlapping chunks.
        
        Args:
            text: Text to chunk
            
        Returns:
            List of text chunks
        """
        if not text:
            return []
            
        # Clean the text first
        text = self.clean_text(text)
        
        chunks = []
        start = 0
        
        while start < len(text):
            # Get a chunk of target size or remainder of text
            end = min(start + self.chunk_size, len(text))
            
            # If we're not at the end and this isn't the first chunk,
            # try to find a natural break point
            if end < len(text) and end - start == self.chunk_size:
                # Look for paragraph, sentence, or word boundaries
                # in reverse order from the end
                
                # Try to find paragraph break
                paragraph_break = text.rfind('\n\n', start, end)
                if paragraph_break != -1 and paragraph_break > start + self.chunk_size // 2:
                    end = paragraph_break + 2  # Include the double newline
                else:
                    # Try to find sentence break (period + space)
                    sentence_break = text.rfind('. ', start, end)
                    if sentence_break != -1 and sentence_break > start + self.chunk_size // 2:
                        end = sentence_break + 2  # Include the period and space
                    else:
                        # Fall back to word boundary (space)
                        space = text.rfind(' ', start, end)
                        if space != -1 and space > start + self.chunk_size // 2:
                            end = space + 1  # Include the space
            
            # Extract the chunk
            chunk = text[start:end].strip()
            if chunk:  # Ensure we don't add empty chunks
                chunks.append(chunk)
            
            # Move the start position, accounting for overlap
            start = end - self.chunk_overlap if end - start > self.chunk_overlap else end
            
            # Avoid getting stuck in an infinite loop
            if start >= end:
                start = end
        
        return chunks
    
    def process_document(self, document):
        """
        Process a document by chunking it and creating DocumentChunk objects.
        
        Args:
            document: A Document model instance
            
        Returns:
            List of DocumentChunk objects
        """
        logger.info(f"Processing document: {document.title}")
        
        # Ensure we have clean text
        clean_content = self.clean_text(document.content)
        
        # Chunk the document
        chunks = self.chunk_text(clean_content)
        logger.info(f"Document chunked into {len(chunks)} chunks")
        
        # Create DocumentChunk objects
        document_chunks = []
        for i, chunk_text in enumerate(chunks):
            chunk = DocumentChunk.objects.create(
                document=document,
                content=chunk_text,
                chunk_index=i
            )
            document_chunks.append(chunk)
            
        return document_chunks
    
    def add_document_to_vector_store(self, document):
        """
        Process a document and add it to the vector store.
        
        Args:
            document: A Document model instance
            
        Returns:
            List of IDs of added chunks
        """
        # Process the document into chunks
        chunks = self.process_document(document)
        
        # Generate embeddings
        texts = [chunk.content for chunk in chunks]
        embeddings = self.embedding_model.get_embeddings(texts)
        
        # Prepare data for the vector store
        ids = [str(chunk.id) for chunk in chunks]
        metadatas = [{
            'document_id': str(document.id),
            'chunk_id': str(chunk.id),
            'document_title': document.title,
            'chunk_index': chunk.chunk_index
        } for chunk in chunks]
        
        # Add to vector store
        self.vector_store.add_documents(
            documents=texts,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids
        )
        
        logger.info(f"Added {len(ids)} chunks to vector store")
        return chunks 
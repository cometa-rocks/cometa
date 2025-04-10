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

from apps.chatbot.rag_system.vector_store import VectorStore
from apps.chatbot.rag_system.models import DocumentChunk
from apps.chatbot.rag_system.config import CHUNK_SIZE, CHUNK_OVERLAP, MAX_OVERLAP_RATIO

logger = logging.getLogger(__name__)

class DocumentProcessor:
    """
    Handles document processing for the RAG system, including:
    - Loading documents from various sources (PDF, Markdown, HTML, plain text)
    - Chunking documents into smaller pieces
    - Cleaning and normalizing text
    - Adding documents to the vector database
    """
    
    def __init__(self, 
                 vector_store: Optional[VectorStore] = None,
                 chunk_size: int = CHUNK_SIZE,
                 chunk_overlap: int = CHUNK_OVERLAP):
        """
        Initialize the document processor.
        
        Args:
            vector_store: VectorStore instance for storing document embeddings
            chunk_size: Target size of text chunks in characters
            chunk_overlap: Number of characters to overlap between chunks
        """
        self.vector_store = vector_store or VectorStore()
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
        Split text into semantic chunks respecting paragraph boundaries when possible.
        
        Args:
            text: Text to split into chunks
            
        Returns:
            List of text chunks
        """
        if not text:
            return []
            
        # Remove excessive newlines and whitespace
        text = re.sub(r'\n{3,}', '\n\n', text)
        text = text.strip()
        
        # Try to split by paragraphs first (two newlines)
        paragraphs = re.split(r'\n\s*\n', text)
        paragraphs = [p.strip() for p in paragraphs if p.strip()]
        
        chunks = []
        current_chunk = []
        current_size = 0
        
        # Process paragraphs
        for para in paragraphs:
            para_size = len(para)
            
            # If adding this paragraph exceeds our chunk size and we already have content
            if current_size + para_size > self.chunk_size and current_chunk:
                # Join the current chunk and add it to our list
                chunks.append('\n\n'.join(current_chunk))
                # Start a new chunk with this paragraph
                current_chunk = [para]
                current_size = para_size
            # If this single paragraph exceeds the chunk size, we need to split it
            elif para_size > self.chunk_size:
                # If we have an existing partial chunk, save it first
                if current_chunk:
                    chunks.append('\n\n'.join(current_chunk))
                    current_chunk = []
                
                # Split the paragraph by sentences
                sentences = re.split(r'(?<=[.!?])\s+', para)
                sentence_chunks = self._chunk_by_size(sentences, self.chunk_size)
                
                # Add these sentence-based chunks
                for sent_chunk in sentence_chunks:
                    chunks.append(' '.join(sent_chunk))
                
                # Reset current chunk
                current_chunk = []
                current_size = 0
            else:
                # Add this paragraph to the current chunk
                current_chunk.append(para)
                current_size += para_size
                
                # Add separator size for calculations
                if len(current_chunk) > 1:
                    current_size += 2  # newline characters
        
        # Add the final chunk if there's anything left
        if current_chunk:
            chunks.append('\n\n'.join(current_chunk))
            
        # Apply overlap if needed
        if self.chunk_overlap > 0 and len(chunks) > 1:
            chunks = self._apply_overlap(chunks)
            
        return chunks
        
    def _chunk_by_size(self, items: List[str], max_size: int) -> List[List[str]]:
        """Helper method to chunk a list of strings by size."""
        chunks = []
        current_chunk = []
        current_size = 0
        
        for item in items:
            item_size = len(item)
            
            if current_size + item_size > max_size and current_chunk:
                chunks.append(current_chunk)
                current_chunk = [item]
                current_size = item_size
            else:
                current_chunk.append(item)
                current_size += item_size
                
                # Add separator size for calculations (space between items)
                if len(current_chunk) > 1:
                    current_size += 1
        
        if current_chunk:
            chunks.append(current_chunk)
            
        return chunks
        
    def _apply_overlap(self, chunks: List[str]) -> List[str]:
        """Apply overlap between chunks to improve context continuity."""
        if not chunks or len(chunks) <= 1:
            return chunks
            
        result = []
        overlap_size = min(self.chunk_overlap, int(self.chunk_size * MAX_OVERLAP_RATIO))  # Limit overlap based on configured ratio
        
        for i, chunk in enumerate(chunks):
            if i == 0:
                # First chunk remains as is
                result.append(chunk)
            else:
                # Get the end of the previous chunk to use as overlap
                prev_chunk = chunks[i-1]
                prev_words = prev_chunk.split()
                
                if len(prev_words) <= overlap_size:
                    # Previous chunk is small, use it all for context
                    overlap_text = prev_chunk
                else:
                    # Get the last N words from the previous chunk
                    overlap_text = ' '.join(prev_words[-overlap_size:])
                
                # Add the current chunk with the overlap prepended
                result.append(f"{overlap_text}... {chunk}")
                
        return result
    
    def process_document(self, document) -> List:
        """
        Process a document and create chunks.
        
        Args:
            document: Document model instance
            
        Returns:
            List of DocumentChunk instances created
        """
        logger.info(f"Processing document: {document.title} ({document.id})")
        
        if not document.content:
            logger.warning(f"Document {document.id} has no content")
            return []
            
        try:
            # Clean the document content
            text = self._clean_text(document.content)
            
            # Split into chunks
            chunks = self.chunk_text(text)
            logger.info(f"Created {len(chunks)} chunks from document {document.id}")
            
            # Create DocumentChunk instances
            document_chunks = []
            for i, chunk_text in enumerate(chunks):
                chunk = DocumentChunk.objects.create(
                    document=document,
                    content=chunk_text,
                    chunk_index=i
                )
                document_chunks.append(chunk)
                
            return document_chunks
            
        except Exception as e:
            logger.error(f"Error processing document {document.id}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
            
    def _clean_text(self, text: str) -> str:
        """
        Clean and normalize text.
        
        Args:
            text: Raw text
            
        Returns:
            Cleaned text
        """
        if not text:
            return ""
            
        # If we're cleaning HTML content, strip tags
        if text.strip().startswith('<') and '>' in text:
            soup = BeautifulSoup(text, 'html.parser')
            text = soup.get_text(separator=' ')
            
        # Replace repeated whitespace with a single space
        text = re.sub(r'\s+', ' ', text)
        
        # Fix common entity encoding issues
        text = html.unescape(text)
        
        # Remove very long sequences of non-alphanumeric characters
        text = re.sub(r'[^a-zA-Z0-9\s.,;:!?()\[\]{}\-_=+\'"`~#$%^&*|/\\]{10,}', ' ', text)
        
        # Remove excessive punctuation repetition (like !!!!! or ????)
        text = re.sub(r'([!?.]{2,})', lambda m: m.group(1)[0], text)
        
        # Normalize line endings
        text = text.replace('\r\n', '\n').replace('\r', '\n')
        
        return text.strip()
    
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
        
        # Prepare texts and metadata
        texts = [chunk.content for chunk in chunks]
        ids = [str(chunk.id) for chunk in chunks]
        metadatas = [{
            'document_id': str(document.id),
            'chunk_id': str(chunk.id),
            'document_title': document.title,
            'chunk_index': chunk.chunk_index
        } for chunk in chunks]
        
        # Add to vector store directly, letting ChromaDB handle embeddings internally
        logger.info(f"Adding {len(ids)} chunks to vector store, letting ChromaDB handle embeddings")
        self.vector_store.collection.add(
            documents=texts,
            metadatas=metadatas,
            ids=ids
        )
        
        logger.info(f"Added {len(ids)} chunks to vector store")
        return chunks 
    
    
    
 
#!/usr/bin/env python
"""
Test script for RAG system functionality.
"""
import os
import sys
import logging
import argparse
from pathlib import Path

# Django setup
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cometa_pj.settings")
django.setup()

# Import RAG system components
from backend.ee.modules.rag_system.document_processor import DocumentProcessor
from backend.ee.modules.rag_system.vector_store import VectorStore
from backend.ee.modules.rag_system.embeddings import get_embedder
from backend.ee.modules.rag_system.rag_engine import RAGEngine
from backend.ee.modules.rag_system.models import Document, DocumentChunk

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

def ingest_document(file_path, title=None, description=None):
    """
    Ingest a document into the RAG system.
    
    Args:
        file_path: Path to the document file
        title: Document title (optional)
        description: Document description (optional)
    
    Returns:
        Document object
    """
    file_path = Path(file_path)
    
    if not file_path.exists():
        logger.error(f"File not found: {file_path}")
        return None
    
    # Determine content type from extension
    extension = file_path.suffix.lower()
    content_type_map = {
        '.md': Document.TYPE_MARKDOWN,
        '.markdown': Document.TYPE_MARKDOWN,
        '.txt': Document.TYPE_TEXT,
        '.pdf': Document.TYPE_PDF,
        '.html': Document.TYPE_HTML,
        '.htm': Document.TYPE_HTML,
    }
    
    content_type = content_type_map.get(extension, Document.TYPE_TEXT)
    
    # Create document processor
    processor = DocumentProcessor()
    
    # Create document
    document = Document.objects.create(
        title=title or file_path.stem,
        source=str(file_path),
        description=description or "",
        content_type=content_type,
        status=Document.STATUS_PROCESSING
    )
    
    try:
        # Process document
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            document.content = content
            document.save()
        
        # Create vector store and embedder
        vector_store = VectorStore()
        embedder = get_embedder()
        
        # Process document and add to vector store
        chunks = processor.process_document(document)
        
        if chunks:
            # Generate embeddings and add to vector store
            texts = [chunk.content for chunk in chunks]
            embeddings = embedder.get_embeddings(texts)
            
            # Add to vector store
            metadata = [{
                'document_id': str(document.id),
                'chunk_id': str(chunk.id),
                'document_title': document.title,
                'chunk_index': chunk.chunk_index
            } for chunk in chunks]
            
            ids = [str(chunk.id) for chunk in chunks]
            
            vector_store.add_documents(texts, embeddings, metadata, ids)
            
            # Update document status
            document.status = Document.STATUS_COMPLETED
            document.chunk_count = len(chunks)
            document.save()
            
            logger.info(f"Successfully processed document: {document.title}")
            logger.info(f"Created {len(chunks)} chunks")
            
            return document
        else:
            document.status = Document.STATUS_FAILED
            document.error_message = "No chunks were created"
            document.save()
            logger.error(f"Failed to process document: {document.title}")
            return None
            
    except Exception as e:
        document.status = Document.STATUS_FAILED
        document.error_message = str(e)
        document.save()
        logger.error(f"Error processing document: {e}")
        return None

def test_query(query, num_results=3):
    """
    Test querying the RAG system.
    
    Args:
        query: Query text
        num_results: Number of results to return
    """
    try:
        rag_engine = RAGEngine()
        results = rag_engine.query(query, num_results=num_results)
        
        print(f"\nResults for query: '{query}'\n{'-' * 50}")
        for i, result in enumerate(results):
            print(f"\n[{i+1}] Document: {result['metadata']['document_title']}")
            print(f"Chunk #{result['metadata']['chunk_index']}")
            print(f"Similarity: {result['similarity']:.4f}")
            print(f"Content: {result['text'][:200]}...")
        
        return results
    except Exception as e:
        logger.error(f"Error querying RAG system: {e}")
        return None

def compare_queries(query_file, num_results=3):
    """
    Run multiple queries from a file and display results.
    
    Args:
        query_file: Path to file containing one query per line
        num_results: Number of results to return per query
    """
    try:
        with open(query_file, 'r', encoding='utf-8') as f:
            queries = [line.strip() for line in f if line.strip()]
        
        for query in queries:
            test_query(query, num_results)
            print("\n" + "=" * 70 + "\n")
    except Exception as e:
        logger.error(f"Error processing queries: {e}")

def main():
    parser = argparse.ArgumentParser(description='Test RAG system functionality')
    subparsers = parser.add_subparsers(dest='command', help='Command to run')
    
    # Ingest command
    ingest_parser = subparsers.add_parser('ingest', help='Ingest a document')
    ingest_parser.add_argument('file_path', help='Path to the document file')
    ingest_parser.add_argument('--title', help='Document title')
    ingest_parser.add_argument('--description', help='Document description')
    
    # Test command
    test_parser = subparsers.add_parser('test', help='Test a query')
    test_parser.add_argument('query', help='Query text')
    test_parser.add_argument('--num_results', type=int, default=3, help='Number of results to return')
    
    # Compare command
    compare_parser = subparsers.add_parser('compare', help='Run multiple queries from a file')
    compare_parser.add_argument('query_file', help='Path to file containing one query per line')
    compare_parser.add_argument('--num_results', type=int, default=3, help='Number of results to return per query')
    
    args = parser.parse_args()
    
    if args.command == 'ingest':
        ingest_document(args.file_path, args.title, args.description)
    elif args.command == 'test':
        test_query(args.query, args.num_results)
    elif args.command == 'compare':
        compare_queries(args.query_file, args.num_results)
    else:
        parser.print_help()

if __name__ == '__main__':
    main() 
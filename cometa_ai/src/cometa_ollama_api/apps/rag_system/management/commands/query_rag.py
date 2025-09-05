"""
Management command to query the RAG system.
"""
import logging
import json
from django.core.management.base import BaseCommand, CommandError

from apps.rag_system.rag_engine import RAGEngine
from apps.rag_system.models import Document

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Query the RAG system'

    def add_arguments(self, parser):
        parser.add_argument('query', type=str, help='Query text')
        parser.add_argument('--num-results', type=int, default=3, help='Number of results to return')

    def handle(self, *args, **options):
        query = options['query']
        num_results = options.get('num_results', 3)
        
        # First check if there are any documents in the system
        doc_count = Document.objects.count()
        if doc_count == 0:
            logger.warning("No documents available in the RAG system.")
            logger.warning("Please ingest documents first using the 'ingest_document' command:")
            logger.warning("  python manage.py ingest_document /path/to/document.md --title \"Document Title\"")
            return
            
        try:
            rag_engine = RAGEngine()
            query_result = rag_engine.query(query, num_results=num_results)
            
            logger.info(f"Results for query: '{query}'")
            logger.info('-' * 50)
            
            # Check if we have results
            if not query_result or not query_result.get('results'):
                logger.warning("No matching results found for your query.")
                logger.warning("Try a different query or ingest more relevant documents.")
                return
            
            # Get the results list from the response
            results = query_result.get('results', [])
            
            # Display RAG availability
            rag_available = query_result.get('rag_available', False)
            if not rag_available:
                logger.warning("RAG system is not available. Results may be limited.")
                
            # Process each result
            for i, result in enumerate(results):
                try:
                    # Check if result is a string (simple text) or a dictionary (structured data)
                    if isinstance(result, str):
                        # Handle string results
                        logger.info(f"[{i+1}] Result:")
                        logger.info(f"Content: {result[:200]}...")
                    else:
                        # Handle dictionary results
                        # Safely access metadata with proper error handling
                        metadata = result.get('metadata', {})
                        if not isinstance(metadata, dict):
                            metadata = {}
                            
                        doc_title = metadata.get('document_title', 'Unknown Document')
                        chunk_index = metadata.get('chunk_index', 'Unknown')
                        
                        logger.info(f"[{i+1}] Document: {doc_title}")
                        logger.info(f"Chunk #{chunk_index}")
                        logger.info(f"Similarity: {result.get('similarity', 0):.4f}")
                        
                        # Safely get text content
                        text = result.get('text', '')
                        if text:
                            logger.info(f"Content: {text[:200]}...")
                        else:
                            logger.info("Content: [No content available]")
                except Exception as item_error:
                    logger.error(f"Error processing result item: {item_error}")
                    logger.error(f"Result type: {type(result)}")
                    logger.error(f"Result value: {str(result)[:100]}")
            
        except Exception as e:
            logger.error(f"Error querying RAG system: {e}")
            logger.exception(f"Error querying RAG system with query: {query}")
            logger.warning("Troubleshooting tips:")
            logger.info("1. Make sure your documents are properly ingested")
            logger.info("2. Check if the vector store is accessible")
            logger.info("3. Run 'python manage.py test_rag' to verify system functionality")
            raise CommandError(f"Failed to query RAG system: {e}") 
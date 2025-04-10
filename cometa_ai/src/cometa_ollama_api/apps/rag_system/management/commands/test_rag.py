"""
Management command to test the RAG system.
"""
import logging
import time
from django.core.management.base import BaseCommand

from apps.rag_system.vector_store import VectorStore
from apps.rag_system.rag_engine import RAGEngine
from apps.rag_system.document_processor import DocumentProcessor
from apps.rag_system.models import Document

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Test the RAG system with a sample query'

    def add_arguments(self, parser):
        parser.add_argument('query', type=str, help='Test query')
        parser.add_argument('--top-k', type=int, default=5, help='Number of results to return')
        parser.add_argument('--json', action='store_true', help='Output in JSON format')

    def handle(self, *args, **options):
        query = options['query']
        top_k = options.get('top_k', 5)
        output_json = options.get('json', False)
        
        self.stdout.write(f"Testing RAG system with query: {query}")
        self.stdout.write(f"Top K: {top_k}")
        
        # First check if there are documents in the system
        doc_count = Document.objects.count()
        if doc_count == 0:
            self.stdout.write(self.style.WARNING("\nNo documents available in the RAG system."))
            self.stdout.write(self.style.WARNING("Please ingest documents first using the 'ingest_document' command:"))
            self.stdout.write(self.style.WARNING("  python manage.py ingest_document /path/to/document.md --title \"Document Title\""))
            return
        
        try:
            # Initialize RAG engine
            rag_engine = RAGEngine(top_k=top_k)
            
            # Process query
            result = rag_engine.process_query(query)
            
            # Output results
            if output_json:
                # Format for JSON output
                output = {
                    'query': query,
                    'has_context': result['has_context'],
                    'system_prompt': result['system'],
                    'context_docs': [
                        {
                            'id': doc['id'],
                            'content': doc['content'],
                            'metadata': doc['metadata'],
                            'relevance_score': doc['relevance_score'],
                        }
                        for doc in result['context_docs']
                    ]
                }
                self.stdout.write(json.dumps(output, indent=2))
            else:
                # Human-readable output
                self.stdout.write(self.style.SUCCESS(f"Query processed successfully"))
                
                if result['has_context']:
                    self.stdout.write("\nRetrieved context documents:")
                    for i, doc in enumerate(result['context_docs']):
                        self.stdout.write(self.style.SUCCESS(f"\nDocument {i+1}:"))
                        self.stdout.write(f"  ID: {doc['id']}")
                        self.stdout.write(f"  Relevance Score: {doc['relevance_score']:.4f}")
                        
                        # Print metadata
                        metadata = doc['metadata']
                        if metadata:
                            self.stdout.write("  Metadata:")
                            for key, value in metadata.items():
                                self.stdout.write(f"    {key}: {value}")
                        
                        # Print content preview (first few lines)
                        content_preview = "\n".join(doc['content'].split("\n")[:3])
                        if len(doc['content']) > len(content_preview):
                            content_preview += "\n..."
                        self.stdout.write(f"  Content Preview:\n{content_preview}")
                else:
                    self.stdout.write(self.style.WARNING("\nNo relevant context documents found"))
                
                self.stdout.write("\nSystem Prompt Preview:")
                prompt_preview = "\n".join(result['system'].split("\n")[:5])
                if len(result['system']) > len(prompt_preview):
                    prompt_preview += "\n..."
                self.stdout.write(prompt_preview)
                
        except InvalidDimensionException as e:
            self.stdout.write(self.style.ERROR(f"Embedding dimension mismatch error: {e}"))
            self.stdout.write(self.style.WARNING("\nThis error occurs when the embedding model used for ingestion is different from the one used for querying."))
            self.stdout.write(self.style.WARNING("To fix this issue:"))
            self.stdout.write(self.style.WARNING("1. Clear the RAG database: python manage.py clear_rag --force"))
            self.stdout.write(self.style.WARNING("2. Re-ingest your documents: python manage.py ingest_document ..."))
            logger.exception(f"Embedding dimension mismatch error with query: {query}")
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error testing RAG system: {e}"))
            self.stdout.write(self.style.WARNING("\nTroubleshooting tips:"))
            self.stdout.write(self.style.WARNING("1. Make sure your documents are properly ingested"))
            self.stdout.write(self.style.WARNING("2. Check if the Ollama service is running and accessible"))
            self.stdout.write(self.style.WARNING("3. Verify that the granite-embedding:278m model is available in Ollama"))
            logger.exception(f"Error testing RAG system with query: {query}") 
"""
Management command to ingest documents from a JSON file containing URLs.
"""
import os
import json
import logging
import tempfile
import requests
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.core.management import call_command

from apps.rag_system.document_processor import DocumentProcessor
from apps.rag_system.vector_store import VectorStore
from apps.rag_system.models import Document, DocumentChunk

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Ingest documents from a JSON file with URLs'

    def add_arguments(self, parser):
        parser.add_argument('json_path', type=str, help='Path to the JSON file containing documents to ingest')
        parser.add_argument('--clear', action='store_true', help='Clear existing RAG data before ingestion')
        parser.add_argument('--chunk-size', type=int, default=500, help='Size of document chunks')
        parser.add_argument('--chunk-overlap', type=int, default=100, help='Overlap between chunks')

    def handle(self, *args, **options):
        json_path = Path(options['json_path'])
        clear_first = options.get('clear', False)
        chunk_size = options.get('chunk_size', 500)
        chunk_overlap = options.get('chunk_overlap', 100)
        
        if not json_path.exists():
            raise CommandError(f"JSON file not found: {json_path}")
        
        # Clear existing data if requested
        if clear_first:
            self.stdout.write("Clearing existing RAG data...")
            call_command('clear_rag', '--force')
            self.stdout.write(self.style.SUCCESS("RAG data cleared successfully"))
        
        # Load the JSON file
        try:
            with open(json_path, 'r') as f:
                documents_data = json.load(f)
        except json.JSONDecodeError as e:
            raise CommandError(f"Invalid JSON file: {e}")
        
        self.stdout.write(f"Found {len(documents_data)} documents to ingest")
        
        # Create document processor
        processor = DocumentProcessor(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap
        )
        
        # Process each document
        successful = 0
        failed = 0
        
        for doc_data in documents_data:
            name = doc_data.get('name', 'Unknown')
            url = doc_data.get('url')
            description = doc_data.get('description', '')
            
            if not url:
                self.stdout.write(self.style.WARNING(f"Skipping document '{name}' - missing URL"))
                continue
            
            self.stdout.write(f"Processing document: {name} from {url}")
            
            try:
                # Download the document
                response = requests.get(url)
                response.raise_for_status()
                content = response.text
                
                # Determine content type from extension
                extension = Path(name).suffix.lower()
                content_type_map = {
                    '.md': Document.TYPE_MARKDOWN,
                    '.markdown': Document.TYPE_MARKDOWN,
                    '.txt': Document.TYPE_TEXT,
                    '.pdf': Document.TYPE_PDF,
                    '.html': Document.TYPE_HTML,
                    '.htm': Document.TYPE_HTML,
                }
                
                content_type = content_type_map.get(extension, Document.TYPE_TEXT)
                
                # Create document in the database
                document = Document.objects.create(
                    title=name,
                    source=url,
                    description=description,
                    content_type=content_type,
                    content=content,
                    status=Document.STATUS_PROCESSING
                )
                
                # Process document
                chunks = processor.process_document(document)
                
                if chunks:
                    # Create vector store
                    vector_store = VectorStore()
                    
                    # Generate embeddings and add to vector store
                    texts = [chunk.content for chunk in chunks]
                    
                    self.stdout.write(f"Adding {len(chunks)} chunks to vector store...")
                    
                    # Create metadata
                    metadata = [{
                        'document_id': str(document.id),
                        'chunk_id': str(chunk.id),
                        'document_title': document.title,
                        'chunk_index': chunk.chunk_index,
                        'source': url
                    } for chunk in chunks]
                    
                    ids = [str(chunk.id) for chunk in chunks]
                    
                    # Use direct add with query_texts to let ChromaDB handle embeddings consistently
                    vector_store.collection.add(
                        documents=texts,
                        metadatas=metadata,
                        ids=ids
                    )
                    
                    # Update document status
                    document.status = Document.STATUS_COMPLETED
                    document.chunk_count = len(chunks)
                    document.save()
                    
                    self.stdout.write(self.style.SUCCESS(f"Successfully processed document: {name}"))
                    self.stdout.write(self.style.SUCCESS(f"Created {len(chunks)} chunks"))
                    successful += 1
                    
                else:
                    document.status = Document.STATUS_FAILED
                    document.error_message = "No chunks were created"
                    document.save()
                    self.stdout.write(self.style.ERROR(f"Failed to process document: {name}"))
                    failed += 1
                    
            except requests.RequestException as e:
                self.stdout.write(self.style.ERROR(f"Error downloading document from {url}: {e}"))
                failed += 1
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error processing document {name}: {e}"))
                failed += 1
                
        # Summary
        self.stdout.write("\n" + "="*50)
        self.stdout.write(f"Ingestion complete. Successfully processed {successful} documents")
        if failed > 0:
            self.stdout.write(self.style.WARNING(f"Failed to process {failed} documents"))
        else:
            self.stdout.write(self.style.SUCCESS("All documents processed successfully")) 
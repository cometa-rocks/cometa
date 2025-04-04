"""
Management command to ingest a document into the RAG system.
"""
import os
import logging
from pathlib import Path
from django.core.management.base import BaseCommand, CommandError

from chatbot.rag_system.document_processor import DocumentProcessor
from chatbot.rag_system.vector_store import VectorStore
from chatbot.rag_system.models import Document, DocumentChunk

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Ingest a document into the RAG system'

    def add_arguments(self, parser):
        parser.add_argument('file_path', type=str, help='Path to the document file')
        parser.add_argument('--title', type=str, help='Document title')
        parser.add_argument('--description', type=str, help='Document description')
        parser.add_argument('--chunk-size', type=int, default=500, help='Size of document chunks')
        parser.add_argument('--chunk-overlap', type=int, default=100, help='Overlap between chunks')

    def handle(self, *args, **options):
        file_path = Path(options['file_path'])
        title = options.get('title')
        description = options.get('description')
        
        if not file_path.exists():
            raise CommandError(f"File not found: {file_path}")
        
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
        processor = DocumentProcessor(
            chunk_size=options.get('chunk_size', 500),
            chunk_overlap=options.get('chunk_overlap', 100)
        )
        
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
            document.content = processor.load_document(str(file_path), content_type)
            document.save()
            
            # Create vector store and embedder
            vector_store = VectorStore()
            
            # Process document and add to vector store
            chunks = processor.process_document(document)
            
            if chunks:
                # Generate embeddings and add to vector store
                texts = [chunk.content for chunk in chunks]

                self.stdout.write("Adding documents to vector store...")
                
                # Create metadata
                metadata = [{
                    'document_id': str(document.id),
                    'chunk_id': str(chunk.id),
                    'document_title': document.title,
                    'chunk_index': chunk.chunk_index
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
                
                self.stdout.write(self.style.SUCCESS(f"Successfully processed document: {document.title}"))
                self.stdout.write(self.style.SUCCESS(f"Created {len(chunks)} chunks"))
                
            else:
                document.status = Document.STATUS_FAILED
                document.error_message = "No chunks were created"
                document.save()
                self.stdout.write(self.style.ERROR(f"Failed to process document: {document.title}"))
                
        except Exception as e:
            document.status = Document.STATUS_FAILED
            document.error_message = str(e)
            document.save()
            self.stdout.write(self.style.ERROR(f"Error processing document: {e}"))
            raise CommandError(f"Error processing document: {e}") 
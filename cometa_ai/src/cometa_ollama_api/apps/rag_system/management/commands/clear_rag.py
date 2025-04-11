"""
Management command to clear all RAG data.
Useful for testing with and without RAG.
"""
import os
import shutil
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.rag_system.models import Document, DocumentChunk
from apps.rag_system.vector_store import VectorStore, DEFAULT_CHROMA_PATH
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Clear all RAG data from both the database and vector store'

    def add_arguments(self, parser):
        parser.add_argument(
            '--vector-store-only',
            action='store_true',
            help='Clear only the vector store, not the database records',
        )
        parser.add_argument(
            '--db-only',
            action='store_true',
            help='Clear only the database records, not the vector store',
        )
        parser.add_argument(
            '--force',
            action='store_true',
            help='Completely remove and recreate the ChromaDB directory',
        )

    def handle(self, *args, **options):
        vector_store_only = options.get('vector_store_only', False)
        db_only = options.get('db_only', False)
        force = options.get('force', False)
        
        if vector_store_only and db_only:
            self.stderr.write(self.style.ERROR('Cannot specify both --vector-store-only and --db-only'))
            return
        
        # Clear database records unless vector_store_only is True
        if not vector_store_only:
            try:
                with transaction.atomic():
                    document_count = Document.objects.count()
                    chunk_count = DocumentChunk.objects.count()
                    
                    DocumentChunk.objects.all().delete()
                    Document.objects.all().delete()
                    
                    self.stdout.write(self.style.SUCCESS(
                        f'Successfully deleted {document_count} documents and {chunk_count} chunks from the database'
                    ))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f'Error clearing database records: {e}'))
                return
        
        # Clear vector store unless db_only is True
        if not db_only:
            try:
                # If force is specified, completely remove the ChromaDB directory first
                if force:
                    chroma_path = os.environ.get('CHROMA_PATH', DEFAULT_CHROMA_PATH)
                    if os.path.exists(chroma_path):
                        self.stdout.write(f'Forcibly removing ChromaDB directory: {chroma_path}')
                        try:
                            # Remove directory and all contents
                            shutil.rmtree(chroma_path)
                            # Recreate empty directory
                            os.makedirs(chroma_path, exist_ok=True)
                            self.stdout.write(self.style.SUCCESS(f'Completely reset ChromaDB directory'))
                        except OSError as e:
                            if e.errno == 16:  # Device or resource busy
                                self.stdout.write(self.style.WARNING(
                                    f'Device or resource busy error detected. '
                                    f'This is normal if ChromaDB directory is mounted as a volume. '
                                    f'Will proceed with collection deletion instead.'
                                ))
                            else:
                                self.stderr.write(self.style.ERROR(f'Error forcibly clearing ChromaDB directory: {e}'))
                
                # Now use the VectorStore's delete_collection method to properly clean up
                vector_store = VectorStore()
                vector_store.delete_collection()
                
                # Try to initialize a new collection to verify everything works
                try:
                    vector_store = VectorStore()
                    count = vector_store.get_collection_count()
                    self.stdout.write(f'Verified new empty collection created with {count} documents')
                except Exception as verify_error:
                    self.stderr.write(self.style.ERROR(
                        f'Could not verify collection recreation: {verify_error}. '
                        f'Try running with --force option.'
                    ))
                    
                self.stdout.write(self.style.SUCCESS('Successfully cleared vector store'))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f'Error clearing vector store: {e}'))
                return
        
        self.stdout.write(self.style.SUCCESS('RAG system successfully cleared')) 
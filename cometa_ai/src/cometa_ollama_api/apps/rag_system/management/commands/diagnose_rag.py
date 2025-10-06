"""
Management command to diagnose RAG system issues, especially embedding dimension mismatches.
"""
import logging
import json
import requests
import os
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import models
from apps.rag_system.vector_store import VectorStore, RAG_MODEL
from apps.rag_system.rag_engine import RAGEngine
from apps.rag_system.models import Document, DocumentChunk

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = "Diagnose issues with the RAG system, especially embedding dimension mismatches"
    
    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Attempt to fix issues automatically',
        )
        parser.add_argument(
            '--test-query',
            type=str,
            help='Test query to use for diagnostics',
            default="What is Co.meta?"
        )
        parser.add_argument(
            '--json',
            action='store_true',
            help='Output diagnostics as JSON',
        )
        
    def handle(self, *args, **options):
        logger.info("Starting RAG system diagnostics")
        fix_mode = options.get('fix', False)
        test_query = options.get('test_query')
        as_json = options.get('json', False)
        
        diagnostics = {
            "vector_store": {},
            "embedding_model": {},
            "database": {},
            "rag_engine": {},
            "issues": [],
            "recommendations": []
        }
        
        # Step 1: Check vector store
        logger.info("1. Checking vector store...")
        vector_store = VectorStore()
        
        try:
            count = vector_store.get_collection_count()
            diagnostics["vector_store"]["collection_name"] = vector_store.collection_name
            diagnostics["vector_store"]["document_count"] = count
            diagnostics["vector_store"]["persistent_path"] = vector_store.persistent_path
            
            logger.info(f"Vector store collection '{vector_store.collection_name}' has {count} documents")
            logger.info(f"Persistent path: {vector_store.persistent_path}")
            
            # Get collection metadata
            try:
                collection = vector_store.collection
                if collection:
                    peek_results = collection.peek(limit=1)
                    if peek_results and 'embeddings' in peek_results:
                        if isinstance(peek_results['embeddings'], list) and len(peek_results['embeddings']) > 0:
                            collection_dim = len(peek_results['embeddings'][0])
                            diagnostics["vector_store"]["embedding_dimension"] = collection_dim
                            logger.info(f"Collection embedding dimension: {collection_dim}")
            except Exception as peek_error:
                diagnostics["vector_store"]["peek_error"] = str(peek_error)
                logger.warning(f"Could not get collection dimension: {peek_error}")
                
        except Exception as e:
            diagnostics["vector_store"]["error"] = str(e)
            logger.error(f"Error accessing vector store: {e}")
            return
            
        if count == 0:
            diagnostics["issues"].append("Vector store is empty")
            logger.warning("Vector store is empty. No documents to check.")
            return
            
        # Step 2: Check embedding model using Ollama API directly
        logger.info("2. Checking embedding model...")
        if not RAG_MODEL:
            diagnostics["embedding_model"]["name"] = None
            diagnostics["embedding_model"]["skipped"] = "RAG_MODEL not configured (using Chroma default embeddings)"
            logger.info("Embedding model check skipped: using ChromaDB default embeddings.")
            test_embedding = None
        else:
            try:
                # Get Ollama host from environment variable or use default
                ollama_host = "http://localhost:8083"
                diagnostics["embedding_model"]["name"] = RAG_MODEL
                diagnostics["embedding_model"]["host"] = ollama_host
                
                logger.info(f"Using embedding model: {RAG_MODEL}")
                logger.info(f"Model host: {ollama_host}")
                
                # Generate test embedding directly from Ollama API
                logger.info(f"Generating test embedding for query: '{test_query}'")
                
                try:
                    response = requests.post(
                        f"{ollama_host}/api/embeddings",
                        json={"model": RAG_MODEL, "prompt": test_query}
                    )
                    
                    if response.status_code != 200:
                        raise Exception(f"Failed to get embedding: {response.text}")
                        
                    data = response.json()
                    test_embedding = data.get('embedding', [])
                    
                    # Convert to numerical array for stats
                    import numpy as np
                    test_embedding = np.array(test_embedding, dtype=np.float32)
                    
                    embedding_dim = len(test_embedding)
                    diagnostics["embedding_model"]["embedding_dimension"] = embedding_dim
                    diagnostics["embedding_model"]["embedding_stats"] = {
                        "min": float(test_embedding.min()),
                        "max": float(test_embedding.max()),
                        "mean": float(test_embedding.mean())
                    }
                    
                    logger.info(f"Generated embedding with dimension: {embedding_dim}")
                    logger.info(f"Embedding stats - Min: {test_embedding.min():.4f}, Max: {test_embedding.max():.4f}, Mean: {test_embedding.mean():.4f}")
                    
                except Exception as e:
                    raise Exception(f"Error connecting to Ollama API: {str(e)}")
                
            except Exception as e:
                diagnostics["embedding_model"]["error"] = str(e)
                logger.error(f"Error with embedding model: {e}")
                return
            
        # Step 3: Check database
        logger.info("3. Checking database...")
        try:
            doc_count = Document.objects.count()
            chunk_count = DocumentChunk.objects.count()
            diagnostics["database"]["document_count"] = doc_count
            diagnostics["database"]["chunk_count"] = chunk_count
            
            logger.info(f"Database has {doc_count} documents and {chunk_count} chunks")
            
            # Get document types distribution
            doc_types = Document.objects.values('content_type').annotate(count=models.Count('id'))
            diagnostics["database"]["document_types"] = list(doc_types)
            logger.info("Document types distribution:")
            for doc_type in doc_types:
                logger.info(f"- {doc_type['content_type']}: {doc_type['count']}")
                
        except Exception as e:
            diagnostics["database"]["error"] = str(e)
            logger.error(f"Error checking database: {e}")
            
        # Step 4: Diagnose dimension mismatch
        logger.info("4. Diagnosing dimension mismatch...")
        dimension_diagnostics = vector_store.diagnose_dimension_mismatch(test_embedding)
        diagnostics["dimension_diagnostics"] = dimension_diagnostics
        
        if dimension_diagnostics["dimension_mismatch"]:
            diagnostics["issues"].append(
                f"DIMENSION MISMATCH: Current embedding model produces {dimension_diagnostics['test_query_dim']}-dimensional vectors, "
                f"but collection has {dimension_diagnostics['collection_dim']}-dimensional vectors"
            )
            logger.error(
                f"DIMENSION MISMATCH DETECTED: Current embedding model produces {dimension_diagnostics['test_query_dim']}-dimensional vectors, "
                f"but collection has {dimension_diagnostics['collection_dim']}-dimensional vectors"
            )
            
            if fix_mode:
                logger.warning("Fix mode enabled - attempting to resolve the mismatch...")
                logger.warning(
                    "This will delete your existing vector store and require reingesting all documents!"
                )
                
                proceed = input("Are you sure you want to proceed? (y/N): ").lower() == 'y'
                
                if proceed:
                    try:
                        logger.info("Clearing existing vector store...")
                        vector_store.delete_collection()
                        diagnostics["fix_applied"] = True
                        logger.info("Vector store cleared. You can now reingest your documents")
                        logger.info(
                            "Run 'python manage.py ingest_documents' to reingest all documents"
                        )
                    except Exception as e:
                        diagnostics["fix_error"] = str(e)
                        logger.error(f"Error clearing vector store: {e}")
                else:
                    diagnostics["fix_cancelled"] = True
                    logger.info("Fix operation cancelled.")
            else:
                diagnostics["recommendations"].append("Run this command with --fix to clear the vector store and reingest documents")
                logger.info("To fix this issue:")
                logger.info("  1. Run 'python manage.py diagnose_rag --fix'")
                logger.info("  2. Run 'python manage.py ingest_documents' to reingest your documents")
        else:
            logger.info("No dimension mismatch detected")
            
        # Step 5: Check RAG engine
        logger.info("5. Testing RAG engine...")
        try:
            rag_engine = RAGEngine()
            has_rag_data = rag_engine.has_rag_data()
            diagnostics["rag_engine"]["has_data"] = has_rag_data
            
            logger.info(f"RAG data available: {has_rag_data}")
            
            if has_rag_data:
                logger.info(f"Querying RAG with: '{test_query}'")
                try:
                    result = rag_engine.process_query(test_query)
                    context_count = len(result.get('context_docs', []))
                    diagnostics["rag_engine"]["query_success"] = True
                    diagnostics["rag_engine"]["context_count"] = context_count
                    
                    # Log context document information
                    if context_count > 0:
                        diagnostics["rag_engine"]["context_docs"] = []
                        for i, doc in enumerate(result.get('context_docs', [])[:3]):
                            doc_info = {
                                "relevance": doc.get('relevance_score', 0),
                                "source": doc.get('metadata', {}).get('source', 'Unknown'),
                                "content_length": len(doc.get('content', ''))
                            }
                            diagnostics["rag_engine"]["context_docs"].append(doc_info)
                            logger.info(f"Doc {i+1}: Relevance={doc_info['relevance']:.4f}, "
                                           f"Source={doc_info['source']}, "
                                           f"Content length={doc_info['content_length']}")
                    
                    logger.info(f"RAG query successful - found {context_count} relevant documents")
                except Exception as e:
                    diagnostics["rag_engine"]["query_error"] = str(e)
                    logger.error(f"Error processing RAG query: {e}")
        except Exception as e:
            diagnostics["rag_engine"]["error"] = str(e)
            logger.error(f"Error initializing RAG engine: {e}")
            
        # Output summary
        logger.info("=== Diagnostics Summary ===")
        if diagnostics["issues"]:
            logger.error("Issues Found:")
            for issue in diagnostics["issues"]:
                logger.error(f"- {issue}")
        else:
            logger.info("No issues detected. Your RAG system appears to be functioning properly.")
            
        if diagnostics["recommendations"]:
            logger.info("Recommendations:")
            for rec in diagnostics["recommendations"]:
                logger.info(f"- {rec}")
                
        # Output as JSON if requested
        if as_json:
            logger.info("Diagnostics as JSON:")
            logger.info(json.dumps(diagnostics, indent=2, default=str))

"""
Views for the RAG system.
"""
import json
import logging
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt

from .rag_engine import RAGEngine

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def rag_query(request):
    """
    Process a RAG query and return relevant context.
    
    Expected POST body:
    {
        "query": "User query text",
        "num_results": 3  # Optional, defaults to 3
    }
    
    Returns:
    {
        "success": true,
        "data": {
            "query": "Original query",
            "results": [
                {
                    "text": "Document content",
                    "metadata": { ... },
                    "similarity": 0.95
                },
                ...
            ],
            "rag_available": true|false  # Whether RAG data is available
        }
    }
    """
    try:
        # Parse request body
        data = json.loads(request.body)
        query = data.get('query')
        num_results = data.get('num_results', 3)
        
        if not query:
            return JsonResponse({
                'success': False,
                'error': 'Missing required parameter: query'
            }, status=400)
        
        try:
            # Initialize RAG engine
            rag_engine = RAGEngine()
            
            # First check if RAG data is available
            has_rag_data = rag_engine.has_rag_data()
            
            # Query for relevant documents
            result_data = rag_engine.query(query, num_results=num_results)
            
            # Return results
            return JsonResponse({
                'success': True,
                'data': result_data
            })
        except Exception as e:
            # Handle specific AI service errors
            error_message = str(e)
            if "Error connecting to Ollama API" in error_message or "Failed to resolve" in error_message:
                logger.warning(f"AI service unavailable: {e}")
                # Return a graceful response indicating AI service is unavailable
                return JsonResponse({
                    'success': False,
                    'error': 'AI service is currently unavailable',
                    'data': {
                        'query': query,
                        'results': [],
                        'rag_available': False
                    }
                })
            else:
                # Re-raise other exceptions to be caught by the outer try/except
                raise
            
    except json.JSONDecodeError:
        logger.exception("Invalid JSON in request body")
        return JsonResponse({
            'success': False,
            'error': 'Invalid JSON in request body'
        }, status=400)
    except Exception as e:
        logger.exception(f"Error processing RAG query: {e}")
        return JsonResponse({
            'success': False,
            'error': str(e),
            'data': {
                'query': query if 'query' in locals() else '',
                'results': [],
                'rag_available': False
            }
        }, status=200)  # Return 200 instead of 500 to handle gracefully in frontend

@csrf_exempt
@require_http_methods(["GET"])
def rag_stats(request):
    """
    API endpoint to get RAG system statistics
    """
    try:
        try:
            # Initialize RAG engine
            rag_engine = RAGEngine()
            
            # Check if RAG data is available
            has_rag_data = rag_engine.has_rag_data()
            
            return JsonResponse({
                'success': True,
                'data': {
                    'rag_available': has_rag_data,
                    'document_count': rag_engine.vector_store.get_collection_count() if has_rag_data else 0,
                    'collection_name': rag_engine.vector_store.collection_name
                }
            })
        except Exception as e:
            # Handle specific AI service errors
            error_message = str(e)
            if "Error connecting to Ollama API" in error_message or "Failed to resolve" in error_message:
                logger.warning(f"AI service unavailable: {e}")
                # Return a graceful response indicating AI service is unavailable
                return JsonResponse({
                    'success': False,
                    'error': 'AI service is currently unavailable.',
                    'data': {
                        'rag_available': False,
                        'document_count': 0,
                        'collection_name': 'unavailable'
                    }
                })
            else:
                # Re-raise other exceptions to be caught by the outer try/except
                raise
    except Exception as e:
        logger.error(f"Error getting RAG stats: {str(e)}")
        return JsonResponse({
            'success': False, 
            'error': str(e),
            'data': {
                'rag_available': False,
                'document_count': 0,
                'collection_name': 'error'
            }
        }) 
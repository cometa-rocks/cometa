from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
import requests
import json
import logging
import os
import socket
import uuid
import time

# Import RAG system components
from backend.ee.modules.rag_system.rag_engine import RAGEngine
from backend.ee.modules.rag_system.vector_store import RAG_MODEL

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
def chat_completion(request):
    """Proxy requests to Ollama API for chat completions with RAG enhancement"""
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()

    logger.info(f"Request received: {request.data}")
    
    try:
        # Extract user message and chat history
        data = request.data
        user_message = data.get('message', '')
        chat_history = data.get('history', [])
        
        logger.info(f"[{request_id}] Processing chat request: '{user_message[:50]}...' (if truncated)")

        # Base system prompt
        base_system_prompt = """You are Co.meta's AI assistant. Co.meta is a test automation platform.
        Help users with questions about test creation, execution, scheduling, and other platform features.
        Be concise, helpful, and accurate. If you don't know something, say so rather than making up information.
        
        Co.meta allows users to create automated tests for web applications without coding.
        Key features include:
        - Creating test steps using a visual editor
        - Running tests on different browsers
        - Scheduling tests to run automatically
        - Viewing test results and screenshots
        - AI-powered testing capabilities
        """
        
        # Always use RAG - no longer check use_rag parameter
        augmented_prompt = base_system_prompt
        rag_context = []
        
        try:
            # Initialize RAG engine
            logger.info(f"[{request_id}] Initializing RAG engine...")
            rag_engine = RAGEngine(top_k=5)
            
            # Process query to get relevant documents
            logger.info(f"[{request_id}] Using RAG for query: '{user_message}'")
            rag_result = rag_engine.process_query(
                query=user_message,
                system_prompt=base_system_prompt
            )
            
            # Use the augmented system prompt if context was found
            if rag_result['has_context']:
                augmented_prompt = rag_result['system']
                rag_context = rag_result['context_docs']
                logger.info(f"[{request_id}] Found {len(rag_context)} relevant documents for RAG")
                if rag_context:
                    # Log a sample of the documents retrieved
                    for i, doc in enumerate(rag_context[:2]):  # Log just 2 docs
                        score = doc['relevance_score']
                        meta = doc['metadata']
                        source = meta.get('source', 'Unknown')
                        logger.info(f"[{request_id}] Doc {i+1}: Score={score:.4f}, Source={source}")
            else:
                logger.info(f"[{request_id}] No relevant documents found for RAG")
        except Exception as e:
            logger.warning(f"[{request_id}] Error using RAG system: {str(e)}")
            import traceback
            logger.warning(f"[{request_id}] RAG traceback: {traceback.format_exc()}")
            # Continue without RAG enhancement
            augmented_prompt = base_system_prompt
        
        # Format messages for Ollama
        messages = [{"role": "system", "content": augmented_prompt}]
        
        # Add chat history (limited to last 10 messages for context)
        for msg in chat_history[-10:]:
            role = "assistant" if not msg.get("isUser", True) else "user"
            messages.append({"role": role, "content": msg.get("text", "")})
        
        # Add current user message
        messages.append({"role": "user", "content": user_message})
        
        # Get Ollama host from environment variable or use default
        ollama_host = os.environ.get('OLLAMA_HOST', 'ollama.ai')
        ollama_port = os.environ.get('OLLAMA_PORT', '8083')
        ollama_url = f"http://{ollama_host}:{ollama_port}/api/chat"
        
        try:
            # Call Ollama API
            logger.info(f"[{request_id}] Calling Ollama API at {ollama_url}")
            ollama_response = requests.post(
                ollama_url,
                json={
                    "model": RAG_MODEL,
                    "messages": messages,
                    "stream": False,
                    "options": {
                        "temperature": 0.1,
                        "top_p": 0.95,
                        "top_k": 100,
                        "num_ctx": 4096,
                        "num_predict": 1500,
                    }
                },
                timeout=60  # Set a timeout to prevent hanging requests
            )
            
            # Process response
            if ollama_response.status_code == 200:
                result = ollama_response.json()
                assistant_message = result.get("message", {}).get("content", "")
                
                # Create response with additional RAG info
                response_data = {
                    "message": assistant_message,
                    "success": True
                }
                
                elapsed_time = time.time() - start_time
                logger.info(f"[{request_id}] Request completed successfully in {elapsed_time:.2f}s")
                return Response(response_data)
            else:
                logger.error(f"[{request_id}] Error from Ollama API: {ollama_response.status_code} - {ollama_response.text}")
                return Response({
                    "message": "I'm sorry, but I'm having trouble processing your request right now. Please try again later.",
                    "success": False,
                    "error": f"AI service error: {ollama_response.status_code}"
                }, status=200)
        
        except requests.exceptions.Timeout:
            logger.error(f"[{request_id}] Timeout connecting to Ollama API at {ollama_url}")
            return Response({
                "message": "I'm sorry, but the AI service is taking too long to respond. Please try again later.",
                "success": False,
                "error": "AI service timeout"
            }, status=200)
            
        except requests.exceptions.ConnectionError as e:
            logger.error(f"[{request_id}] Connection error to Ollama API: {str(e)}")
            return Response({
                "message": "I'm sorry, but the AI service is currently unavailable. Our team has been notified of this issue. Please try again later.",
                "success": False,
                "error": "AI service connection error"
            }, status=200)
            
        except Exception as e:
            logger.error(f"[{request_id}] Error calling Ollama API: {str(e)}")
            return Response({
                "message": "I'm sorry, but I encountered an unexpected error. Our team has been notified. Please try again later.",
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }, status=200)
            
    except socket.gaierror as e:
        logger.error(f"[{request_id}] DNS resolution error: {str(e)}")
        return Response({
            "message": "I'm sorry, but the AI service is currently unavailable due to a network issue. Our team has been notified.",
            "success": False,
            "error": "DNS resolution error"
        }, status=200)
        
    except Exception as e:
        logger.error(f"[{request_id}] Internal server error in chat_completion: {str(e)}")
        return Response({
            "message": "I'm sorry, but I encountered an unexpected error. Our team has been notified. Please try again later.",
            "success": False,
            "error": str(e)
        }, status=200)
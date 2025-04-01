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
import traceback

# Import URL helpers
from backend.utility.config_handler import get_cometa_behave_url

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
def chat_completion(request):
    """Proxy requests to Ollama API for chat completions"""
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
        
        try:
            # Prepare the payload for the behave server
            payload = {
                'message': user_message,
                'history': chat_history,
                'system_prompt': base_system_prompt,
            }
            
            # Make request to the behave server's chat completion endpoint
            logger.info(f"[{request_id}] Sending request to behave server for chat completion")
            behave_url = f"{get_cometa_behave_url()}/api/chat/completion/"
            
            response = requests.post(
                behave_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=120
            )
            
            # Check if the request was successful
            if response.status_code == 200:
                result = response.json()
                
                if result.get('success', False):
                    response_data = {
                        "message": result.get('message', ''),
                        "success": True
                    }
                    
                    elapsed_time = time.time() - start_time
                    logger.info(f"[{request_id}] Request completed successfully in {elapsed_time:.2f}s")
                    return Response(response_data)
                else:
                    logger.error(f"[{request_id}] Error from behave server: {result.get('error', 'Unknown error')}")
                    return Response({
                        "message": "I'm sorry, but I'm having trouble processing your request right now. Please try again later.",
                        "success": False,
                        "error": result.get('error', 'Unknown error')
                    }, status=200)
            else:
                logger.error(f"[{request_id}] Error from behave server: {response.status_code} - {response.text}")
                return Response({
                    "message": "I'm sorry, but I'm having trouble communicating with the AI service. Please try again later.",
                    "success": False,
                    "error": f"Behave server error: {response.status_code}"
                }, status=200)
                
        except requests.RequestException as e:
            logger.error(f"[{request_id}] Request exception: {str(e)}")
            return Response({
                "message": "I'm sorry, but I'm having trouble communicating with the AI service. Please try again later.",
                "success": False,
                "error": f"Request error: {str(e)}"
            }, status=200)
            
        except Exception as e:
            logger.error(f"[{request_id}] Error in chat completion request: {str(e)}")
            logger.error(f"[{request_id}] Traceback: {traceback.format_exc()}")
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
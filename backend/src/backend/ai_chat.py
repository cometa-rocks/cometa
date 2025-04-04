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
import re

logger = logging.getLogger(__name__)

@api_view(['POST'])
@permission_classes([AllowAny])
def chat_completion(request):
    """Proxy requests to django.ai service for chat completions"""
    request_id = str(uuid.uuid4())[:8]
    start_time = time.time()

    logger.info(f"[{request_id}] Request received: {request.data}")
    
    try:
        # Get django.ai service details from environment
        django_api_host = os.environ.get('DJANGO_API_HOST', 'cometa.django.ai')
        django_api_port = os.environ.get('DJANGO_API_PORT', '8000')
        django_api_url = f"http://{django_api_host}:{django_api_port}/api/chat/"
        
        logger.info(f"[{request_id}] Forwarding request to django.ai service: {django_api_url}")
        
        # Log the exact request being sent
        request_data = request.data.copy()
        
        # Get current message and chat history
        user_message = request_data.get('message', '')
        chat_history = request_data.get('history', [])
        
        # Format conversation history for the LLM
        conversation_history = []
        for msg in chat_history[-15:]:  # Get last 15 messages instead of 10
            role = "assistant" if not msg.get("isUser", True) else "user"
            conversation_history.append({"role": role, "content": msg.get("text", "")})
        
        # Add conversation history to the request
        request_data['conversation_history'] = conversation_history
        
        # Always make request synchronous
        request_data['wait'] = True
        logger.info(f"[{request_id}] Request data with history: {json.dumps(request_data)}")
        
        # Forward the request directly to django.ai
        django_response = requests.post(
            django_api_url,
            json=request_data,
            timeout=60
        )
        
        # Log detailed response information
        logger.info(f"[{request_id}] Received response from django.ai with status code: {django_response.status_code}")
        
        try:
            response_content = django_response.json()
            logger.info(f"[{request_id}] Response content: {json.dumps(response_content)}")
            
            # Extract the response message and success from the django.ai response
            # and format it in the original expected structure
            response_message = "I'm sorry, I couldn't process your request. Please try again later."
            success = False
            
            if django_response.status_code == 200:
                # Handle job-based responses
                if 'status' in response_content:
                    status = response_content.get('status')
                    
                    if status == 'finished' and 'result' in response_content:
                        result = response_content.get('result', {})
                        if isinstance(result, dict):
                            if 'response' in result:
                                response_message = result['response']
                                success = result.get('success', True)
                            elif 'message' in result:
                                response_message = result['message']
                                success = True
                    elif status in ['pending', 'processing']:
                        response_message = "I'm processing your request. Please wait a moment..."
                        success = True
                
                # Handle direct response formats
                elif 'response' in response_content:
                    response_message = response_content['response']
                    success = True
                elif 'message' in response_content:
                    response_message = response_content['message']
                    success = True
                elif 'result' in response_content and isinstance(response_content['result'], dict):
                    result = response_content['result']
                    if 'response' in result:
                        response_message = result['response']
                        success = result.get('success', True)
                    elif 'message' in result:
                        response_message = result['message']
                        success = True

            # Create the response in the expected format with the correct field names
            response_data = {
                "message": response_message,
                "success": success
            }
            
            logger.info(f"[{request_id}] Formatted response: {json.dumps(response_data)}")
            
            # Return the response in the original expected format
            elapsed_time = time.time() - start_time
            logger.info(f"[{request_id}] Request completed in {elapsed_time:.2f}s")
            
            return Response(response_data)
            
        except json.JSONDecodeError:
            error_text = django_response.text[:200]
            logger.error(f"[{request_id}] Could not decode JSON response: {error_text}")
            return Response({
                "message": "I'm sorry, I couldn't process your request. Please try again later.",
                "success": False
            })
        except Exception as e:
            logger.error(f"[{request_id}] Error analyzing response: {str(e)}")
            return Response({
                "message": "I'm sorry, I couldn't process your request. Please try again later.",
                "success": False
            })
        
    except requests.exceptions.Timeout:
        logger.error(f"[{request_id}] Timeout connecting to django.ai service")
        return Response({
            "message": "I'm sorry, the AI service is taking too long to respond. Please try again later.",
            "success": False
        })
        
    except requests.exceptions.ConnectionError as e:
        logger.error(f"[{request_id}] Connection error to django.ai service: {str(e)}")
        return Response({
            "message": "I'm sorry, the AI service is currently unavailable. Please try again later.",
            "success": False
        })
        
    except socket.gaierror as e:
        logger.error(f"[{request_id}] DNS resolution error: {str(e)}")
        return Response({
            "message": "I'm sorry, the AI service is currently unavailable. Please try again later.",
            "success": False
        })
        
    except Exception as e:
        logger.error(f"[{request_id}] Error in chat_completion: {str(e)}")
        import traceback
        logger.error(f"[{request_id}] Traceback: {traceback.format_exc()}")
        return Response({
            "message": "I'm sorry, I encountered an unexpected error. Please try again later.",
            "success": False
        })
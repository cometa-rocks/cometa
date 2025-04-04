from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rq import Queue
import os
import json
import time

# Import the Redis connection
from src.connections.redis_connection import connect_redis

# Import RAG system
from chatbot.rag_system.rag_engine import RAGEngine
from chatbot.rag_system.vector_store import VectorStore, RAG_MODEL

# Define the Redis queue name for chatbot
REDIS_CHATBOT_QUEUE_NAME = os.getenv("REDIS_CHATBOT_QUEUE_NAME", "chatbot_queue")
LLM_MODEL = os.getenv("LLM_MODEL", "granite3.2")
class ChatbotView(APIView):
    """
    API endpoint for chatbot interactions using Redis queue and Ollama.
    """
    def post(self, request):
        try:
            # Get message from request data
            user_message = request.data.get('message', '')
            conversation_history = request.data.get('conversation_history', [])
            
            if not user_message:
                return Response(
                    {'error': 'Message field is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Use RAG to enhance the query with relevant context
            try:
                rag_engine = RAGEngine(top_k=5)
                rag_result = rag_engine.process_query(
                    query=user_message,
                    system_prompt=None  # Use default system prompt
                )
                
                # If RAG found relevant context, use the augmented prompt
                if rag_result['has_context']:
                    # Use the augmented system prompt with context
                    user_message = f"{rag_result['system']}\n\nUser query: {user_message}"
            except Exception as rag_error:
                # Log the error but continue without RAG enhancement
                print(f"RAG enhancement failed: {rag_error}")
            
            # Connect to Redis
            redis_conn = connect_redis()
            
            # Create a queue
            chatbot_queue = Queue(REDIS_CHATBOT_QUEUE_NAME, connection=redis_conn)
            
            # Enqueue the job to the worker with conversation history
            job = chatbot_queue.enqueue(
                'src.workers.chatbot_worker.process_chat', 
                user_message, 
                LLM_MODEL,
                conversation_history,
                job_timeout=60  # 60 seconds timeout
            )
            
            # Always wait for the response
            # Maximum wait time in seconds
            max_wait_time = 30
            start_time = time.time()
            
            # Poll the job status until it's finished or failed
            while job.is_queued or job.is_scheduled or job.is_started:
                # Check if we've exceeded the maximum wait time
                if time.time() - start_time > max_wait_time:
                    return Response({
                        'status': 'pending',
                        'message': 'Response taking longer than expected.'
                    })
                
                # Wait a short interval before checking again
                time.sleep(0.5)
            
            # Once the job is finished, return the result
            if job.is_finished:
                return Response({
                    'status': 'finished',
                    'result': job.result
                })
            elif job.is_failed:
                return Response({
                    'status': 'failed',
                    'error': job.exc_info
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            return Response({
                'status': 'error',
                'message': 'Unexpected flow - job neither finished nor failed'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

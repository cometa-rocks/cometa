from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rq import Queue
import os
import json
import time
import logging

# Import the Redis connection
from src.connections.redis_connection import connect_redis

# Define the Redis queue name for chatbot
REDIS_CHATBOT_QUEUE_NAME = os.getenv("REDIS_CHATBOT_QUEUE_NAME", "chatbot_queue")
JOB_TIMEOUT = int(os.getenv("CHATBOT_JOB_TIMEOUT", "60"))
MAX_WAIT_TIME = int(os.getenv("CHATBOT_MAX_WAIT_TIME", "30"))

logger = logging.getLogger(__name__)

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
            
            # Connect to Redis
            redis_conn = connect_redis()
            
            # Create a queue
            chatbot_queue = Queue(REDIS_CHATBOT_QUEUE_NAME, connection=redis_conn)
            
            # Enqueue the job to the worker with conversation history
            job = chatbot_queue.enqueue(
                'src.workers.chatbot_worker.process_chat', 
                user_message, 
                conversation_history,
                job_timeout=JOB_TIMEOUT
            )
            
            # Always wait for the response
            start_time = time.time()
            
            # Poll the job status until it's finished or failed
            while job.is_queued or job.is_scheduled or job.is_started:
                # Check if we've exceeded the maximum wait time
                if time.time() - start_time > MAX_WAIT_TIME:
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

from __future__ import annotations

import logging
import os
import time
from typing import Any, List, TypedDict

from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rq import Queue
from rq.job import Job

from src.connections.redis_connection import connect_redis

REDIS_CHATBOT_QUEUE_NAME = os.getenv("REDIS_CHATBOT_QUEUE_NAME", "chatbot_queue")
JOB_TIMEOUT = int(os.getenv("CHATBOT_JOB_TIMEOUT", "60"))
MAX_WAIT_TIME = int(os.getenv("CHATBOT_MAX_WAIT_TIME", "30"))

logger = logging.getLogger(__name__)


class ConversationEntry(TypedDict):
    role: str
    content: str


class JobResponse(TypedDict, total=False):
    status: str
    result: Any
    error: Any
    message: str


class ChatbotView(APIView):
    """API endpoint for chatbot interactions using Redis queue and Ollama."""

    def post(self, request: Request) -> Response:
        try:
            raw_message = request.data.get("message")
            user_message: str = str(raw_message) if raw_message else ""

            raw_history = request.data.get("conversation_history", [])
            conversation_history: List[ConversationEntry] = []
            if isinstance(raw_history, list):
                for item in raw_history:
                    if (
                        isinstance(item, dict)
                        and isinstance(item.get("role"), str)
                        and isinstance(item.get("content"), str)
                    ):
                        conversation_history.append(
                            {"role": item["role"], "content": item["content"]}
                        )

            if not user_message:
                return Response({"error": "Message field is required"}, status=status.HTTP_400_BAD_REQUEST)

            redis_conn = connect_redis()
            chatbot_queue: Queue = Queue(REDIS_CHATBOT_QUEUE_NAME, connection=redis_conn)

            job: Job = chatbot_queue.enqueue(
                "src.workers.chatbot_worker.process_chat",
                user_message,
                conversation_history,
                job_timeout=JOB_TIMEOUT,
            )

            start_time = time.time()
            while job.is_queued or job.is_scheduled or job.is_started:
                if time.time() - start_time > MAX_WAIT_TIME:
                    return Response({"status": "pending", "message": "Response taking longer than expected."})
                time.sleep(0.5)

            if job.is_finished:
                payload: JobResponse = {"status": "finished", "result": job.result}
                return Response(payload)

            if job.is_failed:
                payload = JobResponse(status="failed", error=job.exc_info)
                return Response(payload, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            payload = JobResponse(status="error", message="Unexpected flow - job neither finished nor failed")
            return Response(payload, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        except Exception as exc:  # pragma: no cover - defensive guardrail
            logger.exception("ChatbotView.post failed", exc_info=exc)
            payload = JobResponse(error=str(exc))
            return Response(payload, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

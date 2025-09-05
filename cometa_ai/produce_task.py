from rq import Queue
from redis import Redis
from src.connections.redis_connection import (
    connect_redis,
    REDIS_IMAGE_ANALYSYS_QUEUE_NAME,
)
import time

redis_connection = connect_redis()

queue = Queue(REDIS_IMAGE_ANALYSYS_QUEUE_NAME, connection=redis_connection)

messages = [
    {
        "role": "user",
        "content": """Answer only below questions related to this image 
                1. Does this image have cars in it? (Answer Yes/No) 
                2. Which color the car is? (Answer only color)
                3. How many cars do you see in the image (Answer only number)
                """,
    }
]

worker_name = "src.workers.image_analyst.analyze_image"


# Enqueue the task
job = queue.enqueue(worker_name, messages=messages)
logger.info(f"Task queued, job ID: {job.id}")

# Polling the job status to wait for it to finish
while job.is_queued or job.is_scheduled or job.is_started:
    logger.info(f"Waiting for job {job.id} to finish...")
    time.sleep(2)

# Once the job is finished, retrieve the result
if job.is_finished:
    # This will contain the return value from analyze_image
    logger.info(f"Task completed successfully, result: {job.result}")
elif job.is_failed:
    logger.error(f"Task failed, reason: {job.exc_info}")

from rq import Queue
from redis import Redis
from redis_connection import connect_redis, REDIS_IMAGE_ANALYSYS_QUEUE_NAME
import time

redis_connection = connect_redis()

queue = Queue(REDIS_IMAGE_ANALYSYS_QUEUE_NAME, connection=redis_connection)

data = {
            'role': 'user',
            'images': ['./images/image1.png'],
            'prompt': '''Answer only below questions related to this image 
                1. Does this image have cars in it? (Answer Yes/No) 
                2. Which color the car is? (Answer only color)
                3. How many cars do you see in the image (Answer only number)
                '''
        }

worker_name = "src.message_broker.workers.image_analyst.analyze_image" 


# Enqueue the task
job = queue.enqueue(worker_name, data=data)
print(f"Task queued, job ID: {job.id}")

# Polling the job status to wait for it to finish
while job.is_queued or job.is_scheduled or job.is_started:
    print(f"Waiting for job {job.id} to finish...")
    time.sleep(2)

# Once the job is finished, retrieve the result
if job.is_finished:
    # This will contain the return value from analyze_image
    print(f"Task completed successfully, result: ")
    print(job.result)
elif job.is_failed:
    print(f"Task failed, reason: {job.exc_info}")
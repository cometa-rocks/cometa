from rq import Queue
from redis import Redis
import time
import base64
import sys

sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")

import logging
from utility.connections import connect_redis
from tools.common import send_step_details
import traceback

logger = logging.getLogger("AI")


class AI:
    # Taking REDIS_IMAGE_ANALYSYS_QUEUE_NAME from environment.py file as parameter
    # In future if we have more than 1 ai_containers runnting this will help to redirect the analysis request

    def __init__(self, REDIS_IMAGE_ANALYSYS_QUEUE_NAME, logger):
        self.logger = logger
        self.REDIS_IMAGE_ANALYSYS_QUEUE_NAME = REDIS_IMAGE_ANALYSYS_QUEUE_NAME
        self.__REDIS_CONNECTION = connect_redis()
        # This variable is path of cometa_ai.src.workers....
        self.__IMAGE_ANALYST_WORKER_NAME = "src.workers.image_analyst.analyze_image"

    def analyze_image(self, context, data):
        try:
            queue = Queue(
                self.REDIS_IMAGE_ANALYSYS_QUEUE_NAME, connection=self.__REDIS_CONNECTION
            )
            # self.logger.debug(f"Queue, job ID: {queue}")
            # Enqueue the task
            worker_job = queue.enqueue(self.__IMAGE_ANALYST_WORKER_NAME, messages=data)
            # self.logger.debug(f"Worker job, job ID: {worker_job}")

            start_time = time.time()
            self.logger.debug(f"Task queued, job ID: {worker_job.id}")

            # Polling the job status to wait for it to finish
            while (
                worker_job.is_queued or worker_job.is_scheduled or worker_job.is_started
            ):
                send_step_details(
                    context, f"Analyzing image, status {worker_job.get_status()}"
                )
                self.logger.debug(f"Analyzing image, status {worker_job.get_status()}")
                time.sleep(2)

            # Once the job is finished, retrieve the result
            if worker_job.is_finished:
                self.logger.debug(f"{time.time()-start_time} to complete the result")
                # This will contain the return value from analyze_image
                self.logger.debug(f"Task completed successfully, result: ")
                return True, worker_job.result

            elif worker_job.is_failed:
                self.logger.debug(f"Task failed, reason: {worker_job.exc_info}")
                return False, worker_job.exc_info.splitlines()[-1]
        
        except Exception as exception:
            self.logger.debug(f"Exception {str(exception)}")
            return False, str(exception)

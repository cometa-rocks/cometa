from rq import Queue
from redis import Redis
import time
import base64
import sys
import os
import socket

sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")

import logging
from utility.connections import connect_redis
from tools.common import send_step_details
import traceback
from rq.exceptions import NoSuchJobError

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
            conn_kwargs = self.__REDIS_CONNECTION.connection_pool.connection_kwargs
            redis_host = conn_kwargs.get("host")
            redis_port = conn_kwargs.get("port")
            redis_db = conn_kwargs.get("db")
            redis_ssl = conn_kwargs.get("ssl", False)

            self.logger.info(
                "AI enqueue: redis=%s:%s db=%s ssl=%s queue=%s hostname=%s pid=%s",
                redis_host,
                redis_port,
                redis_db,
                redis_ssl,
                self.REDIS_IMAGE_ANALYSYS_QUEUE_NAME,
                socket.gethostname(),
                os.getpid(),
            )

            job_description = (
                f"AI image analysis queue={self.REDIS_IMAGE_ANALYSYS_QUEUE_NAME}"
            )

            # Enqueue the task
            worker_job = queue.enqueue(
                self.__IMAGE_ANALYST_WORKER_NAME,
                messages=data,
                description=job_description,
            )
            # self.logger.debug(f"Worker job, job ID: {worker_job}")

            start_time = time.time()
            self.logger.info(
                "AI queued: queue=%s job_id=%s desc=%s redis=%s:%s db=%s",
                self.REDIS_IMAGE_ANALYSYS_QUEUE_NAME,
                worker_job.id,
                job_description,
                redis_host,
                redis_port,
                redis_db,
            )

            # Polling the job status to wait for it to finish
            while (
                worker_job.is_queued or worker_job.is_scheduled or worker_job.is_started
            ):
                try:
                    worker_job.refresh()
                except NoSuchJobError:
                    self.logger.error(
                        "AI job vanished from Redis: queue=%s job_id=%s redis=%s:%s db=%s",
                        self.REDIS_IMAGE_ANALYSYS_QUEUE_NAME,
                        worker_job.id,
                        redis_host,
                        redis_port,
                        redis_db,
                    )
                    return False, "AI job vanished from Redis (wrong Redis/DB or TTL cleanup)"

                status = worker_job.get_status()
                send_step_details(
                    context, f"Analyzing image, status {status} (job {worker_job.id})"
                )
                self.logger.debug(
                    "AI polling: queue=%s job_id=%s status=%s redis=%s:%s db=%s - sleeping 2s",
                    self.REDIS_IMAGE_ANALYSYS_QUEUE_NAME,
                    worker_job.id,
                    status,
                    redis_host,
                    redis_port,
                    redis_db,
                )
                time.sleep(2)

            # Ensure the final state/result is up-to-date after leaving the loop
            worker_job.refresh()

            # Once the job is finished, retrieve the result
            if worker_job.is_finished:
                self.logger.info(
                    "AI finished: queue=%s job_id=%s duration_s=%.3f",
                    self.REDIS_IMAGE_ANALYSYS_QUEUE_NAME,
                    worker_job.id,
                    (time.time() - start_time),
                )
                return True, worker_job.result

            elif worker_job.is_failed:
                self.logger.error(
                    "AI failed: queue=%s job_id=%s exc=%s",
                    self.REDIS_IMAGE_ANALYSYS_QUEUE_NAME,
                    worker_job.id,
                    (
                        worker_job.exc_info.splitlines()[-1]
                        if worker_job.exc_info
                        else "no exc_info"
                    ),
                )
                return False, (
                    worker_job.exc_info.splitlines()[-1]
                    if worker_job.exc_info
                    else "AI job failed (no exc_info)"
                )

            return False, f"AI job ended unexpectedly (status={worker_job.get_status()})"
        
        except Exception as exception:
            self.logger.exception("AI analyze_image exception")
            return False, str(exception)
from rq import Queue
from rq import Worker, Queue, Connection
from src.connections.redis_connection import (
    connect_redis,
    REDIS_IMAGE_ANALYSYS_QUEUE_NAME,
    REDIS_BROWSER_USE_QUEUE_NAME,
    REDIS_CHATBOT_QUEUE_NAME,
    REDIS_NUMBER_OF_WORKERS,
)
from src.utility.common import get_logger
from multiprocessing import Process
logger = get_logger()


def start_worker():
    REDIS_CONNECTION = connect_redis()
    with Connection(REDIS_CONNECTION):
        queues = [
            Queue(REDIS_IMAGE_ANALYSYS_QUEUE_NAME, connection=REDIS_CONNECTION, is_async=False),
            Queue(REDIS_BROWSER_USE_QUEUE_NAME, connection=REDIS_CONNECTION),
            Queue(REDIS_CHATBOT_QUEUE_NAME, connection=REDIS_CONNECTION)
        ]
        worker = Worker(queues)
        worker.work()


if __name__ == "__main__":

    logger.info("Starting Analysis Server...")
    number_of_workers = REDIS_NUMBER_OF_WORKERS  # Number of workers you want to start

    processes = []

    for _ in range(number_of_workers):
        p = Process(target=start_worker)
        processes.append(p)
        p.start()

    for p in processes:
        p.join()  # Optionally, wait for all worker processes to finish

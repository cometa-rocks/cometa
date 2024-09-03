from rq import Queue
from rq import Worker, Queue, Connection
from src.message_broker.redis_connection import connect_redis, REDIS_IMAGE_ANALYSYS_QUEUE_NAME
from src.message_broker.workers.image_analyst import MODEL_NAME 
from src.utility.common import get_logger
logger = get_logger()

if __name__ == '__main__':
    REDIS_CONNECTION = connect_redis() 
    logger.info("Starting Analysis Server...")    
    with Connection(REDIS_CONNECTION):
        logger.info(f"Attaching a Queue with name {REDIS_IMAGE_ANALYSYS_QUEUE_NAME}")    
        image_analysis_queue = Queue(REDIS_IMAGE_ANALYSYS_QUEUE_NAME, connection=REDIS_CONNECTION) # Specify the queue to listen to
        worker = Worker([image_analysis_queue])
        worker.work()
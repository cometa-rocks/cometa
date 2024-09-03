import os
import redis
from src.utility.common import get_logger
import traceback
logger = get_logger()

# Fetching environment variables
REDIS_HOST = os.getenv('REDIS_HOST', 'redis')
REDIS_PORT = int(os.getenv('REDIS_PORT', 6379))
REDIS_DB = int(os.getenv('REDIS_DB', 0))
REDIS_DEFAULT_TIMEOUT = int(os.getenv('REDIS_DEFAULT_TIMEOUT', 7500)) / 1000  # converting to seconds

# This is kept speratly in case any client wants to have sperate ai container 
# by sending jobs message to different queue it will spereate the processing load 
REDIS_IMAGE_ANALYSYS_QUEUE_NAME = os.getenv('REDIS_IMAGE_ANALYSYS_QUEUE_NAME', 'image_analysis')  # converting to seconds

REDIS_CONNECTION = None

def connect_redis():
    global REDIS_CONNECTION
    # Creating Redis connection
    REDIS_CONNECTION = redis.Redis(
        host=REDIS_HOST,
        port=REDIS_PORT,
        db=REDIS_DB,
        # socket_timeout=REDIS_DEFAULT_TIMEOUT,
        socket_keepalive=True
    )
    # Testing the connection
    try:
        REDIS_CONNECTION.ping()
        logger.info("Connected to Redis successfully!")
        return REDIS_CONNECTION
    except redis.exceptions.ConnectionError as exception:
        logger.error("Failed to connect to Redis.")
        traceback.print_exc()

    

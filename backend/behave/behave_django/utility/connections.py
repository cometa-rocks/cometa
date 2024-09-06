import os
import redis
from utility.common import get_logger
import traceback

logger = get_logger()
from utility.configurations import ConfigurationManager

# Fetching environment variables
REDIS_HOST = ConfigurationManager.get_configuration("REDIS_HOST", "redis")
REDIS_PORT = int(ConfigurationManager.get_configuration("REDIS_PORT", 6379))
REDIS_DB = int(ConfigurationManager.get_configuration("REDIS_DB", 0))

# This is kept speratly in case any client wants to have sperate ai container
# by sending jobs message to different queue it will spereate the processing load
REDIS_CONNECTION = None


def connect_redis():
    global REDIS_CONNECTION
    # Creating Redis connection
    REDIS_CONNECTION = redis.Redis(
        host=REDIS_HOST, port=REDIS_PORT, db=REDIS_DB, socket_keepalive=True
    )
    # Testing the connection
    try:
        REDIS_CONNECTION.ping()
        logger.info("Connected to Redis successfully!")
        return REDIS_CONNECTION
    except redis.exceptions.ConnectionError as exception:
        logger.error("Failed to connect to Redis.")
        traceback.print_exc()

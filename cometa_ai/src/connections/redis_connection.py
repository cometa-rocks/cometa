import os
import redis
from src.utility.common import get_logger
import traceback

logger = get_logger()

# Fetching environment variables
REDIS_HOST = os.getenv("REDIS_HOST", "cometa.redis.ai")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))
REDIS_DEFAULT_TIMEOUT = (
    int(os.getenv("REDIS_DEFAULT_TIMEOUT", 7500)) / 1000
)  # converting to seconds
REDIS_DB_TSL_SSL_ENABLED = os.getenv("REDIS_DB_TSL_SSL_ENABLED", "No") == "Yes"

REDIS_CA_CERTIFICATE_FILE = os.getenv(
    "REDIS_CA_CERTIFICATE_FILE", "/share/certs/ca-cert.pem"
)

# This is kept speratly in case any client wants to have sperate ai container
# by sending jobs message to different queue it will spereate the processing load
REDIS_IMAGE_ANALYSYS_QUEUE_NAME = os.getenv(
    "REDIS_IMAGE_ANALYSYS_QUEUE_NAME", "image_analysis"
)
REDIS_CHATBOT_QUEUE_NAME = os.getenv("REDIS_CHATBOT_QUEUE_NAME", "chatbot_queue")
REDIS_NUMBER_OF_WORKERS = int(os.getenv("REDIS_NUMBER_OF_WORKERS", 1))

logger.debug(f"Connecting to redis host {REDIS_HOST}:{REDIS_PORT}")
REDIS_CONNECTION = None


def connect_redis():
    global REDIS_CONNECTION

    redis_connection_errors = {
        "host": REDIS_HOST,
        "port": REDIS_PORT,
        "db": REDIS_DB,
        "socket_keepalive": True,
    }

    if REDIS_DB_TSL_SSL_ENABLED:
        redis_connection_errors["ssl"] = REDIS_DB_TSL_SSL_ENABLED
        redis_connection_errors["ssl_ca_certs"] = REDIS_CA_CERTIFICATE_FILE
        logger.debug("Adding SSL")

    # if REDIS_PASSWORD:
    #     redis_connection_erros["password"]=REDIS_PASSWORD
    #     logger.debug(f"Using password {REDIS_PASSWORD}")

    logger.debug(f"Using configuration : {redis_connection_errors}")
    # Creating Redis connection
    REDIS_CONNECTION = redis.Redis(**redis_connection_errors)

    # Testing the connection
    try:
        REDIS_CONNECTION.ping()
        logger.info("Connected to Redis successfully!")
        return REDIS_CONNECTION
    except redis.exceptions.ConnectionError as exception:
        logger.error("Failed to connect to Redis.")
        raise exception

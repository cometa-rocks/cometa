import os
import redis
from utility.common import get_logger
import traceback

logger = get_logger()
from utility.configurations import ConfigurationManager


# This is kept separately in case any client wants to have separate ai container
# by sending jobs message to different queue it will separate the processing load
REDIS_CONNECTION = None


def connect_redis():
    global REDIS_CONNECTION

    # Fetching environment variables
    REDIS_HOST = ConfigurationManager.get_configuration("REDIS_HOST", "cometa.redis.ai")
    REDIS_PORT = int(ConfigurationManager.get_configuration("REDIS_PORT", 6379))
    REDIS_DB = int(ConfigurationManager.get_configuration("REDIS_DB", 0))

    REDIS_CA_CERTIFICATE_FILE = ConfigurationManager.get_configuration(
        "REDIS_CA_CERTIFICATE_FILE", "/app/redis/certs/ca-cert.pem"
    )
    logger.debug(ConfigurationManager.get_configuration("REDIS_DB_TSL_SSL_ENABLED"))
    REDIS_DB_TSL_SSL_ENABLED = (
        ConfigurationManager.get_configuration("REDIS_DB_TSL_SSL_ENABLED", "No")
        == "Yes"
    )
    # REDIS_PASSWORD = os.getenv('REDIS_PASSWORD', "")

    # This is kept separately in case any client wants to have separate ai container
    # by sending jobs message to different queue it will separate the processing load

    logger.debug(f"Connecting to redis host {REDIS_HOST}:{REDIS_PORT}")

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

    logger.debug(redis_connection_errors)

    # Creating Redis connection
    REDIS_CONNECTION = redis.Redis(**redis_connection_errors)
    # Testing the connection
    try:
        REDIS_CONNECTION.ping()
        logger.info("Connected to Redis successfully!")
        return REDIS_CONNECTION
    except redis.exceptions.ConnectionError as exception:
        logger.error("Failed to connect to Redis.")
        traceback.print_exc()

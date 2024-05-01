import os
import logging
from pathlib import Path

DEBUG_LEVEL = int(os.getenv('DEBUG_LEVEL', '20'))
LOGGER_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'
from utils.cometa_logger import CometaLogger

LOGGER_FORMAT = '\33[96m[%(asctime)s][%(filename)s:%(lineno)d](%(funcName)s) -\33[0m %(message)s'
# setup logging
logging.setLoggerClass(CometaLogger)
logger = logging.getLogger('FeatureExecution')
logger.setLevel(DEBUG_LEVEL)
# create a formatter for the logger
formatter = logging.Formatter(LOGGER_FORMAT, LOGGER_DATE_FORMAT)
# create a stream logger
streamLogger = logging.StreamHandler()
# set the format of streamLogger to formatter
streamLogger.setFormatter(formatter)
# add the stream handle to logger
logger.addHandler(streamLogger)

DJANGO_SERVER_URL = os.getenv('DJANGO_SERVER_URL', 'django')
DJANGO_SERVER_PORT = os.getenv('DJANGO_SERVER_PORT', '8000')


def get_django_server_url():
    return f"http://{DJANGO_SERVER_URL}:{DJANGO_SERVER_PORT}"


BASE_PATH = os.path.join(Path(__file__).parent.parent)
logger.debug(f"BASE_PATH {BASE_PATH}")
# job list file to see how many jobs are scheduled
JOB_LIST_FILE_PATH = os.path.join(BASE_PATH, ".jobs")

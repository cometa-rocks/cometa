import logging
import logging.handlers

# backend version number, incremented when ever backend is updated
version = "2.5.95"
# browserstack caching time in seconds
# used in URL to cache the browserstack response
# which throws response time from 1.4s to 150ms at most.
browserstackCacheTime = 604800  # one week
# datetime format used to save date and time
datetimeFormat = "%Y-%m-%dT%H:%M:%S"
# datetie format with timezone information
datetimeTZFormat = "%Y-%m-%dT%H:%M:%SZ"
# used to cut the feature name with "..." when sending PDF email
emailSubjectFeatureNameLimit = 20
# used to cut the file download name in the PDF export
pdfDownloadNameLimit = 20
# if pdf file passes this limit, link to download pdf will be sent instead of the pdf.
pdfFileSizeLimit = 10485760  # 10MB
# debug level for behave output
# 10 = DEBUG
# 20 = INFO
# 30 = WARNING
# 40 = ERROR
# 50 = CRITICAL
BEHAVE_DEBUG_LEVEL = 10
# logger format
# more options can be found at https://docs.python.org/3/library/logging.html#logrecord-attributes
# Full logger example:
# LOGGER_FORMAT = '[%(asctime)s][%(name)s][%(levelname)s][%(filename)s:%(lineno)d](%(funcName)s) - %(message)s'
LOGGER_FORMAT = "\33[96m[%(asctime)s.%(msecs)03d][%(levelname)s][%(filename)s:%(lineno)d](%(funcName)s) -\33[0m %(message)s"
LOGGER_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"
# Folders MAX drill down level
MAX_FOLDER_HIERARCHY = 20
# Uploads folder
UPLOADS_FOLDER = "/data/test/uploads"


def get_logger():

    # setup logging
    logger = logging.getLogger(__name__)
    logger.setLevel(10)
    # create a formatter for the logger
    formatter = logging.Formatter(LOGGER_FORMAT, LOGGER_DATE_FORMAT)
    # create a stream logger
    streamLogger = logging.StreamHandler()
    # set the format of streamLogger to formatter
    streamLogger.setFormatter(formatter)
    # add the stream handle to logger
    logger.addHandler(streamLogger)
    return logger

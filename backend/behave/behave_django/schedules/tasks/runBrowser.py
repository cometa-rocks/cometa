import logging, subprocess, sys, requests, datetime
from django.conf import settings
from django_rq import job
from rq.timeouts import JobTimeoutException

# just to import secrets
sys.path.append("/code")
from secret_variables import *
from src.backend.common import *

# setup logging
logger = logging.getLogger(__name__)
logger.setLevel(BEHAVE_DEBUG_LEVEL)
# create a formatter for the logger
formatter = logging.Formatter(LOGGER_FORMAT, LOGGER_DATE_FORMAT)
# create a stream logger
streamLogger = logging.StreamHandler()
# set the format of streamLogger to formatter
streamLogger.setFormatter(formatter)
# add the stream handle to logger
logger.addHandler(streamLogger)

@job
def run_browser(json_path, env, **kwargs):
    # Start running feature with current browser
    process = subprocess.Popen(["bash", settings.RUNTEST_COMMAND_PATH, json_path], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    try:
        # wait for the process to finish
        process.wait()
        logger.debug(f"Process Return Code: {process.returncode}")
        if process.returncode > 0:
            out, _ = process.communicate()
            out = str(out.decode('utf-8'))
            logger.error(f"Error ocurred during the feature startup ... please check the output:\n{out}")
            if 'Parser failure' in out:
                raise Exception("Parsing error in the feature, please recheck the steps.")
    except JobTimeoutException as err:
        # job was timed out, kill the process
        logger.error("Job timed out.")
        logger.exception(err)
        subprocess.run(["pkill", "-TERM", "-P", "%d" % int(process.pid)])
        raise
        # TODO:
        # Check if process has been stopped
        # Send mail?
    except Exception as e:
        logger.error("run_browser threw an exception:")
        logger.exception(e)
        requests.post('http://cometa_socket:3001/feature/%s/error' % kwargs.get('feature_id', None), data={
            "browser_info": kwargs.get('browser', None),
            "feature_result_id": kwargs.get('feature_result_id', None),
            "run_id": kwargs.get('feature_run', None),
            "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
            "error": str(e),
            "user_id": kwargs.get('user_data', {}).get('user_id', None)
        })

@job
def run_finished(feature_run, feature_id, user_data):
    logger.debug('All browsers of current run completed!')
    # Send completed websocket to Front
    requests.post('http://cometa_socket:3001/feature/%d/runCompleted' % int(feature_id), json={
        'type': '[WebSockets] Completed Feature Run',
        'run_id': int(feature_run),
        'datetime': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'user_id': user_data['user_id']
    })
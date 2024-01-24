import logging, subprocess, sys, requests, datetime
from django.conf import settings
from django_rq import job
from rq.timeouts import JobTimeoutException
from rq.command import send_stop_job_command
from rq.job import Job
from rq import get_current_job
import django_rq, pickle
from tempfile import NamedTemporaryFile

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
    tempfile = NamedTemporaryFile(suffix="_feature_execution.pickle", delete=False)
    # save variables from environment variables to a file using pickle
    variables = env.pop('VARIABLES')
    env['execution_data'] = tempfile.name

    with open(tempfile.name, 'wb') as file:
        pickle.dump({
            'VARIABLES': variables
        }, file)
    
    # Start running feature with current browser
    with subprocess.Popen(["bash", settings.RUNTEST_COMMAND_PATH, json_path], env=env, stdout=subprocess.PIPE) as process:
        try:
            logger.debug(f"Process id: {process.pid}")
            # wait for the process to finish
            process.wait()
            logger.debug(f"Process Return Code: {process.returncode}")
            if process.returncode > 0:
                out, _ = process.communicate()
                out = str(out.decode('utf-8'))
                logger.error(f"Error ocurred during the feature execution ... please check the output:\n{out}")
                if 'Parser failure' in out:
                    raise Exception("Parsing error in the feature, please recheck the steps.")
        except JobTimeoutException as err:
            # job was timed out, kill the process
            logger.error("Job timed out.")
            logger.exception(err)
            with subprocess.Popen(f"ps -o pid --ppid {process.pid} --noheaders | xargs kill -15", shell=True) as p2:
                p2.wait() 
            process.wait()
            job: Job = get_current_job()
            send_stop_job_command(django_rq.get_connection(), job.id)
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
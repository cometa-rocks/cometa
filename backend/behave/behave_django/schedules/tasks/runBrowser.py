import logging, subprocess, sys, requests, datetime, json, os
from django.conf import settings
from django_rq import job
from rq.timeouts import JobTimeoutException
from rq.command import send_stop_job_command
from rq.job import Job
from rq import get_current_job
import django_rq, pickle
from tempfile import NamedTemporaryFile

sys.path.append("/opt/code/behave_django")

from utility.common import *
from utility.config_handler import *
from utility.common import *

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
def run_browser(env, **kwargs):
    tempfile = NamedTemporaryFile(suffix="_feature_execution.pickle", delete=False)
    # save variables from environment variables to a file using pickle
    variables = env.pop('VARIABLES')
    env['execution_data'] = tempfile.name


    with open(tempfile.name, 'wb') as file:
        pickle.dump({ 
            'VARIABLES': variables
        }, file)
    # This is required to make sure feature file is generated before running the feature with result id added to it
    # While doing parallel execution and housekeeping it should not conflict with other threads
    # File name should be unique for each test execution i.e 1174_458556_Simple-Smoke-test
    feature_result_id = env.get('feature_result_id')
    feature_id = kwargs.get('feature_id')
    browser_info = kwargs.get('BROWSER_INFO', None)
    user_id = kwargs.get('user_data', {}).get('user_id', None)
    run_id = int(kwargs.get('feature_run'))
    
    response = requests.post(f'{get_cometa_backend_url()}/generateFeatureFile/', json={
        'feature_id': feature_id,
        'feature_result_id': feature_result_id
    })
    if not response.json().get('success'):
        requests.post(f'{get_cometa_socket_url()}/feature/%s/finished' % int(feature_id), data={
            "user_id": user_id,
            "browser_info": json.dumps(browser_info),
            "feature_result_id": feature_result_id,
            "run_id": int(kwargs.get('feature_run')),
            "feature_result_info": json.dumps(response.json()),
            "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        })
                # call update task to delete a task with pid.
        task = {
            "action": "delete",
            "browser": json.dumps(browser_info),
            "feature_result_id": feature_result_id,
            "feature_id": feature_id,
            "pid": str(os.getpid()),
        }
        requests.post(f'{get_cometa_backend_url()}/updateTask/', headers={'Host': 'cometa.local'},
                                data=json.dumps(task))
        raise Exception(response.json())
    response_json = response.json() 
    logger.debug(f"Feature file generated successfully")
    logger.debug(f"Response: {json.dumps(response.json(), indent=4)}")
    # Combine environment value related to cometa and feature data 
    # this is required because in new bash session env information will be lost related to cometa servers
    all_env = {**get_all_cometa_environments(), **env}
    
    json_path = response_json.get('meta_file_path')
    all_env['FEATURE_FILE'] = response_json.get('feature_file_path') 
    all_env['JSON_FILE'] = response_json.get('meta_file_path') 
    all_env['FEATURE_JSON_FILE'] = response_json.get('json_file_path') 
    all_env['FEATURE_NAME'] = response_json.get('feature_name')
    all_env['FOLDERPATH'] = response_json.get('feature_folder_path')
    all_env['COMETA_FEATURE_ID'] = kwargs.get('feature_id')
    
    # Check if required environment variables are set
    if not all_env['FEATURE_FILE']:
        raise Exception(f"Feature file path is not set in response: {response_json}")
    if not all_env['FOLDERPATH']:
        raise Exception(f"Feature folder path is not set in response: {response_json}")
    
    # Check if the script file exists
    if not os.path.exists(settings.RUNTEST_COMMAND_PATH):
        raise Exception(f"Script file does not exist: {settings.RUNTEST_COMMAND_PATH}")
    
    # Start running feature with current browser
    with subprocess.Popen(["bash", settings.RUNTEST_COMMAND_PATH, json_path], env=all_env, stdout=subprocess.PIPE) as process:
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
                # Adding this code to make sure if case of any error in the feature execution, 
                # the feature result is marked as failed and websocket is updated so user can stop the feature execution
                data = {
                    "feature_result_id": feature_result_id,
                    "status": "Failed",
                    "error": out
                }
                headers = {"Content-type": "application/json", "Host": "cometa.local"}
                requests.patch(f'{get_cometa_backend_url()}/api/feature_results/', json=data, headers=headers)
                logger.debug("\33[92m" + "Feature result threw an exception!" + "\33[0m")

                # get the final result for the feature_result
                request_info = requests.get(f"{get_cometa_backend_url()}/api/feature_results/%s" % feature_result_id,
                                            headers=headers)
                # Without this request, if some unformated error (error attached in 6849) raised by behave breaks the flow 
                # and socket is not updated which leaves feature in queuing state,
                # because of that it shows as running in the live screen, which requies websocket to restart
                requests.post(f'{get_cometa_socket_url()}/feature/%s/finished' % env.get('feature_result_id'), data={
                    "user_id": user_id,
                    "browser_info": json.dumps(browser_info),
                    "feature_result_id": feature_result_id,
                    "run_id": run_id,
                    "feature_result_info": json.dumps(request_info.json()['result']),
                    "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
                })
                

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
            requests.post(f'{get_cometa_socket_url()}/feature/%s/error' % kwargs.get('feature_id', None), data={
                "browser_info": kwargs.get('browser', None),
                "feature_result_id": kwargs.get('feature_result_id', None),
                "run_id": run_id,
                "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
                "error": str(e),
                "user_id": kwargs.get('user_data', {}).get('user_id', None)
            })

@job
def run_finished(feature_run, feature_id, user_data):
    logger.debug('All browsers of current run completed!')
    # Send completed websocket to Front
    requests.post(f'{get_cometa_socket_url()}/feature/%d/runCompleted' % int(feature_id), json={
        'type': '[WebSockets] Completed Feature Run',
        'run_id': int(feature_run),
        'datetime': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'user_id': user_data['user_id']
    })
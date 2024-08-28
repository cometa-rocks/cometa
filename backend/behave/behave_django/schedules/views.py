from django.shortcuts import render

# Create your views here.
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import subprocess, datetime, requests
import os.path
import os, re
from django.conf import settings
import json, time
from django.views.decorators.clickjacking import xframe_options_exempt
import random
import django_rq
from schedules.tasks.runBrowser import run_browser, run_finished

from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

from utility.common import *
from utility.configurations import ConfigurationManager,load_configurations
from behave_django.settings import BEHAVE_HOME_DIR 

logger = get_logger()

# Configure Retry which can be later used for requests
retry_strategy = Retry(
    total=6, # Retry maximum 6 times, combined with backoff_factor will wait a total of 60 seconds
    backoff_factor=1, # 0s, 2s, 4s, 8s, 16s, ...
    status_forcelist=[429, 500, 502, 503, 504], # Retry request on these status codes
    allowed_methods=['DELETE', 'GET', 'HEAD', 'OPTIONS', 'PUT', 'TRACE', 'POST'] # Retry on these methods
)
# The following lines creates a new http instance which will use the above retry strategy
adapter = HTTPAdapter(max_retries=retry_strategy)
requests_retry = requests.Session()
requests_retry.mount("https://", adapter)
requests_retry.mount("http://", adapter)

@require_http_methods(["POST"])
@csrf_exempt
@xframe_options_exempt
def run_test(request):
    # check if RUNTEST_COMMAND_PATH exists else return error
    if os.path.exists(settings.RUNTEST_COMMAND_PATH)==False:
        return JsonResponse({'Error':'Command file not exists , path ->' + settings.RUNTEST_COMMAND_PATH}, status = 500)

    logger.info('Running Test')

    # get data sent from django
    json_path = request.POST["json_path"] # file path that contains the necessary information about the feature
    logger.debug("Feature JSON path: {}".format(json_path))
    feature_run = request.POST['feature_run'] # feature_run id that will contain the feature_results
    logger.debug('Feature run id: {}'.format(feature_run))
    X_SERVER = request.POST['HTTP_X_SERVER'] # where the request is coming from
    logger.debug('X_SERVER: {}'.format(X_SERVER))
    VARIABLES = request.POST['variables'] # environments variables for feature department just in case feature is using variables in steps
    logger.debug('Environment Variables: {}'.format(VARIABLES))
    PROXY_USER = request.POST['HTTP_PROXY_USER'] # user who executed the testcase
    logger.debug('Executed By: {}'.format(PROXY_USER))
    executions = json.loads(request.POST['browsers']) # browsers list of the feature
    logger.debug('Executions: {}'.format(executions))
    feature_id = request.POST['feature_id'] # id of the feature that is being executed
    logger.debug('Feature id: {}'.format(feature_id))
    department = request.POST['department'] # department where the feature belongs, set in request so we can get the department settings
    logger.debug('Department the feature belongs to: {}'.format(department))
    PARAMETERS = request.POST['parameters'] # job parameters if the job was scheculed using schedule step
    logger.debug('Job Parameters: {}'.format(PARAMETERS)) 
    
    # assign environment variables to share data between files and threads
    environment_variables = {
        'feature_run': str(feature_run),
        'X_SERVER': X_SERVER,
        'PROXY_USER': PROXY_USER,
        'VARIABLES': VARIABLES,
        'PARAMETERS': PARAMETERS,
        'department': department,
        'feature_id': feature_id
    }

    # Loads user data
    user_data = json.loads(PROXY_USER)

    # save all the jobs
    jobs = []

    # create a thread for each browser
    for execution in executions:
        browser = execution['browser']
        feature_result_id = execution['feature_result_id']
        run_hash = execution['run_hash']
        connection_url = execution['connection_url']
        # Added network_logging_enabled to control security checking
        network_logging_enabled = execution['network_logging_enabled']
        logger.debug("Execution testcase in browser: {}".format(browser))
        # dump the json as string
        browser = json.dumps(browser)
        # send websocket about the feature has been queued
        request = requests.get('http://cometa_socket:3001/feature/%s/queued' % feature_id, data={
            "user_id": user_data['user_id'],
            "browser_info": browser,
            "network_logging_enabled": network_logging_enabled,
            "feature_result_id": feature_result_id,
            "run_id": feature_run,
            "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        })
        # add missing variables to environment_variables dict
        environment_variables['NETWORK_LOGGING'] = "Yes" if execution['network_logging_enabled']  else "No"
        environment_variables['BROWSER_INFO'] = browser
        environment_variables['feature_result_id'] = str(feature_result_id)
        environment_variables['RUN_HASH'] = run_hash
        environment_variables['CONNECTION_URL'] = connection_url
        # Add the current browser to the thread pool
        job = django_rq.enqueue(
            run_browser, 
            json_path, 
            environment_variables, 
            browser=browser, 
            feature_id=feature_id, 
            feature_result_id=feature_result_id, 
            user_data=user_data,
            feature_run=feature_run,
            job_timeout=7500)
        jobs.append(job)
    
    notify = run_finished.delay(feature_run, feature_id, user_data, depends_on=jobs)

    # Wait for the thread pool to finish
    return JsonResponse({}, status = 200)
    
@require_http_methods(["GET"])
@csrf_exempt
@xframe_options_exempt
def kill_task(request, pid):
    subprocess.call("kill -15 %d" % int(pid), shell=True)   
    return JsonResponse({"success": True, "killed": pid})


@require_http_methods(["GET"])
@csrf_exempt
@xframe_options_exempt
def update_configuration_in_memory(request):
    try:
        logger.debug("Updating configuration from configuration.json, requested by server")
        load_configurations()
        logger.debug("Updating configuration updated")
        return JsonResponse({"success": True, "message": "configuration updated"})
    except Exception as exception:
        return JsonResponse({"success": False, "message": str(exception)})


@require_http_methods(["GET"])
@csrf_exempt
@xframe_options_exempt
def updated_step_actions(request):
    try:
        # Add your new created action files here
        actions_files = [
            'cometa_itself/steps/actions.py',
            'ee/cometa_itself/steps/rest_api.py'
        ]
        
        # variable to contain action comment
        action_comments = []
        actionsParsed = []
        
        def parseAction(action):
            regex = r"\@(.*)\((u|)'(.*)'\)"
            matches = re.findall(regex, action)
            if matches[0][2] == "{step}":
                return
            logger.debug(f"Action matcher Found : {matches[0]}")
            logger.debug(f"Action Value : {matches[0][2]}")
            
            actionsParsed.append({
                "action_name":matches[0][2],
                "department":'DIF',
                "application":'amvara',
                "values":matches[0][2].count("{"),
                "description":'<br>'.join(action_comments)
            })


        actions = []

        # Iterate your action file as store in the lines in the files    
        for actions_file in actions_files:
            full_path = os.path.join(BEHAVE_HOME_DIR, actions_file)
            logger.debug(f"Reading actions from file : {full_path}")
            with open(full_path) as file:
                lines_in_file = file.readlines()
                logger.debug(f"Found {len(lines_in_file)} lines in the file : {actions_file}")
                actions = actions + lines_in_file

        # variable to contain previous line
        previousLine = ''
        logger.debug(f"String Action Parse")
        for action in actions:
            if action.startswith("@step") and '(?P<' not in action:
                logger.debug(f"Parsing Step Action : {action}")
                # parse action will use action_comments, if found to be action otherwise make it empty
                parseAction(action)

            # This condition rarely executes when @step contains regular expression
            # If action started with @step then it never start with @done and in case above condition is false then any how this will be executed
            # not need of two if conditions
            elif action.startswith('@done') and '(?P<' in previousLine:
                logger.debug(f"Parsing Done Action : {action}")
                parseAction(action)

            # when any comment related to action written, that line will not have any spaces considering that line
            # If there is Multi line comments, keep on adding in the list 
            elif action.startswith('# '):
                # Action Comments to be written in with out line gaps
                # [2:] to remove # and single space from the front of the comment
                action_comments.append(action[2:])
                # logger.debug(f"Found actions comment {action_comments}")
            else:
                if not action.startswith("@step"):
                    action_comments = []  # if other then comments found remove empty the list
                    logger.debug(f"Removed action comments {action}")

            previousLine = action

        logger.debug(f"Ending Action Parse")
        # send a request to web sockets about the actions update
        requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Actions] Get All'
        })

        return JsonResponse({'success': True, 'actions': actionsParsed})
    
    except Exception as exception:
        return JsonResponse({'success': False, 'message': str(exception)}, status_code=500)



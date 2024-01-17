from django.shortcuts import render

# Create your views here.
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import subprocess, datetime, requests
import os.path
from schedules.forms import RunTestValidationForm
from schedules.forms import SetScheduleValidationForm
from crontab import CronTab, CronSlices
import os, logging, sys
from django.conf import settings
import json, time
import secrets
import urllib.parse
from django.views.decorators.clickjacking import xframe_options_exempt
import random
import django_rq
from pprint import pprint
from sentry_sdk import capture_exception
from schedules.tasks.runBrowser import run_browser, run_finished

from requests.adapters import HTTPAdapter
from requests.packages.urllib3.util.retry import Retry

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

        logger.debug("Execution testcase in browser: {}".format(browser))
        # dump the json as string
        browser = json.dumps(browser)
        # send websocket about the feature has been queued
        request = requests.get('http://cometa_socket:3001/feature/%s/queued' % feature_id, data={
            "user_id": user_data['user_id'],
            "browser_info": browser,
            "feature_result_id": feature_result_id,
            "run_id": feature_run,
            "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        })
        # add missing variables to environment_variables dict
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

@require_http_methods(["POST"])
@csrf_exempt
@xframe_options_exempt
def set_test_schedule(request):

    # crontab object
    # /etc/cron.d/crontab must be a file, if logs throws error '/etc/cron.d/crontab is a directory'
    # please create the file behave/schedules/crontab and recreate behave docker
    my_cron = CronTab(user=True, tabfile='/etc/cron.d/crontab')
    # check if request contains jobId if so that mean there is more data than just feature_id and schedule
    if not request.POST.__contains__("jobId"):
        # crontab schedule string
        schedule = request.POST['schedule']
        # crontab feature id that will be executed
        feature_id = request.POST["feature_id"]
        try:
            feature_id = int(feature_id)
        except:
            logger.error('Unable to convert feature_id to int')
        # crontab user id to execute feature
        user_id = request.POST['user_id']
        try:
            user_id = int(user_id)
        except:
            logger.error('Unable to convert user_id to int')
        curl_post_data = json.dumps({
            'feature_id': feature_id
        })
        curl_headers = {
            'Content-Type': 'application/json',
            'COMETA-ORIGIN': 'CRONTAB',
            'COMETA-USER': str(user_id)
        }
        curl_headers = ' '.join(['-H "%s: %s"' % (key, value) for key, value in curl_headers.items()])
        # Now only the feature_id is required to run feature from behave -> django -> behave
        command = 'root curl --data \'%s\' %s -X POST http://django:8000/exectest/' % (curl_post_data, curl_headers)
        logger.debug("command find -> " + command)
        found = False
        for job in my_cron:
            logger.debug("crontab command -> " + job.command)
            if curl_post_data in job.command:
                logger.debug("command found")
                if schedule:
                    # Check schedule is valid
                    if not CronSlices.is_valid(schedule):
                        return JsonResponse({ 'error': 'Invalid schedule format.' }, status = 400)
                    job.setall(schedule)
                    job.set_command(command)
                else:
                    my_cron.remove(job)
                    my_cron.write()
                    return JsonResponse({'message':'Schedule is removed!'})
                found = True

        if not schedule:
            return JsonResponse({ 'message': 'Not found but nothing to do' }, status = 200)

        if found == False:
            logger.debug("Create crontab line")
            logger.debug("Command:", str(command))
            job = my_cron.new(command=command)
            logger.debug("Schedule:", str(schedule))
            job.setall(schedule)
            my_cron.write()

        if job.is_valid() == False:
            return JsonResponse({ 'error': 'Job is not valid' }, status = 404)
        else:
            my_cron.write()
            #my_cron.write()
            return JsonResponse({ 'message': 'schedule is updated!' })
    else: # cronjob has jobid
        # save request data to variables
        jobId = request.POST.__getitem__('jobId')
        schedule = request.POST.__getitem__('schedule')
        command = request.POST.__getitem__('command').replace("<jobId>", jobId)
        comment = request.POST.__getitem__('comment').replace("<jobId>", jobId)

        # join command and comment together
        command = "%s %s" % (command, comment)

        # create a job with new command
        job = my_cron.new(command=command)
        # set jobs schedule
        job.setall(schedule)
        # check if job is valid
        if job.is_valid() == False:
            return JsonResponse({'error':'Job is not valid'}, status = 404)
        # finally write to the crontab
        my_cron.write()
        return JsonResponse({'message':'schedule is updated!'})

        
@require_http_methods(["POST"])
@csrf_exempt
@xframe_options_exempt
def remove_test_schedule(request):
    if not request.POST.__contains__("jobId"):
        return JsonResponse({'success': False, 'error':'No jobId found'}, status=404)
    # get job id
    jobId = request.POST.__getitem__('jobId')
    # crontab object
    my_cron = CronTab(user=True, tabfile='/etc/cron.d/crontab')
    # loop over all the jobs
    for job in my_cron:
        # job to look for
        jobToLookFor = """"jobId":%d""" % int(jobId)
        logger.debug(job.command)
        logger.debug(jobToLookFor)
        if jobToLookFor in job.command:
            my_cron.remove(job)
            my_cron.write()
            return JsonResponse({'success': 'True'}, status=200)
    return JsonResponse({'success': False, 'error': 'No jobId found in schedules.'}, status=404)

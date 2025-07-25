import os
import json
import secrets,json,threading
import threading
from threading import Thread
from django.utils import timezone
from django.db.models import Q
from django.forms.models import model_to_dict
from django.http import JsonResponse

from backend.common import *
from backend.utility.functions import *
from backend.utility.timezone_utils import convert_cron_to_utc, recalculate_schedule_if_needed
from backend.utility.uploadFile import UploadFile, decryptFile
from backend.utility.config_handler import *
from backend.view_common import *
from backend.models import Feature, Feature_Runs, Feature_result, Cloud, Department, Variable, Environment, Step
from backend.serializers import VariablesSerializer 
from backend.payments import SubscriptionPublicSerializer, ForbiddenBrowserCloud, check_browser_access, \
    get_browsers_by_cloud, get_requires_payment, has_subscription_by_cloud, get_subscriptions_from_request, \
    get_user_usage_money, BudgetAhead, check_user_will_exceed_budget, check_enabled_budget
from sentry_sdk import capture_exception
logger = getLogger()



def runFeature(request, feature_id, data={}, additional_variables=list):
    # set default value for additional_variables
    if additional_variables == list:
        additional_variables = []

    # Verify feature id exists
    try:
        logger.info(f"Getting feature with id {feature_id} to run.")
        feature = Feature.objects.get(pk=feature_id)
    except Feature.DoesNotExist:
        return {'success': False, 'error': 'Provided Feature ID does not exist.'}

    # check if user belong to the department
    userDepartments = GetUserDepartments(request)
    if feature.department_id not in userDepartments:
        return {'success': False, 'error': 'Provided Feature ID does not exist..'}
    
    disable_legacy_execution = data.get('test_configuration', {}).get('disable_legacy_execution', False)

    if len(feature.browsers) == 0 and not disable_legacy_execution:
        return JsonResponse({
            'success': False,
            'error': 'No browsers selected.'
        }, status=400)
    else: 
        total_parallel_tests = data.get('test_configuration', {}).get('total_parallel_tests', 1)
        
    # Verify access to submitted browsers
    try:
        subscriptions = get_subscriptions_from_request(request)
        check_browser_access(feature.browsers, subscriptions)
    except Exception as err:
        return {'success': False, 'error': str(err)}

    # Get user session
    user = request.session['user']

    if user['user_id'] and check_enabled_budget(user['user_id']):
        # Verify budget
        HTTP_COMETA_ORIGIN = request.META.get("HTTP_COMETA_ORIGIN", '')
        if HTTP_COMETA_ORIGIN == 'CRONTAB':
            # Request coming from Crontab
            # Prevent continue if user will exceed quota and has marked the option to prevent schedules from running
            scheduled_behavior = user['settings'].get('budget_schedule_behavior', '')
            if check_user_will_exceed_budget(user['user_id'], feature.feature_id) and scheduled_behavior == 'prevent':
                return {'success': False,
                        'error': 'Execution will exceed budget and user has `prevent` option configured.'}
        else:
            # Request coming from front user
            # Retrieve confirm parameter from body JSON
            confirm = data.get('confirm', False)
            if not confirm:
                try:
                    budget_exceeded = check_user_will_exceed_budget(user['user_id'], feature.feature_id)
                    if budget_exceeded:
                        # Budget will or has already exceeded the budget
                        return {'success': False, 'action': 'confirm_exceeded'}
                except BudgetAhead as err:
                    # Budget is very close to be reached
                    return {'success': False, 'action': 'confirm_ahead'}
                except Exception as err:
                    # An unkown error occurred
                    capture_exception(err)
                    logger.error(str(err))
                    return {'success': False, 'error': str(err)}

    # create a run id for the executed test
    date_time = timezone.now()
    fRun = Feature_Runs(feature=feature, date_time=date_time)
    fRun.save()

    try:
        get_feature_browsers = getFeatureBrowsers(feature)

    except Exception as err:
        return JsonResponse({
            'success': False,
            'error': str(err)
        }, status=400)

    # update feature info
    feature.info = fRun

    # Make sure feature files exist - only create if missing to prevent step duplication
    feature_path = get_feature_path(feature)['fullPath']
    if not os.path.exists(feature_path + '.feature'):
        logger.info(f"Feature files missing for {feature_id}, creating them...")
        steps = Step.objects.filter(feature_id=feature_id).order_by('id').values()
        feature.save(steps=list(steps))
    else:
        # Files exist, just save feature metadata without regenerating steps
        feature.save(dontSaveSteps=True)
    json_path = get_feature_path(feature)['fullPath'] + '_meta.json'

    executions = []
    frs = []
    for browser in get_feature_browsers:
        concurrency = 1

        cloud = browser.get('cloud', 'browserstack')
        try:
            cloud_object = Cloud.objects.get(name=cloud)
            connection_url = cloud_object.connection_url
            if cloud_object.concurrency:
                concurrency = browser.get('concurrency', 1)
                if concurrency > cloud_object.max_concurrency:
                    concurrency = cloud_object.max_concurrency
            if cloud_object.username and cloud_object.password:
                protocol = connection_url.split("//")[0]
                uri = connection_url.split("//")[1]
                connection_url = f'{protocol}//{cloud_object.username}:{cloud_object.password}@{uri}'
        except Cloud.DoesNotExist:
            logger.error(f"Cloud with name '{cloud}' not found.")
            continue

        if disable_legacy_execution:
            for i in range(0, concurrency):
                # Generate random hash for image url obfuscating
                run_hash = secrets.token_hex(nbytes=8)
                # create a feature_result
                feature_result = Feature_result(
                    feature_id_id=feature.feature_id,
                    result_date=timezone.now(),
                    run_hash=run_hash,
                    running=True,
                    network_logging_enabled = feature.network_logging,
                    browser=browser,
                    executed_by_id=user['user_id']
                )

                feature_result.save()
                frs.append(feature_result)

                executions.append({
                    "feature_result_id": feature_result.feature_result_id,
                    "run_hash": run_hash,
                    "browser": browser,
                    "network_logging_enabled":feature.network_logging,
                    "connection_url": connection_url
                })
        else:
            for i in range(0, total_parallel_tests):
                # Generate random hash for image url obfuscating
                run_hash = secrets.token_hex(nbytes=8)
                # create a feature_result
                feature_result = Feature_result(
                    feature_id_id=feature.feature_id,
                    result_date=timezone.now(),
                    run_hash=run_hash,
                    running=True,
                    network_logging_enabled = feature.network_logging,
                    executed_by_id=user['user_id']
                )

                feature_result.save()
                frs.append(feature_result)

                executions.append({
                    "feature_result_id": feature_result.feature_result_id,
                    "run_hash": run_hash,
                    "network_logging_enabled":feature.network_logging,
                    "connection_url": connection_url
                })

    fRun.feature_results.add(*frs)

    # check if job exists
    jobParameters = {}
    if "jobId" in data:
        try:
            job = Schedule.objects.get(id=data['jobId'])
            job.parameters['jobId'] = job.id
            jobParameters = job.parameters
        except Exception as err:
            return {'success': False, 'error': str(err)}

    # get keynames from the additional variables
    additional_variables_names = [v['variable_name'] for v in additional_variables]

    # get environment variables
    env = Environment.objects.filter(environment_name=feature.environment_name)[0]
    dep = Department.objects.filter(department_name=feature.department_name)[0]
    env_variables = Variable.objects.filter(
        Q(department=dep, based='department') |
        Q(department=dep, environment=env, based='environment') |
        Q(feature=feature, based='feature')
    ).exclude(
        variable_name__in=additional_variables_names
    ).order_by('variable_name', '-based').distinct('variable_name')
    seri = VariablesSerializer(env_variables, many=True).data

    additional_variables.extend(list(seri))

    # user data
    user = request.session['user']

    datum = {
        'json_path': json_path,
        'feature_run': fRun.run_id,
        'HTTP_PROXY_USER': json.dumps(user),
        'HTTP_X_SERVER': request.META.get("HTTP_X_SERVER", "none"),
        "variables": json.dumps(additional_variables),
        "executions": json.dumps(executions),
        "disable_legacy_execution": disable_legacy_execution,
        "feature_id": feature.feature_id,
        "department": json.dumps(model_to_dict(dep), default=str),
        "parameters": json.dumps(jobParameters)
    }

    try:
        # Spawn thread to launch feature run
        t = Thread(target=startFeatureRun, args=(datum,))
        t.start()

        return {
            'success': True,
            'feature_result_ids': [fr.feature_result_id for fr in frs],
        }
    except Exception as e:
        return {'success': False, 'error': str(e)}



# Sends the request to behave without waiting
def startFeatureRun(data):
    result = requests.post(f'{get_cometa_behave_url()}/run_test/', data=data)

# Import all models and all the utility methods
from backend.models import *
# Import all serializers
from backend.serializers import *
# import django exceptions
from django.core.exceptions import *
# Import permissions related methods
from backend.utility.decorators import require_permissions, hasPermission, require_subscription
# Needed rest_framework import
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework import viewsets, filters, generics, status
# Django Imports
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.utils import IntegrityError
from django.core.mail import send_mail, EmailMessage, EmailMultiAlternatives
from django.core.validators import validate_email
from django.core import serializers
from django.forms.models import model_to_dict
from django.http import HttpResponse, JsonResponse, Http404, HttpResponseBadRequest
from django.shortcuts import redirect, render
from django.template.loader import get_template
from django.views.decorators.csrf import csrf_exempt
from backend.payments import SubscriptionPublicSerializer, ForbiddenBrowserCloud, check_browser_access, get_browsers_by_cloud, get_requires_payment, has_subscription_by_cloud, get_subscriptions_from_request, get_user_usage_money, BudgetAhead, check_user_will_exceed_budget, check_enabled_budget
# Basic Imports
import os, sys, json, glob, base64, binascii, re, uuid, bcrypt, socket, urllib, smtplib, datetime, time, mimetypes
# Request related imports
from requests.auth import HTTPBasicAuth
import requests
# Text Encrpytion imports
from backend.utility.encryption import encrypt, decrypt
from backend.utility.functions import *
# Other imports
from crontab import CronSlices
from pathlib import Path
from PIL import Image
from urllib.parse import unquote
from shutil import copyfile, move
from django.views.generic import View
from xhtml2pdf import pisa
from io import BytesIO
from pprint import pprint
from functools import wraps
from backend.common import *
from slugify import slugify
from django.db.models import Q
from django.db.models import Avg, Sum    # needed for CometaUsage calcs
from django.db import connection
import secrets
# just to import secrets
sys.path.append("/code")
import secret_variables
from threading import Thread
from concurrent.futures import ThreadPoolExecutor
# import humanize for time conversion
from backend.templatetags.humanize import *
from sentry_sdk import capture_exception
from backend.utility.uploadFile import UploadFile
# from silk.profiling.profiler import silk_profile

SCREENSHOT_PREFIX = getattr(secret_variables, 'COMETA_SCREENSHOT_PREFIX', '')
BROWSERSTACK_USERNAME = getattr(secret_variables, 'COMETA_BROWSERSTACK_USERNAME', '')
BROWSERSTACK_PASSWORD = getattr(secret_variables, 'COMETA_BROWSERSTACK_PASSWORD', '')
DOMAIN = getattr(secret_variables, 'COMETA_DOMAIN', '')
ENCRYPTION_START = getattr(secret_variables, 'COMETA_ENCRYPTION_START', '')

logger = getLogger()

def timediff(method):
    def wrapper(*args, **kwargs):
        method_name = method.__qualname__ or method.__name__
        logger.debug("Mesuring time differance for " + method_name + "...")
        start = time.time()
        result = method(*args, **kwargs)
        end = time.time()
        logger.debug(method_name + " took: " + str(end-start) + " seconds")
        return result
    return wrapper


def bytesToMegaBytes(bytes):
    kilobytes = bytes/1024
    megabytes = kilobytes/1024

    return megabytes

def GetUserAuth(authToken):
    return OIDCAccount.objects.filter(email=authToken)[0]

def GetUserPermission(authToken):
    return GetUserAuth(authToken).user_permissions.permission_name

def CheckOIDCAccount(search_value):
    email = OIDCAccount.objects.filter(email=search_value)
    return email.count() > 0

def AddOIDCAccount(name, email):
    oidc = OIDCAccount(name=name, email=email)
    state = oidc.save()
    return state == None

def UserRelatedDepartments(user_email, type="id"):
    account=OIDCAccount.objects.filter(email=user_email)
    user_id=account[0].user_id
    DepartmentsRelated = Account_role.objects.all().filter(user=user_id)
    departmentsList=[]
    for d in DepartmentsRelated:
        departmentsList.append(d.department_id if type == "id" else Department.objects.all().filter(department_id=d.department_id)[0].department_name)
    return departmentsList

def GetBrowserStackBrowsers(request):
    # set default value for results to empty array
    results = []
    # get browserstack cloud from database
    bsCloud = Cloud.objects.filter(name="browserstack")
    # check if bsCloud exists and is active
    if len(bsCloud) > 0 and bsCloud[0].active:
        browsers = requests.get("https://api.browserstack.com/automate/browsers.json", auth=HTTPBasicAuth(BROWSERSTACK_USERNAME, BROWSERSTACK_PASSWORD))
        if browsers.status_code == 200:
            results = browsers.json()
        else:
            logger.error(browsers.text)
            return JsonResponse({
                "success": False,
                "msg": "Failed to make request to Browserstack, maybe provided credentials are incorrect?"
            })
    # send a response back
    return JsonResponse({
        "success": True,
        "results": results
    }, safe=False)


def GetUserDepartments(request):
    user = request.session['user']
    # Get an array of the departments ids owned by the current logged user
    try:
        departmentsOwning = Department.objects.filter(owners__user_id=request.session['user']['user_id']).values_list('department_id', flat=True)
    except FieldError:
        print('DepartmentOwners not implemented yet')
        departmentsOwning = []
    # Get an array of department ids which the user has access to from the OIDCAccount info
    userDepartments = [x['department_id'] for x in request.session['user']['departments']]
    # Merge arrays of departments and owning, and return
    return userDepartments + list(set(departmentsOwning) - set(userDepartments))

# function that recieves feature_run are removes all feature_results not
# marked as archived.
def removeNotArchivedFeatureResults(feature_run, *args, **kwargs):
    # get deleteTemplate from kwargs
    deleteTemplate = kwargs.get('deleteTemplate', False)
    # loop over are the results and remove them if not marked as archived
    for feature_result in feature_run.feature_results.filter(archived=False):
        # finally remove the feature_result
        feature_result.delete(deleteTemplate=deleteTemplate)

@csrf_exempt
def DepartmentsRelatedToAccountView(request):
    user_email = request.META.get("HTTP_PROXY_USER")

    departmentsList=UserRelatedDepartments(user_email)

    querySet = Department.objects.all().filter(department_id__in=departmentsList)
    serializer=DepartmentSerializer(querySet, many=True)

    data=serializer.data
    count=len(querySet)
    d=json.dumps(data)

    return JsonResponse({
        "count": count,
        "next": None,
        "previous": None,
        "results": json.loads(d)
    })

def departmentExists(department_id) -> int:
    try:
        department = Department.objects.get(department_id=department_id)
        return department.department_id
    except Exception as err:
        return -1

@csrf_exempt
def CreateOIDCAccount(request):
    return JsonResponse(request.session['user'], status=200)

""" def Screenshot(request, screenshot_name):
    os.chdir('/code/behave/screenshots/')
    # Check for WebP Support
    webp_support = 'image/webp' in request.META.get('HTTP_ACCEPT', 'none')
    image_extension = 'webp' if webp_support else 'jpg'
    compressedImage = 'compressed/%s_compressed.%s' % (screenshot_name.replace('.png', ''), image_extension)
    # Create compressed folder if not exists
    Path('/code/behave/screenshots/compressed/').mkdir(parents=True, exist_ok=True)
    if not os.path.exists(compressedImage):
        # Compress image
        try:
            im = Image.open(screenshot_name)
            # JPG images can't support RGBA color profile, convert it
            if not webp_support:
                im = im.convert("RGB")
            im.save(compressedImage, optimize=True, quality=70)
        except:
            print('Unable to find screenshot %s' % compressedImage)
            pass
    try:
        with open(compressedImage, "rb") as f:
            # Serve the adequate image format
            return HttpResponse(f.read(), content_type="image/%s" % image_extension)
    except IOError:
        return HttpResponse('ImageError') """

# Retrieves all possible information of parents objects from a step result
def getStepResultParents(step_result_id):
    # Get step result object using id
    step_result = Step_result.objects.filter(step_result_id=step_result_id)
    if not step_result.exists():
        raise Exception('Unable to get step_result.')
    step_result = step_result[0]
    # Get feature result for current step result
    feature_result = Feature_result.objects.filter(feature_result_id=step_result.feature_result_id)
    if not feature_result.exists():
        raise Exception('Unable to get parent feature_result.')
    feature_result = feature_result[0]
    # Get feature run for current step result
    feature_run = feature_result.feature_runs_set.filter()
    if not feature_run.exists():
        raise Exception('Unable to get parent feature_run.')
    feature_run = feature_run[0]
    # Get feature for current step result
    feature = feature_run.feature
    return {
        step: step_result,
        result: feature_result,
        run: feature_run,
        feature: feature
    }

@csrf_exempt
def featureRunning(request, feature_id, *args, **kwargs):
    """
    This view acts as a proxy for <sw_server>/featureStatus/:feature_id
    """
    request_response = requests.get('http://cometa_socket:3001/featureStatus/%d' % int(feature_id))
    django_response = HttpResponse(
        content=request_response.content,
        status=request_response.status_code,
        content_type=request_response.headers['Content-Type']
    )
    return django_response

@csrf_exempt
def noVNCProxy(request, feature_result_id, *args, **kwargs):
    # request.session['user'] = OIDCAccountLoginSerializer(OIDCAccount.objects.get(user_id=5), many=False).data
    try:
        # get feature_result from feature_result_id
        fr = Feature_result.objects.get(feature_result_id=int(feature_result_id))
        # get logged in user departments
        user_departments = [x['department_id'] for x in request.session['user']['departments']]
        # check if logged in user is the one that executed this feature_result
        # or if user belongs to the feature department
        if ( fr.executed_by.user_id == request.session['user']['user_id'] or fr.department_id in user_departments ):
            # check if session is still running
            if not fr.running:
                raise Exception("Live session has ended.")
            # get session_id from feature_result and proxy to noVNC
            session_id = fr.session_id
            return JsonResponse({'success': True, 'session_id': session_id})
        else:
            raise Exception("You don't have permissions to view this live session.")
    except Exception as error:
        return JsonResponse({'success': False, 'error': str(error)})

@csrf_exempt
def userDetails(request, *args, **kwargs):
    """
    This view is used to return detailed information of the user
    which requires more backend logic than just retrieving a variable
    """
    info = {}
    user = request.session['user']
    if get_requires_payment():
        # Get user current usage money
        info['usage_money'] = round(get_user_usage_money(user['user_id']), 2)
    return JsonResponse(info)

@csrf_exempt
@require_permissions("remove_screenshot")
def removeScreenshot(request, *args, **kwargs):
    # Get data from body payload
    data = json.loads(request.body)
    step_result_id = data.get('step_result_id', None)
    screen_type = data.get('type', None)

    # Check if we have what we need
    if not step_result_id or not screen_type:
        return JsonResponse({ 'success': False }, status=400)

    # Retrieve information related to current step
    step_result = Step_result.objects.filter(step_result_id=step_result_id)
    if not step_result.exists():
        return JsonResponse({ 'success': False, 'error': 'Step result not found with ID: ' + str(step_result_id) })
    step_result = step_result[0]
    # Construct screenshots folders and screenshot filename
    screenshots_root = '/code/behave/screenshots/'
    filename = getattr(step_result, 'screenshot_' + screen_type, '')
    # print(step_result.screenshot_current)
    if not filename:
        return JsonResponse({ 'success': False, 'error': 'Screenshot filename not found with key: ' + screen_type })
    file = screenshots_root + filename
    # Make sure the file exists in disk before anything else
    if not os.path.isfile(file):
        return JsonResponse({ 'success': False, 'error': 'File was not found.' })
    try:
        # Remove the PNG
        os.remove(file)
        try:
            # Remove the WebP version, this removal is optional
            os.remove(file.replace('.png', '.webp'))
        except OSError:
            pass
        # Update database
        setattr(step_result, 'screenshot_' + screen_type, '')
        step_result.save()
        return JsonResponse({ 'success': True })
    except OSError:
        return JsonResponse({ 'success': False, 'error': 'Failed to delete file.' })

@csrf_exempt
@require_permissions("remove_screenshot")
def removeTemplate(request, *args, **kwargs):
    # Get data from body payload
    data = json.loads(request.body)
    template = data.get('template', None)
    step_result_id = data.get('step_result_id', None)

    # Check if we have what we need
    if not template or not step_result_id:
        return JsonResponse({ 'success': False }, status=400)

    step_result = Step_result.objects.filter(step_result_id=step_result_id)
    if not step_result.exists():
        return JsonResponse({ 'success': False, 'error': 'Specified step result id not found.' })

    # Construct screenshots folders and screenshot filename
    screenshots_root = '/code/behave/screenshots/'
    file = screenshots_root + template
    # Make sure the file exists in disk before anything else
    if not os.path.isfile(file):
        return JsonResponse({ 'success': False, 'error': 'Template file was not found.' })
    try:
        # Remove the PNG
        os.remove(file)
        # Update database
        step_result.update(screenshot_template='')
        return JsonResponse({ 'success': True })
    except OSError:
        return JsonResponse({ 'success': False, 'error': 'Failed to delete template file.' })

def Screenshots(step_result_id):
    os.chdir('/code/behave/screenshots/')
    screenshots = {}
    try:
        # FIXME: Dirty fix for getting correct current image
        files = [x for x in glob.glob(SCREENSHOT_PREFIX + step_result_id + '_*.png') if not 'style' in x and not 'diff' in x]
        if len(files) > 0:
            screenshots['current'] = files[0]
        else:
            files = glob.glob(SCREENSHOT_PREFIX + step_result_id + '.png')
            screenshots['current'] = files[0]
    except:
        pass
    try:
        files = glob.glob(SCREENSHOT_PREFIX + step_result_id + '_*_style.png')
        if len(files) > 0:
            screenshots['template'] = files[0]
        else:
            files = glob.glob(SCREENSHOT_PREFIX + step_result_id + '_style.png')
            screenshots['template'] = files[0]
    except:
        pass
    try:
        files = glob.glob(SCREENSHOT_PREFIX + step_result_id + '_*.png_diff.png')
        if len(files) > 0:
            screenshots['difference'] = files[0]
        else:
            files = glob.glob(SCREENSHOT_PREFIX + step_result_id + '.png_diff.png')
            screenshots['difference'] = files[0]
    except:
        pass
    return screenshots

# Function to automatically send help email to users who have "I can help" enabled
def SendHelpEmail(request, feature):
    # send email to users with can_help if feature was marked as need_help
    if feature.need_help:
        # get all the users with can_help attribute
        can_help = OIDCAccount.objects.filter(settings__can_help=True)
        # remove all default department from the can_help list
        can_help = [user for user in can_help if user.account_role_set.exclude(department__department_name="Default").count() > 0]
        # filter users in feature department
        can_help = Account_role.objects.filter(department__department_id=feature.department_id, user__in=can_help).values_list('user__email', flat=True)
        # convert can_help from querySet object to list object
        can_help = list(can_help)
        # if can_help list is empty that means no one is ready to help yet
        # fallback and sent the email to all SUPERUSERS
        if len(can_help) == 0:
            # get all the superusers
            can_help = OIDCAccount.objects.filter(user_permissions__permission_name='SUPERUSER').values_list('email', flat=True)
            # convert can_help from querySet object to list object
            can_help = list(can_help)
        # generate email subject
        email_subject = '[COMETA][NEED HELP] Users need help with feature: %s' % (feature.feature_name)
        # generate email body
        email_body = """
        Dear Users,<br><br>

        We are sending you this email, because other users are having some difficulties running their testcases.<br>
        Could you be able to help them out. All the details are listed below.<br><br>

        User requesting the help:
        <ul>
            <li><strong>Name:</strong> %s</li>
            <li><strong>E-mail:</strong> %s</li>
        </ul>
        Feature information:
        <ul>
            <li><strong>Feature ID:</strong> %d</li>
            <li><strong>Feature Name:</strong> %s</li>
            <li><strong>Feature Link:</strong> <a href="%s/#/%s/%s/%d">here</a></li>
        </ul>
        Environment information:
        <ul>
            <li><strong>Environment Name:</strong> %s</li>
        </ul>
        Thanks in advance for your help.<br><br>
        Best regards<br><br>
        co.meta<br>
        """ % (
            feature.last_edited.name,
            feature.last_edited.email,
            feature.feature_id,
            feature.feature_name,
            request.META.get('HTTP_ORIGIN', ""),
            feature.app_name,
            feature.environment_name,
            feature.feature_id,
            feature.environment_name
        )
        try:
            # generate email object
            email = EmailMultiAlternatives(
                email_subject,
                "",
                settings.EMAIL_HOST_USER,
                to=["noreply@amvara.de"],
                bcc=can_help,
                headers={'X-COMETA': 'proudly_generated_by_amvara_cometa', 'X-COMETA-SERVER': 'AMVARA', 'X-COMETA-VERSION': str(version), 'X-COMETA-FEATURE': feature.feature_name, 'X-COMETA-DEPARTMENT':feature.department_name}
            )
            # attatch html content (body)
            email.attach_alternative(email_body, "text/html")
            # send email
            email.send()
            # help print
            print("Email has been sent.... to:")
            pprint(can_help)
        except Exception as err:
            print(str(err))

@csrf_exempt
@require_permissions("download_result_files")
def downloadFeatureFiles(request, filepath, *args, **kwargs):
    # get user from the session
    user = request.session['user']
    # static path to downloads folder
    downloadsFolder = '/code/behave/downloads/'
    # join static path and filepath
    fullPath = os.path.join(downloadsFolder, filepath)
    # get the feature_result_id from the filepath
    feature_result_id = filepath.split("/")
    # check filepath length, should be more than 1
    if len(feature_result_id) <= 1:
        raise SuspiciousOperation
    # try to convert feature_result_id to int if it fails possibly not getting a feature_result_id
    try:
        feature_result_id = int(feature_result_id[0])
    except:
        raise SuspiciousOperation
    # get feature_result fromt he feature_result_id
    feature_result = Feature_result.objects.filter(feature_result_id=feature_result_id)
    # check if feature_result requested exists
    if not feature_result.exists():
        # if it does not exists throw a 404
        raise Http404
    feature_result = feature_result[0]
    # check if feature_result department id is in user's departments
    departmentFilter = [x for x in user['departments'] if x['department_id'] == feature_result.department_id]
    # if no departments are found in users departments throw a forbidden
    if len(departmentFilter) == 0:
        raise PermissionDenied

    # check if fullpath exists
    if os.path.exists(fullPath):
        # open the file
        with open(fullPath, 'rb') as fh:
            response = HttpResponse(fh.read(), content_type='application/force-download')
            response['Content-Disposition'] = 'attachment; filename="%s"' % os.path.basename(filepath)
            return response
    raise Http404

# Sends the request to behave without waiting
def startFeatureRun(data):
    requests.post('http://behave:8001/run_test/', data=data)

@csrf_exempt
@require_subscription()
@require_permissions("run_feature")
def runTest(request, *args, **kwargs):
    # Verify body can be parsed as JSON
    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({ 'success': False, 'error': 'Unable to parse request body.' })

    # Verify feature id exists
    try:
        feature = Feature.objects.get(feature_id=data['feature_id'])
    except Feature.DoesNotExist:
        return JsonResponse({ 'success': False, 'error': 'Provided Feature ID does not exist.' })

    # Verify access to submitted browsers
    try:
        subscriptions = get_subscriptions_from_request(request)
        check_browser_access(feature.browsers, subscriptions)
    except Exception as err:
        return JsonResponse({ 'success': False, 'error': str(err) })

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
                return JsonResponse({ 'success': False, 'error': 'Execution will exceed budget and user has `prevent` option configured.' })
        else:
            # Request coming from front user
            # Retrieve confirm parameter from body JSON
            confirm = data.get('confirm', False)
            if not confirm:
                try:
                    budget_exceeded = check_user_will_exceed_budget(user['user_id'], feature.feature_id)
                    if budget_exceeded:
                        # Budget will or has already exceeded the budget
                        return JsonResponse({ 'success': False, 'action': 'confirm_exceeded' })
                except BudgetAhead as err:
                    # Budget is very close to be reached
                    return JsonResponse({ 'success': False, 'action': 'confirm_ahead' })
                except Exception as err:
                    # An unkown error occurred
                    capture_exception(err)
                    logger.error(str(err))
                    return JsonResponse({ 'success': False, 'error': str(err) })

    # create a run id for the executed test
    date_time = datetime.datetime.utcnow()
    fRun = Feature_Runs(feature=feature, date_time=date_time)
    fRun.save()

    # update feature info
    feature.info = fRun

    # Make sure feature files exists
    steps = Step.objects.filter(feature_id=data['feature_id']).order_by('id').values()
    feature.save(steps=list(steps))
    json_path = get_feature_path(feature)['fullPath']+'_meta.json'

    # check if job exists
    jobParameters = {}
    if "jobId" in data:
        try:
            job = Schedule.objects.get(id=data['jobId'])
            job.parameters['jobId'] = job.id
            jobParameters = job.parameters
        except Exception as err:
            return JsonResponse({'success': False, 'error': str(err)})

    # get environment variables
    env = Environment.objects.filter(environment_name=feature.environment_name)[0]
    dep = Department.objects.filter(department_name=feature.department_name)[0]
    env_variables = Variable.objects.filter(
        Q(department=dep),
        Q(environment=env) |
        Q(feature=feature)
    ).order_by('variable_name', '-based').distinct('variable_name')
    seri = VariablesSerializer(env_variables, many=True).data

    # user data
    user = request.session['user']

    datum = {
        'json_path': json_path,
        'feature_run': fRun.run_id,
        'HTTP_PROXY_USER': json.dumps(user),
        'HTTP_X_SERVER': request.META.get("HTTP_X_SERVER","none"),
        "variables": json.dumps(seri),
        "browsers": json.dumps(feature.browsers),
        "feature_id": feature.feature_id,
        "department": json.dumps(model_to_dict(dep), default=str),
        "parameters": json.dumps(jobParameters)
    }

    try:
        # Spawn thread to launch feature run
        t = Thread(target=startFeatureRun, args=(datum, ))
        t.start()
        return JsonResponse({ 'success': True })
    except Exception as e:
        return JsonResponse({ 'success': False, 'error': str(e) })

@csrf_exempt
def GetSteps(request, feature_id):
    queryset = Step.objects.filter(feature_id=feature_id)
    if request.GET.get("subSteps", False):
        queryset = queryset.filter(Q(step_type="normal") | Q(step_type="substep")).filter(enabled=True)
    data = StepSerializer(queryset.order_by('id'), many=True).data
    return JsonResponse({ 'results': data })

@csrf_exempt
def GetInfo(request):
    return JsonResponse({ 'version': version })

@csrf_exempt
def GetStepsByName(request):
    data = json.loads(request.body)
    feature = Feature.objects.filter(feature_name=data['feature_name'])
    if len(feature) > 0:
        feature_id = feature[0].feature_id
        queryset = Step.objects.filter(feature_id=feature_id).order_by('id').values()
        data = list(queryset)
        return JsonResponse({ 'results': data })
    else:
        return JsonResponse({ 'results': [] })

@csrf_exempt
def UpdatePixelDifference(request, step_result_id):
    data = json.loads(request.body)
    # Create dict for update payload
    updateObj = {}
    # Try to retrieve params from POST
    pixel_diff = data.get('pixel_diff', None)
    if pixel_diff is not None:
        updateObj['pixel_diff'] = int(float(pixel_diff))
    # template_name = data.get('template_name', None) # Template name was the old way for the front to know about the original style image
    diff = data.get('different_html', None)
    if diff is not None:
        updateObj['diff'] = diff
    # Update step result with retrieved parameters
    Step_result.objects.filter(step_result_id=step_result_id).update(**updateObj)
    if 'pixel_diff' in updateObj:
        StepResult = Step_result.objects.get(step_result_id=step_result_id)
        FeatureResult = Feature_result.objects.filter(feature_result_id=StepResult.feature_result_id)
        FeatureResult.update(pixel_diff = FeatureResult.first().pixel_diff + updateObj['pixel_diff'])
    return JsonResponse({ 'success': True })

@csrf_exempt
def UpdateScreenshots(request, step_result_id):
    data = json.loads(request.body)
    Step_result.objects.filter(step_result_id=step_result_id).update(
        screenshot_current = data.get('screenshot_current', ''),
        screenshot_style = data.get('screenshot_style', ''),
        screenshot_difference = data.get('screenshot_difference', ''),
        screenshot_template = data.get('screenshot_template', '')
    )
    return JsonResponse({ 'success': True })

@csrf_exempt
def MigrateScreenshots(request):
    screenshots_root = '/code/behave/screenshots/'
    # CD into screenshots directory
    os.chdir(screenshots_root)
    # Construct grouped dictionary by step_result_id
    groups = {}
    images_count = 0
    for file in os.listdir():
        # Only work on files matching the screenshot regex
        # https://regexr.com/5selu
        screenshot = re.match(r'^AMVARA_(\d+)(_([a-z0-9]{5,}))?(_style|\.png_diff)?.png$', file)
        if not screenshot:
            continue
        images_count += 1
        # Get the StepResultID
        step_result_id = screenshot.group(1)
        # Set the key for classifying
        groups.setdefault(step_result_id, {})
        if 'png_diff' in file:
            # Is Difference
            groups[step_result_id].setdefault('difference', file)
        elif '_style' in file:
            # Is Style
            groups[step_result_id].setdefault('style', file)
        else:
            # Is current
            groups[step_result_id].setdefault('current', file)
    images_success_count = 0
    images_error_count = 0
    step_results_count = len(list(groups.keys()))
    running_count = 0
    # Work on migration of every group of step results
    for step_result_id in groups:
        running_count += 1
        print('Migrating %d of %d' % (running_count, step_results_count))
        print('\tGetting step result')
        # Get step result object using id
        step_result = Step_result.objects.filter(step_result_id=step_result_id)
        if not step_result.exists():
            print('Unable to get step_result with id:', step_result_id)
            images_error_count += 1
            continue
        step_result = step_result[0]
        # Get feature result for current step result
        print('\tGetting feature result')
        feature_result = Feature_result.objects.filter(feature_result_id=step_result.feature_result_id)
        if not feature_result.exists():
            print('Unable to get parent feature_result for step_result_id:', step_result_id)
            images_error_count += 1
            continue
        feature_result = feature_result[0]
        # Get feature run for current step result
        print('\tGetting feature run')
        feature_run = feature_result.feature_runs_set.filter()
        if not feature_run.exists():
            print('Unable to get parent feature_run for feature_result_id:', feature_result.feature_result_id)
            images_error_count += 1
            continue
        feature_run = feature_run[0]
        print('\tGetting feature')
        # Get feature for current step result
        feature = feature_run.feature
        # Generate random hash for current iteration
        run_hash = secrets.token_hex(nbytes=8)
        # Construct current step result path
        screenshots_path = getStepResultScreenshotsPath(
            feature.feature_id,
            feature_run.run_id,
            feature_result.feature_result_id,
            run_hash,
            step_result_id
        )
        # Create directory path if not exists already
        print('\tCreating step result folder:', screenshots_root + screenshots_path)
        Path(screenshots_root + screenshots_path).mkdir(parents=True, exist_ok=True)
        # Move screenshots to new path
        print('\tMoving screenshot files:')
        current_screenshot = groups[step_result_id].get('current', '')
        if current_screenshot:
            new_file = screenshots_root + screenshots_path + SCREENSHOT_PREFIX + 'current.png'
            move(screenshots_root + current_screenshot, new_file)
            toWebP(new_file)
            current_screenshot = removePrefix(new_file, screenshots_root)
            images_success_count += 1
            print('\t\tCurrent')
        style_screenshot = groups[step_result_id].get('style', '')
        if style_screenshot:
            new_file = screenshots_root + screenshots_path + SCREENSHOT_PREFIX + 'style.png'
            move(screenshots_root + style_screenshot, new_file)
            toWebP(new_file)
            style_screenshot = removePrefix(new_file, screenshots_root)
            images_success_count += 1
            print('\t\tStyle')
        difference_screenshot = groups[step_result_id].get('difference', '')
        if difference_screenshot:
            new_file = screenshots_root + screenshots_path + SCREENSHOT_PREFIX + 'difference.png'
            move(screenshots_root + difference_screenshot, new_file)
            toWebP(new_file)
            difference_screenshot = removePrefix(new_file, screenshots_root)
            images_success_count += 1
            print('\t\tDifference')
        print('\tUpdating step result with screenshots info')
        # Save moved screenshots path to database
        step_result.screenshot_current = current_screenshot
        step_result.screenshot_style = style_screenshot
        step_result.screenshot_difference = difference_screenshot
        step_result.save()
        print('\tUpdating feature result with generated run hash')
        feature_result.run_hash = run_hash
        feature_result.save()
    print('Migration of old screenshots complete!')
    result = {
        'total_images': images_count,
        'success': images_success_count,
        'failed': images_error_count,
        'skipped': images_count - (images_success_count + images_error_count)
    }
    print(result)
    return JsonResponse(result)

@csrf_exempt
def CheckBrowserstackVideo(request):
    data = json.loads(request.body)
    video_url = data.get('video', None)

    # Check passed video url in POST payload
    if not video_url:
        return JsonResponse({ 'success': False, 'error': 'Invalid video url.' }, status=400)

    # Return response of checking if browserstack video exists
    response = requests.get(video_url, headers={ 'Range': 'bytes=0-1024' })
    django_response = HttpResponse(
        content=response.content,
        status=response.status_code,
        content_type=response.headers['Content-Type']
    )
    return django_response

@csrf_exempt
def parseBrowsers(request):
    browsersFile = '/code/selenoid/browsers.json'
    emulatedBrowsersFile = '/code/selenoid/mobile_browsers.json'
    # Check if browser.json file exists
    if not os.path.exists(browsersFile):
        print("File %s doesn't exist, please execute deploy_selenoid.sh outside of docker to create it")
        return JsonResponse({ 'success': False, 'error': 'browser.json not found' }, status=503)
    # Load JSON data of browsers.json
    with open(browsersFile) as file:
        try:
            browsers = json.load(file)
        except:
            return JsonResponse({ 'success': False, 'error': 'browser.json contains invalid JSON data' }, status=503)
    # Delete all previous browser objects
    Browser.objects.all().delete()
    # Iterate over each available browser name
    for (browserKey, _) in browsers.items():
        # Iterate over each available browser version
        for (versionKey, _) in browsers[browserKey]['versions'].items():
            # Create browser object
            Browser.objects.create(
                browser_json={
                    "os": "Generic",
                    "cloud": "local",
                    "device": None,
                    "browser": browserKey,
                    "os_version": "Selenium",
                    "real_mobile": False,
                    "browser_version": str(versionKey)
                }
            )
    # Check if there is a chrome version in Selenoid, as it is mandatory for emulated mobiles
    if 'chrome' in browsers:
        version = browsers.get('chrome', {}).get('default', None)
        if version is not None:
            # Read mobile browsers json
            with open(emulatedBrowsersFile) as json_file:
                emulateds = json.load(json_file)
            for emulated in emulateds:
                # Change the Chrome version in the emulated device userAgent
                args = {
                    'browser_json': emulated
                }
                Browser.objects.create(**args)
    # Send a request to websockets about the browsers update
    requests.post('http://cometa_socket:3001/sendAction', json={
        'type': '[Browsers] Get All'
    })
    return JsonResponse({ 'success': True })

@csrf_exempt
def parseActions(request):
    actions_file = '/code/behave/cometa_itself/steps/actions.py'
    with open(actions_file) as file:
        actions = file.readlines()
    actionsParsed = []
    Action.objects.all().delete()
    previousAction = ''
    for action in actions:
        if action.startswith("@step"):
            regex = r"\@(.*)\((u|)'(.*)'\)"
            matches = re.findall(regex,action)
            if matches[0][2] == "{step}":
                continue
            actionsParsed.append(matches[0][2])
            actionObject = Action(
                action_name = matches[0][2],
                department = 'DIF',
                application = 'amvara',
                values = matches[0][2].count("{"),
                description = previousAction[2:]
            )
            actionObject.save()
        previousAction = action

    # send a request to websockets about the actions update
    requests.post('http://cometa_socket:3001/sendAction', json={
        'type': '[Actions] Get All'
    })

    return JsonResponse({ 'success': True, 'actions': actionsParsed })

@csrf_exempt
def Contact(request):
    data = json.loads(request.body)
    contact = MiamiContact(
        email = data['email'],
        name = data['name'],
        tel = data['tel'],
        origin = data['origin'],
        language = data['lang']
    )
    contact.save()

    # generate email subject
    email_subject = 'Access Code to DAP Cognos Analytics Reports'
    # generate email body
    email_body = """
    Thank you %s for registering in our cool App, for more info of us visit <a href="https://amvara.de/" target="_blank">https://amvara.de/</a>.<br />
    Your access code is <b>TheSexiestReport</b><br />
    DAP website: <a href="https://more.amvara.rocks/" target="_blank">https://more.amvara.rocks/</a>
    """ % (
        data['name']
    )

    try:
        # generate email object
        email = EmailMultiAlternatives(
            email_subject,
            "",
            settings.EMAIL_HOST_USER,
            to=[data['email']],
            headers={'X-COMETA': 'proudly_generated_by_amvara_cometa', 'X-COMETA-SERVER': 'AMVARA'}
        )
        # attatch html content (body)
        email.attach_alternative(email_body, "text/html")
        # send email
        email.send()
        # help print
        print("Email has been sent.... to:")
        pprint(data['email'])
    except Exception as err:
        print(str(err))
        return JsonResponse({'success': False, 'error': 'An error occured: %s' % str(err)})
    return JsonResponse({ 'success': True })

@csrf_exempt
@require_permissions('edit_feature')
def UpdateSchedule(request, feature_id, *args, **kwargs):
    data = json.loads(request.body)
    schedule = data.get('schedule', None)
    # Check schedule is provided
    if schedule is None:
        return JsonResponse({ 'success': False, 'error': 'Schedule not provided.' })
    # Retrieve feature
    features = Feature.objects.filter(feature_id = feature_id)
    # Check feature exists
    if not features.exists():
        return JsonResponse({ 'success': False, 'error': 'Feature not found with specified ID.' })
    feature = features[0]
    # Check if new schedule is set
    if schedule != 'now':
        # Validate cron format before sending to Behave
        if schedule != "" and not CronSlices.is_valid(schedule):
            return JsonResponse({ 'success': False, "error": 'Schedule format is invalid.' }, status=200)
        # Set schedule in Behave
        response = set_test_schedule(feature.feature_id, schedule, request.session['user']['user_id'])
        if response.status_code != 200:
            # Oops, something went wrong while saving schedule
            json_data = response.json()
            return JsonResponse({ 'success': False, "error": json_data.get('error', 'Something went wrong while saving schedule.') }, status=200)

    # Update schedule property
    features.update(schedule = schedule)
    return JsonResponse({ 'success': True })

def uploadFilesThread(files, department_id, uploaded_by):
    for file in files:
        uploadFile = UploadFile(file, department_id, uploaded_by)
        print(uploadFile.proccessUploadFile())

class UploadViewSet(viewsets.ModelViewSet):
    queryset = File.objects.none()
    serializer_class = FileSerializer
    renderer_classes = (JSONRenderer, )

    def decryptFile(self, source):
        import tempfile
        target = "/tmp/%s" % next(tempfile._get_candidate_names())

        logger.debug(f"Decrypting source {source}")

        try:
            result = subprocess.run(["bash", "-c", f"gpg --output {target} --batch --passphrase {secret_variables.COMETA_UPLOAD_ENCRYPTION_PASSPHRASE} -d {source}"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode > 0:
                # get the error
                errOutput = result.stderr.decode('utf-8')
                logger.error(errOutput)
                raise Exception('Failed to decrypt the file, please contact an administrator.')
            return target
        except Exception as err:
            raise Exception(str(err))

    def list(self, request, *args, **kwargs):
        file_id = kwargs.get('file_id', None)
        XHR = request.headers.get('X-Requested-With', None)
        
        # check if file id was passed.
        if file_id is None:
            return JsonResponse({ 'success': False, 'error': 'Missing file id.' })
        
        try:
            # get the file from file id
            file = File.objects.get(id=file_id)

            # check if user has access to the file
            self.userHasAccess(request, file)

            # decrypt file
            targetPath = self.decryptFile(file.path)
            # check if fullpath exists
            if os.path.exists(targetPath):
                # open the file
                with open(targetPath, 'rb') as fh:
                    data = fh.read()
                    # check if request was made using XHR
                    if XHR is not None and XHR == 'XMLHttpRequest':
                        data = base64.b64encode(data)
                    response = HttpResponse(data, content_type=file.mime)
                    response['Content-Disposition'] = 'attachment; filename="%s"' % file.name
                os.remove(targetPath)
                return response
            return JsonResponse({ 'success': True })
        except Exception as err:
            logger.error(f"Error occured while trying to download the file: {file_id}.")
            logger.exception(err)
            return JsonResponse({ 'success': False, 'error': 'File does not exists.' }, status=404)

    def put(self, request, *args, **kwargs):
        file_id = kwargs.get('file_id', None)
        restore = request.POST.get('restore', False)
        
        # check if file id was passed.
        if file_id is None:
            return JsonResponse({ 'success': False, 'error': 'Missing file id.' })
        
        try:
            # get the file from file id
            file = File.all_objects.get(id=file_id)

            # check if user has access to the file
            self.userHasAccess(request, file)

            if restore == "true":
                file.restore()
            return JsonResponse({ 'success': True })
        except Exception as err:
            logger.error(f"Error occured while trying to update the file: {file_id}.")
            logger.exception(err)
            return JsonResponse({ 'success': False, 'error': 'File does not exists.' })

    def create(self, request):
        # get the department_id from the request
        department_id = request.POST.get('department_id', -1)
        if department_id == -1 or departmentExists(department_id) == -1:
            return JsonResponse({ 'success': False, 'error': "Department does not exist." })

        try:
            # Spawn thread to upload files in background
            t = Thread(target=uploadFilesThread, args=(request.FILES.getlist('files'), department_id, request.session['user']['user_id']))
            t.start()
            return JsonResponse({ 'success': True })
        except Exception as e:
            return JsonResponse({ 'success': False, 'error': str(e) })
    
    def delete(self, request, *args, **kwargs):
        file_id = kwargs.get('file_id', None)
        
        # check if file id was passed.
        if file_id is None:
            return JsonResponse({ 'success': False, 'error': 'Missing file id.' })
        
        try:
            # get the file from file id
            file = File.objects.get(id=file_id)

            # check if user has access to the file
            self.userHasAccess(request, file)

            file.delete()
            return JsonResponse({ 'success': True })
        except Exception as err:
            logger.error(f"Error occured while trying to delete the file: {file_id}.")
            logger.exception(err)
            return JsonResponse({ 'success': False, 'error': 'File does not exists.' })
    
    def userHasAccess(self, request, file):
        # get department id from the userb
        department_id = file.department_id
        # get user departments
        user_departments = GetUserDepartments(request)

        if department_id not in user_departments:
            raise Exception('User trying to access file with no access to the department.')
        
        return True
        

class AccountViewset(viewsets.ModelViewSet):
    """
    API endpoint to view or edit accounts
    """
    queryset = OIDCAccount.objects.all()
    serializer_class = OIDCAccountSerializer
    renderer_classes = (JSONRenderer, )

    @require_permissions("view_accounts||view_accounts_panel")
    def list(self, request, *args, **kwargs):
        # check if search parameter is set in GET parameters
        search = request.GET.get('search', False)
        if search:
            # search for users in db with search criteria
            users = OIDCAccount.objects.filter(Q(name__icontains=search) | Q(email__icontains=search) | Q(user_permissions__permission_name__icontains=search)).order_by("-created_on")
        else:
            # get all users from db
            users = OIDCAccount.objects.all().order_by("-created_on")
        # paginate the queryset
        page = self.paginate_queryset(users)
        # serialize the paginated data
        serialized_data = OIDCAccountSerializer(page, many=True).data
        # return data to the user
        return self.get_paginated_response(serialized_data)

    @require_permissions('edit_account', account_id="args[0].kwargs['account_id']")
    def patch(self, request, *args, **kwargs):
        data = json.loads(request.body.decode('utf-8'))
        user_id = self.kwargs['account_id']
        serializer = OIDCAccountJsonSerializer(data=data)
        if serializer.is_valid():
            OIDCAccount.objects.filter(user_id=user_id).update(
                name = data['name'],
                email = data['email']
            )
            user = OIDCAccount.objects.filter(user_id=user_id)
            if 'favourite_browsers' in data:
                user.update( favourite_browsers = json.loads(data['favourite_browsers']) )
            if 'settings' in data:
                user.update( settings = data['settings'] )
            if 'permission_name' in data:
                user_permission = Permissions.objects.filter(permission_name=data['permission_name'])
                if user_permission.exists() and request.session['user']['user_permissions']['permission_power'] >= user_permission[0].permission_power:
                    user.update(
                        user_permissions = user_permission[0]
                    )
                else:
                    return JsonResponse({ 'success': False, 'error': 'You do not have permissions to set higher role than your current role.'}, status=403)
            if 'departments' in data and not kwargs['usersOwn']:
                Account_role.objects.filter(user=user_id).delete()
                for department in data['departments']:
                    department = Department.objects.filter(department_id = department)[0]
                    Account_role.objects.create(
                        user = user[0],
                        department = department
                    )
                
            # get user thats been updated
            user = OIDCAccount.objects.filter(user_id=user_id)[0]
            # send a websocket to front about the creation
            response = requests.post('http://cometa_socket:3001/sendAction', json={
                'type': '[Accounts] Modify Account',
                'account': IAccount(user, many=False).data
            })

            return JsonResponse({ 'success': True }, status=200)
        else:
            return JsonResponse(serializer.errors, status=400)

    @require_permissions('delete_account')
    def delete(self, request, *args, **kwargs):
        user_id = self.kwargs['account_id']
        users = OIDCAccount.objects.filter(user_id=user_id)
        if not users.exists():
            return JsonResponse({"success": False , "error": "User_id invalid or doesn't exist."}, status=400)

        users.delete()

        # send a websocket to front about the creation
        response = requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Accounts] Remove  Account',
            'account_id': user_id
        })

        return JsonResponse({"success": True }, status=200)

class ActionViewSet(viewsets.ModelViewSet):
    """
    API endpoint to view or edit actions
    """
    queryset = Action.objects.all()
    serializer_class = ActionSerializer
    renderer_classes = (JSONRenderer, )

    def list(self, request):
        queryset = Action.objects.all()
        query = self.request.query_params
        department = query.get('department', None)
        application = query.get('app', None)
        if department is not None:
            queryset = queryset.filter(department=department)
        if application is not None:
            queryset = queryset.filter(application=application)
        return Response({
            'results': ActionSerializer(queryset, many=True).data
        })

# # FeatureResultByFeatureIdViewSet
# # ... takes parameter FeatureId and returns all results for that ID from featureResults
# # ... this enables showing all results without grouping them by featureRun
# class FeatureResultByFeatureIdViewSet(viewsets.ModelViewSet):
#     """
#     API endpoint that allow returns featureResults for a featureID.
#     """
#     queryset = Feature_result.available_objects.all()
#     serializer_class = FeatureResultSerializer
#     renderer_classes = (JSONRenderer, )
#     filter_backends = (filters.OrderingFilter,)
#     ordering_fields = ('result_date',)

#     def list(self, request, *args, **kwargs):

#         data = {}

#         #
#         # If featureId in request, then return the featureResults for that ID
#         # ... this does not take into account the "archived/saved" feature-runs
#         # ... TODO/FIXME/XXX ... retrieve also the archived flag from featureRuns
#         # ... or set the archived Flag on FeatureResult _and_ featureRun 
#         #
#         if "feature_id" in kwargs:
#             # query feature_results for the id and order by date and result_id
#             feature_result = self.queryset.filter(feature_id=kwargs['feature_id']).order_by('-result_date', '-feature_result_id')
            
#             # Check on number of results and return data with success=false or results
#             if len(feature_result) > 0:
#                 logger.debug("Found "+str(len(feature_result))+" results")
#                 data["result"] = FeatureResultSerializer(feature_result,many=True).data
#             else:
#                 data['success'] = False
#                 data['error'] = "No feature_result found with id " + kwargs['feature_id']
#             return Response(data)

#         # check if feature_id in GET parameters
#         feature_id = request.GET.get('feature_id', False)
#         # get if user want only archived runs
#         archived = request.GET.get('archived', False) == 'true'
#         if feature_id and feature_id.isnumeric():
#             # get all the feature runs for specific run
#             feature_runs = Feature_Runs.available_objects.filter(feature=feature_id, archived=archived).order_by('-date_time', '-run_id')
#             # get the amount of data per page using the queryset
#             page = self.paginate_queryset(FeatureRunsSerializer.fast_loader(feature_runs))
#             # serialize the data
#             serialized_data = FeatureRunsSerializer(page, many=True).data
#             # return the data with count, next and previous pages.
#             return self.get_paginated_response(serialized_data)

#         return JsonResponse({'success': False, 'error': 'No feature_result_id nor feature_id specified...'}, status=400)



# FeatureResultByFeatureIdViewSet
# ... takes parameter FeatureId and returns all results for that ID from featureResults
# ... this enables showing all results without grouping them by featureRun
class FeatureResultByFeatureIdViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allow returns featureResults for a featureID.
    """
    queryset = Feature_result.available_objects.all()
    serializer_class = FeatureResultSerializer
    renderer_classes = (JSONRenderer, )
    filter_backends = (filters.OrderingFilter,)
    ordering_fields = ('result_date',)

    # @silk_profile(name="FeatureResultByFeatureId")
    def list(self, request, *args, **kwargs):
        # check if feature_id in GET parameters
        feature_id = request.GET.get('feature_id', False)
        # get if user want only archived runs
        archived = request.GET.get('archived', False) == 'true'
        if feature_id and feature_id.isnumeric():

            # get all the feature runs for specific run
            feature_result = self.queryset.filter(feature_id=feature_id, archived=archived).order_by('-result_date', '-feature_result_id')

            # get the amount of data per page using the queryset
            page = self.paginate_queryset(feature_result)
            serializer = self.get_serializer(page, many=True)
            # return the data with count, next and previous pages.
            return self.get_paginated_response(serializer.data)

        return JsonResponse({'success': False, 'error': 'No feature_result_id nor feature_id specified...'}, status=400)




class FeatureResultViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    queryset = Feature_result.available_objects.all()
    serializer_class = FeatureResultSerializer
    renderer_classes = (JSONRenderer, )
    filter_backends = (filters.OrderingFilter,)
    ordering_fields = ('result_date',)

    def patch(self, request, *args, **kwargs):
        # Primary option is from URL param
        feature_result_id = self.kwargs.get('feature_result_id', None)
        # Second option is from body Payload
        if 'feature_result_id' in request.data:
            feature_result_id = request.data['feature_result_id']
        if feature_result_id:
            data = request.data
            self.queryset.filter(feature_result_id=feature_result_id).update(**data)
            # Update total values of run
            try:
                run = self.queryset.get(feature_result_id=feature_result_id).feature_runs_set.first()
                calculate_run_totals(run)
            except Exception as err:
                logger.debug('Unable to find feature run for the feature result id:', str(feature_result_id))
                logger.error(str(err))
            if data.get('running', None) == False: # check if running is set to False from data not featureResult
                # get the feature_result
                fr = self.queryset.get(feature_result_id=feature_result_id)
                # get integrations if any
                integrations = Integration.objects.filter(department__department_id=fr.department_id, active=True)
                if data['success']: # get only the after_test_execution
                    integrations = integrations.filter(send_on__after_test_execution=True)
                else: # get after_test_execution and after_test_execution_failed
                    integrations = integrations.filter(Q(send_on__after_test_execution=True) | Q(send_on__after_test_execution_failed=True))
                # loop over all integrations
                for integration in integrations:
                    # get the application from integrations
                    application = integration.application
                    # get the payload for send_on__after_test_execution or send_on__after_test_execution_failed
                    try:
                        intPayload = IntegrationPayload.objects.filter(application=application).get(Q(send_on="after_test_execution") | Q(send_on="after_test_execution_failed"))
                    except IntegrationPayload.DoesNotExist as err:
                        capture_exception(err)
                        logger.error('Unable to retrieve payload for application %s' % str(application))
                        continue
                    # create the variables dict to later replace
                    variables = {
                        "feature_result_id": fr.feature_result_id,
                        "feature_id": fr.feature_id.feature_id,
                        "feature_name": fr.feature_id.feature_name,
                        "color": (3066993 if fr.success else 15158332) if intPayload.application == 'Discord' else ("#2ECC71" if fr.success else "#E74C3C"),
                        "feature_result_url": 'https://%s/#/%s/%s/%s/run/%s/step/%s' % (DOMAIN, fr.app_name, fr.environment_name, str(fr.feature_id.feature_id), str(fr.feature_runs_set.get().run_id), str(feature_result_id)),
                        "execution_time": Humanize(fr.execution_time),
                        "pixel_diff": fr.pixel_diff,
                        "total": fr.total,
                        "ok": fr.ok,
                        "fails": fr.fails,
                        "skipped": fr.skipped,
                        "username": fr.executed_by.name,
                        "browser_name": str(fr.browser.get('browser', "Browser name unkown")).capitalize(),
                        "browser_version": str(fr.browser.get('browser_version', 'Browser version unknown')).capitalize(),
                        "os_name": str(fr.browser.get('os', "O.S. name unknown")).capitalize(),
                        "os_version": str(fr.browser.get('os_version', "O.S. version unknown")).capitalize(),
                        "feature_description": fr.feature_id.description
                    }
                    # replace the variables
                    payload = json.loads(intPayload.replaceVariables(variables), strict=False)
                    response = requests.post(integration.hook, json=payload)
            return JsonResponse({'success': True}, status=202)
        return JsonResponse({'success': False, "error": 'No feature_result_id specified'}, status=406)

    @timediff
    def list(self, request, *args, **kwargs):

        data = {}

        if "feature_result_id" in kwargs:
            feature_result = self.queryset.filter(feature_result_id=kwargs['feature_result_id'])
            if len(feature_result) > 0:
                data["result"] = FeatureResultSerializer(feature_result[0]).data
            else:
                data['success'] = False
                data['error'] = "No feature_result found with id " + kwargs['feature_result_id']
            return Response(data)

        # check if feature_id in GET parameters
        feature_id = request.GET.get('feature_id', False)
        # get if user want only archived runs
        archived = request.GET.get('archived', False) == 'true'
        if feature_id and feature_id.isnumeric():
            # get all the feature runs for specific run
            feature_runs = Feature_Runs.available_objects.filter(feature=feature_id, archived=archived).order_by('-date_time', '-run_id')
            # get the amount of data per page using the queryset
            page = self.paginate_queryset(FeatureRunsSerializer.setup_eager_loading(feature_runs))
            # serialize the data
            serialized_data = FeatureRunsSerializer(page, many=True).data
            # return the data with count, next and previous pages.
            return self.get_paginated_response(serialized_data)

        return JsonResponse({'success': False, 'error': 'No feature_result_id nor feature_id specified...'}, status=400)

    @require_permissions("remove_feature_result")
    def delete(self, request, *args, **kwargs):
        # check if feature_result_id exists in payload else throw error
        if 'feature_result_id' not in kwargs:
            return JsonResponse({"success": False, "error": "Missing feature_result_id"})
        try:
            # get the feature_result object
            feature_result = self.queryset.filter(feature_result_id=kwargs['feature_result_id'])
            # check if exists
            if not feature_result.exists():
                return JsonResponse({'success': False, 'error': 'No feature_result found with id: %s' % str(kwargs['feature_result_id'])})
            # get the first element as save as feature_result
            feature_result = feature_result[0]
            # check if feature_result is marked as archived if so return error else keep going
            if feature_result.archived:
                return JsonResponse({'success': False, 'error': 'Feature result that you are trying to remove is marked as archived, please uncheck archived and try again.'})
            # get feature_runs object from the feature_result
            feature_run = feature_result.feature_runs_set.all()
            # check if feature_run exists
            if feature_run.exists():
                # set feature_run first object to feature_run
                feature_run = feature_run[0]
                # check if feature_run that contains this feature_result is not marked as archived
                if feature_run.archived:
                    return JsonResponse({'success': False, 'error': 'Feature run that contains this feature result is marked as archived. Unable to remove feature result.'})
                # if feature_results length in feature_run is lower or equal to 1 mean this is the only feature_result in the feature_run so we should remove it as well
                if len(feature_run.feature_results.all()) <= 1:
                    # delete the object if this feature_result is only one in feature_run
                    feature_run.delete()
            # finally delete the object from the database
            feature_result.delete()
            # return success response if all went OK
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

class StepResultViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    queryset = Step_result.objects.all().order_by('step_result_id')
    serializer_class = StepResultSerializer
    renderer_classes = (JSONRenderer, )

    def create(self, request, *args, **kwargs):
        # get data from request
        data = json.loads(request.body)
        if not isinstance(data['files'], list):
            data['files'] = json.loads(data['files'])
        step_result = Step_result.objects.create(**data)
        return JsonResponse(StepResultSerializer(step_result, many=False).data)

    def patch(self, request, *args, **kwargs):
        # Get StepResult ID from the passed URL
        step_result_id = self.kwargs.get('step_result_id', None)
        # Check StepResult parameter
        if step_result_id:
            data = request.data
            # Perform update of StepResult in database dynamicly with data passed from Front
            step_result = Step_result.objects.filter(step_result_id=step_result_id)
            if not step_result.exists():
                return JsonResponse({'success': False, 'error': 'Invalid step result id or not found'}, status=404)
            step_result.update(**data)
            # --------------------------
            # #3001 - Update parent featureResult status if there is at least 1 failed step in the step results array
            # featureRun is not necessary because is calculated in front based on featureResult
            # --------------------------
            # Get feature result id of patched step
            feature_result_id = step_result[0].feature_result_id
            # Get all step results in current feature result
            step_results = Step_result.objects.filter(feature_result_id=feature_result_id)
            # Filter successed steps
            failed_steps = [ step for step in step_results if (step.status and step.status == 'Failed') or (not step.status and not step.success) ]
            success = len(failed_steps) == 0
            # Update feature result
            self.queryset.filter(feature_result_id=feature_result_id).update(success=success)
            return JsonResponse({'success': True}, status=202)
        return JsonResponse({'success': False, 'error': 'No step_result_id specified'}, status=406)

    def list(self, request, *args, **kwargs):
        # get feature_result_id from the url if passed means
        # that user wants all the step_results related to the feature_result_id
        feature_result_id = self.kwargs.get('feature_result_id', None)
        if feature_result_id:
            # if feature_result_id was found in the url
            # find all the step_results related to specified feature_result
            queryset = Step_result.objects.filter(feature_result_id=feature_result_id).order_by('step_result_id')
            # get the amount of data per page using the queryset
            page = self.paginate_queryset(queryset)
            # serialize the data
            serializer = StepResultSerializer(page, many=True)
            # return the data with count, next and previous pages.
            return self.get_paginated_response(serializer.data)

        # get step_result_id from the url if passed means
        # that user wants to only see that particular step_result
        step_result_id = self.kwargs.get('step_result_id', None)
        if step_result_id:
            # if step_result_id was found in the url
            # find the step_result that related to specified step_result_id
            step_result = Step_result.objects.filter(step_result_id=step_result_id)
            # if specified step_result_id does not exists throw an error
            if not step_result.exists():
                return JsonResponse({"success": False, "error": "Unable to find step_result_id %s..." % (str(step_result_id))})
            # get the first index from the step_results found and save it as step_result
            step_result = step_result[0]
            # all screenshots related to step_result into queryset
            step_result.screenshots = Screenshots(step_result_id)
            # get all steps for specific feature_result and find next step_result and previous step_result
            steps = Step_result.objects.filter(feature_result_id=step_result.feature_result_id)
            # get the current step_result from the steps list
            current = list(steps).index(step_result)
            # try to get the previous step if it throws an error means there is an index issue and can't go back and should be set to None
            try:
                step_result.previous = steps[current-1].step_result_id
            except:
                step_result.previous = None
            # try to get the next step if it throws an error means there is an index issue and can't go forward and should be set to None
            try:
                step_result.next = steps[current+1].step_result_id
            except:
                step_result.next = None

            # finally build the response
            data = {
                "success": True,
                "results": StepResultRegularSerializer(step_result, many=False).data
            }
            # send the response to user.
            return Response(data)


class EnvironmentViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    queryset = Environment.objects.all()
    serializer_class = EnvironmentSerializer
    renderer_classes = (JSONRenderer, )

    def list(self, request, *args, **kwargs):
        return Response({
            'results': EnvironmentSerializer(Environment.objects.all(), many=True).data
        })

    @require_permissions("edit_environment")
    def patch(self, request, *args, **kwargs):
        environment_id = self.kwargs['environment_id']
        environment_name = self.kwargs['environment_name']
        environments = Environment.objects.filter(environment_id=environment_id)
        if not environments.exists():
            return JsonResponse({"success": False , "error": "Environment_id invalid or doesn't exist."}, status=400)
        environments.update(environment_name=environment_name)
        # send a websocket to front about the creation
        response = requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Environments] Update one',
            'environment': IEnvironment(environments[0], many=False).data
        })
        return JsonResponse({"success": True }, status=200)

    @require_permissions("delete_environment")
    def delete(self, request, *args, **kwargs):
        environment_id = self.kwargs['environment_id']
        environments = Environment.objects.filter(environment_id=environment_id)
        if not environments.exists():
            return JsonResponse({"success": False , "error": "Environment id invalid or doesn't exist."}, status=400)
        environments.delete()
        # send a websocket to front about the creation
        response = requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Environments] Remove Environment',
            'environment_id': environment_id
        })
        return JsonResponse({"success": True }, status=200)

class BrowserViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    queryset = Browser.objects.all()
    serializer_class = BrowserSerializer
    renderer_classes = (JSONRenderer, )

    def list(self, request, *args, **kwargs):

        browsers = Browser.objects.all()

        data = {
            "results": BrowserSerializer(browsers , many=True).data,
        }

        return JsonResponse(data['results'], safe=False)

    @require_permissions("delete_browser")
    def delete(self, request, *args, **kwargs):
        browser_id = self.kwargs['browser_id']
        browsers = Browser.objects.filter(browser_id=browser_id)
        if not browsers.exists():
            return JsonResponse({"success": False , "error": "Browser_id invalid or doesn't exist."}, status=400)
        browsers.delete()

        # send a websocket to front about the creation
        response = requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Browsers] Remove',
            'browser_id': browser_id
        })

        return JsonResponse({"success": True }, status=200)

class ApplicationViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    queryset = Application.objects.all()
    serializer_class = ApplicationSerializer
    renderer_classes = (JSONRenderer, )

    def list(self, request, *args, **kwargs):
        return Response({
            'results': ApplicationSerializer(Application.objects.all(), many=True).data
        })

    @require_permissions("edit_application")
    def patch(self, request, *args, **kwargs):
        app_id = self.kwargs['app_id']
        app_name = self.kwargs['app_name']
        apps = Application.objects.filter(app_id=app_id)
        if not apps.exists():
            return JsonResponse({"success": False , "error": "Application_id invalid or doesn't exist."}, status=400)
        apps.update(app_name=app_name)

        # send a websocket to front about the creation
        response = requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Applications] Modify Application',
            'app': IApplication(apps[0], many=False).data
        })

        return JsonResponse({"success": True }, status=200)

    @require_permissions("delete_application")
    def delete(self, request, *args, **kwargs):
        app_id = self.kwargs['app_id']
        apps = Application.objects.filter(app_id=app_id)
        if not apps.exists():
            return JsonResponse({"success": False , "error": "Application_id invalid or doesn't exist."}, status=400)
        apps.delete()

        # send a websocket to front about the creation
        response = requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Applications] Remove  Application',
            'app_id': app_id
        })

        return JsonResponse({"success": True }, status=200)

@csrf_exempt
@require_permissions("edit_department")
def UpdateStepTimeout(request, department_id, *args, **kwargs):

    def checkParameter(object, property, valueType):
        if property not in object:
            raise ValueError(f"Missing mandatory parameter '{property}' from the request body.")
        elif not isinstance(object[property], valueType):
            raise ValueError(f"'{property}' should be of type '{valueType.__name__}'.")

        return object[property]

    # get body from request
    body = json.loads(request.body)
    try:
        # check if there are required parameters
        step_timeout_from = checkParameter(body, 'step_timeout_from', int)
        step_timeout_to = checkParameter(body, 'step_timeout_to', int)
    except ValueError as err:
        return JsonResponse({
            'success': False,
            'error': str(err)
        }, status=400)
    
    try:
        # get department from the db
        department = Department.objects.get(pk=department_id)
        # get all the features related to the department
        features = Feature.objects.filter(department_id=department_id).values_list('feature_id', flat=True)
        # get all the steps in these features
        steps = Step.objects.filter(feature_id__in=features, timeout=step_timeout_from)
        # get total features that will be updated
        total_features_updated = len(steps.order_by('feature_id').distinct('feature_id').values_list('feature_id', flat=True))
        # update steps to their new timeout
        steps_updated = steps.update(timeout=step_timeout_to)
        return JsonResponse({
            "success": True,
            "total_features_updated": total_features_updated,
            "total_steps_updated": steps_updated
        })
    except Department.DoesNotExist:
        return JsonResponse({
            "success": False,
            "error": "Department does not exists."
        }, status=404)

class DepartmentViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    queryset = Department.objects.prefetch_related('files').all()
    serializer_class = DepartmentSerializer
    renderer_classes = (JSONRenderer, )

    def list(self, request, *args, **kwargs):
        # set default value for qs
        qs = Department.objects.none()
        # check if user is superuser
        superuser = request.session['user']['user_permissions']['permission_name'] == "SUPERUSER"
        # get show_all_departments permission
        show_all_departments = request.session['user']['user_permissions']['show_all_departments']
        # if superuser or has show_all_departments permission show all departments
        if superuser or show_all_departments:
            qs = Department.objects.prefetch_related(
                Prefetch('files', queryset=File.all_objects.all())
            ).all()
        else:
            # get logged in user departments
            user_departments = [x['department_id'] for x in request.session['user']['departments']]
            qs = Department.objects.prefetch_related(
                Prefetch('files', queryset=File.all_objects.all())
            ).filter(department_id__in=user_departments)
            
        # get show_department_users permission
        show_department_users = request.session['user']['user_permissions']['show_department_users']
        # if user has show_department_users permission the show users aswell
        if show_department_users:
            results = DepartmentWithUsersSerializer(qs, many=True).data
        else:
            results = DepartmentSerializer(qs, many=True).data
        # return results
        return Response({
            'results': results
        })

    @require_permissions("create_department")
    def create(self, request, *args, **kwards):
        # create a new department
        user = OIDCAccount.objects.filter(user_id=request.session['user']['user_id'])[0]
        data=json.loads(request.body)
        department_name = data['department_name']
        department = Department(department_name=department_name)
        department.save()
        account_role=Account_role(user=user, department=department)
        account_role.save()

        # send a websocket to front about the creation
        response = requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Departments] Add Admin Department',
            'department': DepartmentWithUsersSerializer(department, many=False).data
        })

        # update the user who has been added to the created department
        response = requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Accounts] Modify Account',
            'account': IAccount(user, many=False).data
        })

        return JsonResponse({"success": True, "department_id": department.department_id, "department_name": department_name }, status=200)

    @require_permissions("edit_department")
    def patch(self, request, *args, **kwargs):
        # get the department_id from the url GET parameters
        department_id = self.kwargs['department_id']
        # get data from request payload
        data = json.loads(request.body)
        # get the departments from database with specified id
        departments = Department.objects.filter(department_id=department_id)
        # check if department found from database exists
        if not departments.exists():
            return JsonResponse({"success": False , "error": "Department_id invalid or doesn't exist."}, status=400)
        # check if department_name is in payload and needs to be changed else do nothing
        if 'department_name' in data and data['department_name'] != departments[0].department_name:
            # check if exists more than one department with new name
            departmentsWithNewName = Department.objects.filter(department_name=data['department_name'])
            # check if exists departments with that name
            if departmentsWithNewName.exists():
                return JsonResponse({'success': False, 'error': 'Department with name "%s" already exists please try another name for the department.' % data['department_name']}, status=200)
            # get path of old department folder
            old_p = "/code/behave/department_data/" + departments[0].slug
            # check if path exists
            if os.path.exists(old_p):
                # rename department folder
                os.rename("/code/behave/department_data/%s" % departments[0].slug, "/code/behave/department_data/%s" % slugify(data['department_name']))
            else:
                # create incase it does not exists
                os.makedirs("/code/behave/department_data/%s" % slugify(data['department_name']), exist_ok=True)
        try:
            # update department with data recieved from payload
            departments.update(**data)
            # send a websocket to front about the creation
            response = requests.post('http://cometa_socket:3001/sendAction', json={
                'type': '[Departments] Update Department Info',
                'departmentId': department_id,
                'options': IDepartment(departments[0], many=False).data
            })
            # return OK if everything went OK
            return JsonResponse({"success": True }, status=200)
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    @require_permissions("delete_department")
    def delete(self, request, *args, **kwargs):
        department_id = self.kwargs['department_id']
        departments = Department.objects.filter(department_id=department_id)
        if not departments.exists():
            return JsonResponse({"success": False , "error": "Department_id invalid or doesn't exist."}, status=400)
        departments.delete()
        # send a websocket to front about the creation
        response = requests.post('http://cometa_socket:3001/sendAction', json={
            'type': '[Departments] Remove Admin Department',
            'department_id': department_id
        })
        return JsonResponse({"success": True }, status=200)

class FeatureViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    queryset = Feature.objects.all()
    serializer_class = FeatureSerializer
    renderer_classes = (JSONRenderer, )

    def list(self, request, *args, **kwargs):
        superuser = request.session['user']['user_permissions']['permission_name'] == "SUPERUSER"
        if superuser:
            queryset = Feature.objects.select_related('last_edited', 'created_by', 'info').prefetch_related('info__feature_results')
        else:
            departments = [x['department_id'] for x in request.session['user']['departments']]
            queryset = Feature.objects.select_related('last_edited', 'created_by', 'info').prefetch_related('info__feature_results').filter(department_id__in=departments)

        if 'feature_id' in kwargs:
            feature_id = kwargs['feature_id']
            queryset = queryset.get(feature_id=feature_id)
            data = {
                "results": [FeatureSerializer(queryset, many=False).data]
            }
            return Response(data)
        data = {
            "results": FeatureSerializer(FeatureSerializer.fast_loader(queryset), many=True).data
        }
        return Response(data)

    @require_permissions("create_feature")
    def create(self, request, *args, **kwargs):
        """
        Verify access to submitted browsers
        """
        try:
            subscriptions = get_subscriptions_from_request(request)
            check_browser_access(request.data['browsers'] or [], subscriptions)
        except Exception as err:
            return JsonResponse({ 'success': False, 'error': str(err) })

        """
        Create feature with POST data
        """
        newFeature = Feature(
            feature_name = request.data['feature_name'],
            app_id = request.data['app_id'],
            app_name = request.data['app_name'],
            description = request.data['description'],
            environment_id = request.data['environment_id'],
            environment_name = request.data['environment_name'],
            steps = len([x for x in request.data['steps']['steps_content'] if x['enabled'] == True]),
            # schedule = request.data['schedule'], # Handle it later, we need to validate it
            department_id = request.data['department_id'],
            department_name = request.data['department_name'],
            screenshot = "", # ! Deprecated: now each step has it's own screenshot value
            compare = "", # ! Deprecated: now each step has it's own compare value
            depends_on_others = False if 'depends_on_others' not in request.data else (False if request.data['depends_on_others'] == None else request.data['depends_on_others']),
            browsers = request.data['browsers'],
            cloud = request.data['cloud'],
            video = request.data['video'],
            continue_on_failure = request.data.get('continue_on_failure', False),
            last_edited_id = request.session['user']['user_id'],
            last_edited_date = datetime.datetime.utcnow(),
            created_by_id = request.session['user']['user_id']
        )

        """
        Save feature object into DB while also saving new steps
        """
        newFeature.save(steps=request.data['steps']['steps_content'])

        """
        Process schedule if requested
        """
        if 'schedule' in request.data:
            schedule = request.data['schedule']
            # Check if schedule is not 'now'
            if schedule != 'now':
                # Validate cron format before sending to Behave
                if schedule != "" and not CronSlices.is_valid(schedule):
                    return JsonResponse({ 'success': False, "error": 'Schedule format is invalid.' }, status=200)
                # Save schedule in Behave docker Crontab
                response = set_test_schedule(newFeature.feature_id, schedule, request.session['user']['user_id'])
                if response.status_code == 200:
                    # Update feature object with new schedule
                    newFeature.schedule = schedule
                else:
                    # Oops, something went wrong while saving schedule
                    json_data = response.json()
                    return JsonResponse({ 'success': False, "error": json_data.get('error', 'Something went wrong while saving schedule.') }, status=200)

        returnResult = Feature.objects.filter(feature_id=newFeature.feature_id) # FIXME: Why this line?
        return Response(FeatureSerializer(newFeature, many=False, context={"from": "folder"}).data, status=201)

    @require_permissions("edit_feature")
    def patch(self, request, *args, **kwargs):
        # This REST endpoint allows to edit feature by just sending
        # the feature id and a partial object definition of Feature
        # Get JSON payload
        data = json.loads(request.body)
        # Get feature id from body
        featureId = data.get('feature_id', 0)

        """
        Edit or Create Feature
        """
        if int(featureId) != 0:
            # Retrieve feature info by id
            features = Feature.objects.filter(feature_id=featureId)
            # Check if requested feature exists
            if not features.exists():
                return JsonResponse({"success": False, "error": "Feature not found"})
            feature = features[0]
            # Retrieve feature path details
            feature_dir = get_feature_path(featureId)
        else:
            # Create new feature
            feature = Feature()

        """
        Verify access to submitted browsers
        """
        try:
            subscriptions = get_subscriptions_from_request(request)
            check_browser_access(data.get('browsers', []), subscriptions)
        except Exception as err:
            return JsonResponse({ 'success': False, 'error': str(err) })

        """
        Merge fields of feature model with values from body payload
        """
        # Retrieve feature model fields
        fields = feature._meta.get_fields()
        # Make some exceptions
        exceptions = ['feature_id', 'schedule']
        # Iterate over each field of model
        for field in fields:
            # Check if the field exists in data payload
            if field.name in data and field.name not in exceptions:
                # Set value into model field with default to previous value
                setattr(feature, field.name, data.get(field.name, getattr(feature, field.name)))

        """
        Update last edited fields
        """
        feature.last_edited_id = request.session['user']['user_id']
        feature.last_edited_date = datetime.datetime.utcnow()

        """
        Save submitted feature steps
        """
        # Save feature into database
        if 'steps' in data and 'steps_content' in data.get('steps', {}):
            # Save with steps
            steps = data['steps']['steps_content'] or []
            feature.steps = len([x for x in steps if x['enabled'] == True])
            result = feature.save(steps=steps)
        else:
            # Save without steps
            result = feature.save()

        """
        Process schedule if requested
        """
        # Set schedule of feature if provided in data, if schedule is empty will be removed
        if 'schedule' in data:
            schedule = data['schedule']
            logger.debug("Saveing schedule: "+str(schedule) )
            # Check if schedule is not 'now'
            if schedule != 'now':
                # Validate cron format before sending to Behave
                if schedule != "" and not CronSlices.is_valid(schedule):
                    return JsonResponse({ 'success': False, "error": 'Schedule format is invalid.' }, status=200)
                # Save schedule in Behave docker Crontab
                response = set_test_schedule(feature.feature_id, schedule, request.session['user']['user_id'])
                if response.status_code != 200:
                    # Oops, something went wrong while saving schedule
                    logger.debug("Ooops - something went wrong saveing the schedule. You should probably check the crontab file mounted into docker to be a file and not a directory.")
                    json_data = response.json()
                    return JsonResponse({ 'success': False, "error": json_data.get('error', 'Something went wrong while saving schedule. Check crontab directory of docker.') }, status=200)
            # Save schedule, at this point is 100% valid and saved
            feature.schedule = schedule
            feature.save()

        """
        Send WebSockets
        """
        # Add the updated feature to the result if feature save was ok
        if result['success']:
            result['info'] = FeatureSerializer(feature, many=False).data
            requests.post('http://cometa_socket:3001/sendAction', json={
                'type': '[Features] Update feature offline',
                'feature': result['info'],
                'exclude': [request.session['user']['user_id']]
            })
            requests.post('http://cometa_socket:3001/sendAction', json={
                'type': '[Features] Get Folders',
                'exclude': [request.session['user']['user_id']]
            })

        # Spawn thread to send help email about 'Ask for help'
        t = Thread(target=SendHelpEmail, args=(request, feature, ))
        t.start()

        return JsonResponse(result, status=200)


    def run_test(self, json_path):
        post_data = { 'json_path': json_path }
        response = requests.post('http://behave:8001/run_test/', data=post_data)
        return response.status_code

    @require_permissions("delete_feature", feature_id="kwargs['feature_id']")
    def delete(self, request, *args, **kwargs):
        # get the feature id from the url GET parameters
        feature_id = self.kwargs['feature_id']
        # get the feature from the database
        features = Feature.objects.filter(feature_id=feature_id)
        # check if feature exists with id found in url
        if not features.exists():
            return JsonResponse({"success": False , "error": "Feature_id invalid or doesn't exist."}, status=400)
        # get the feature from the array
        feature = features[0]
        # find feature runs not marked as archive related to the feature
        feature_runs = feature.feature_runs.filter(archived=False)
        # loop over all the feature_runs found
        for feature_run in feature_runs:
            # remove all feature_results not marked as archived from the feature_run
            removeNotArchivedFeatureResults(feature_run, deleteTemplate=True)
            # check if feature_run contains any feature_results if so do not delete it else do so
            if len(feature_run.feature_results.all()) == 0:
                feature_run.delete()
        # remove feature steps
        Step.objects.filter(feature_id=feature_id).delete()
        # Delete files in disk (not backups!)
        featureFileName = get_feature_path(features[0])['fullPath']
        try:
            os.remove(featureFileName+'.feature')
            os.remove(featureFileName+'.json')
            os.remove(featureFileName+'_meta.json')
        except OSError:
            pass
        # Delete feature if feature_runs count is == 0 else don't since it contains archived data
        if len(feature.feature_runs.all()) == 0:
            feature.delete()
        else:
            return JsonResponse({'success': False, 'error': 'Feature is not fully deleted since it contains SAVED results, to remove it completely please remove SAVED runs and results.'})
        return JsonResponse({"success": True }, status=200)


class StepViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows users to be viewed or edited.
    """
    queryset = Step.objects.all()
    serializer_class = StepSerializer
    renderer_classes = (JSONRenderer, )

    def get_queryset(self):

        feature_id = self.kwargs['feature_id']
        queryset = Step.objects.filter(feature_id=feature_id)
        return queryset

class AccountRoleViewSet(viewsets.ModelViewSet):
    """
    API endpoint that allows account roles to be viewed
    """
    queryset = Account_role.objects.all()
    serializer_class = AccountRoleSerializer
    renderer_classes = (JSONRenderer, )

def render_to_pdf(template_src, context_dict={}):
    template = get_template(template_src)
    html  = template.render(context_dict)
    result = BytesIO()
    pdf = pisa.pisaDocument(BytesIO(html.encode("UTF-16")), result)
    if not pdf.err:
        return HttpResponse(result.getvalue(), content_type='application/pdf')
    return None

class FolderViewset(viewsets.ModelViewSet):

    queryset = Folder.objects.all()
    serializer_class = FolderSerializer
    renderer_classes = (JSONRenderer, )

    '''
    Function find_in_dict
        Finds key with specified value inside dictionaries

    Parameters:
        @objects    Dictionaries on which @key, @value pair are searched
        @key        Key name that will be searched in @objects
        @value      If @key name is found then match the value.

    Return:
        @result     Dict that contains the @key, @value pair.
    '''
    def find_in_dict(self, objects, key, value):
        for obj in objects.values() if isinstance(objects, dict) else objects:
            if obj[key] == value: return obj
            result = self.find_in_dict(obj['folders'], key, value)
            if result is not None:
                return result
    
    def find_in_dict_for_tree(self, objects, key, value):
        for obj in objects.values() if isinstance(objects, dict) else objects:
            if obj['type'] != 'folder': continue
            if obj[key] == value: return obj
            result = self.find_in_dict_for_tree(obj['children'], key, value)
            if result is not None:
                return result

    def serializeResultsFromRawQueryForTree(self, departments, max_lvl):
        logger.debug("Preparing query for recursive folder, feature lookup for tree visualisation.")
        query = """
            WITH RECURSIVE recursive_folders AS (
                SELECT bf.*, 1 AS LVL
                FROM backend_folder bf
                WHERE bf.parent_id_id is null

                UNION

                SELECT bf.*, rf.LVL + 1
                FROM backend_folder bf

                    JOIN recursive_folders rf ON bf.parent_id_id = rf.folder_id and rf.LVL < %s
            )
            SELECT rf.*, bf.feature_id, bf.feature_name, bd.department_id as d_id, bd.department_name
            FROM (recursive_folders rf
                LEFT JOIN backend_folder_feature bff
                    ON rf.folder_id = bff.folder_id)
                FULL OUTER JOIN backend_feature bf
                    ON bf.feature_id = bff.feature_id
                JOIN backend_department bd
                    ON bf.department_id = bd.department_id or rf.department_id = bd.department_id
            WHERE
                (
                        ( rf.department_id IN %s and ( bf.department_id IN %s or bf.department_id is null) )
                or
                    ( rf.department_id is null and bf.department_id IN %s )
                ) 
            ORDER BY bd.department_name, bf.depends_on_others, bf.feature_name
        """

        # make a raw query to folders table
        results = Folder.objects.raw(query, [max_lvl, departments, departments, departments])
        objectsCreated = {
            "departments": {},
            "folders": {}
        }

        # loop over table formatted data
        for result in results:
            # if folder does not already exist in folders variable add a new folder
            if result.d_id not in objectsCreated["departments"]:
                objectsCreated["departments"][result.d_id] = {
                    'id': result.d_id,
                    'name': result.department_name,
                    'type': 'department',
                    'children': [
                        {
                            "name": "Variables",
                            "type": "variables",
                            "children": VariablesTreeSerializer(Variable.objects.filter(department_id=result.d_id), many=True).data
                        }
                    ]
                }
            if result.folder_id is not None and result.folder_id not in objectsCreated["folders"]:
                objectsCreated["folders"][result.folder_id] = {
                    'id': result.folder_id,
                    'parent_id': result.parent_id_id,
                    'department': result.d_id,
                    'name': result.name,
                    'type': 'folder',
                    'children': []
                }
            # if feature_id exists that means feature belongs to folder_id
            if result.feature_id is not None:
                feature_object = FeatureHasSubFeatureSerializer(Feature.objects.get(feature_id=result.feature_id), many=False).data
                if result.folder_id is not None:
                    objectsCreated["folders"][result.folder_id]['children'].append(feature_object)
                else:
                    objectsCreated['departments'][result.d_id]['children'].append(feature_object)
        
        # loop over all the folders with parent_id not None
        not_none_folders = [v for k, v in objectsCreated["folders"].items() if v['parent_id'] is not None]
        for folder in not_none_folders:
            obj = self.find_in_dict_for_tree(objectsCreated["folders"], 'id', folder['parent_id'])
            if obj is not None:
                obj['children'].append(folder)
                del objectsCreated["folders"][folder['id']]

        # add all top level folders to the department childrens
        folders = [v for k, v in objectsCreated["folders"].items() if v['parent_id'] is None]
        for folder in folders:
            objectsCreated['departments'][folder['department']]['children'].append(folder)
            del objectsCreated["folders"][folder['id']]
        
        logger.debug("Finished recursive lookup")

        return {
            "name": "Home",
            "type": "home",
            "children": objectsCreated['departments'].values()
        }

    '''
    Function serializeResultsFromRawQuery
        Turns results in table form to JSON form.

    Parameters:
        @results    Table formatted data

    Return:
        @folders    JSON formatted data
    '''
    def serializeResultsFromRawQuery(self, results):
        # save all the folders in this variable
        folders = {}
        # loop over table formatted data
        for result in results:
            # if folder does not already exist in folders variable add a new folder
            if result.folder_id not in folders:
                folders[result.folder_id] = {
                    'folder_id': result.folder_id,
                    'name': result.name,
                    'owner': result.owner_id,
                    'department': result.department_id,
                    'parent_id': result.parent_id_id,
                    'created_on': result.created_on,
                    'features': [],
                    'folders': []
                }
            # if feature_id exists that means feature belongs to folder_id
            if result.feature_id is not None:
                folders[result.folder_id]['features'].append(result.feature_id)
        # loop over all the folders with parent_id not None
        not_none_folders = [v for k, v in folders.items() if v['parent_id'] is not None]
        for folder in not_none_folders:
            obj = self.find_in_dict(folders, 'folder_id', folder['parent_id'])
            if obj is not None:
                obj['folders'].append(folder)
                del folders[folder['folder_id']]

        return folders

    @require_permissions("create_folder")
    def create(self, request, *args, **kwargs):
        data = request.data
        payload = {
            "name": data.get("name"),
            "owner_id": request.session['user']['user_id'],
            "department_id": data.get('department', None)
        }
        if 'parent_id' in data:
            if data.get('parent_id') != 0:
                try:
                    folder = Folder.objects.get(folder_id=int(data.get('parent_id')))
                    payload['parent_id'] = folder
                    payload['department_id'] = folder.department.department_id
                except Exception as err:
                    print("Failed to get the folder....")
        try:
            Folder.objects.create(**payload)
            requests.post('http://cometa_socket:3001/updatedObjects/folders')
            return Response({"success": True})
        except Exception as err:
            return Response({"success": False, "error": str(err)})

    def list(self, request, *args, **kwargs):

        # final object that will contain all the folders and feature without parents
        final_dict = {}

        # get folder_id from the GET parameters
        if 'folder_id' in kwargs:
            folder_id = kwargs['folder_id']
            return Response(FolderSerializer(Folder.objects.filter(folder_id=folder_id), many=True).data)

        # get the departments from the session user
        departments = tuple([x['department_id'] for x in request.session['user']['departments']])
        logger.debug("Departments for FolderViewset %s", departments )
        logger.debug("User object %s", request.session['user'])
        logger.debug("UserID: %s", request.session['user']['user_id'])

        # return empty array if user does not belong to any department
        if len(departments) == 0:
            return Response({
                "folders": [],
                "features": []
            })
        
        if request.query_params.get('tree') is not None:
            return Response(self.serializeResultsFromRawQueryForTree(departments, MAX_FOLDER_HIERARCHY))

        # this query does not take into account that user has selected departments in account_role table
        # query = '''
        # WITH RECURSIVE recursive_folders AS (
        #     SELECT bf.*, 1 AS LVL
        #     FROM backend_folder bf
        #     WHERE bf.parent_id_id is null

        #     UNION

        #     SELECT bf.*, rf.LVL + 1
        #     FROM backend_folder bf JOIN recursive_folders rf ON bf.parent_id_id = rf.folder_id and rf.LVL < %s
        # )
        # SELECT rf.*, bf.feature_id
        # FROM (recursive_folders rf
        #     LEFT JOIN backend_folder_feature bff
        #         ON rf.folder_id = bff.folder_id)
        #     FULL OUTER JOIN backend_feature bf
        #         ON bf.feature_id = bff.feature_id
        # WHERE
        #     rf.department_id IN %s
        # OR
        #     bf.department_id IN %s
        # ORDER BY rf.folder_id;
        # '''


        #
        # give me all folders and features inside recursively in a flat table from my selected departments,
        # so folder department must match and feature deparment must match
        # folder_id |       name       | owner_id | parent_id_id | department_id |          created_on           | lvl | feature_id | userid
        # ----------+------------------+----------+--------------+---------------+-------------------------------+-----+------------+--------
        #        83 | MIX              |        2 |              |             2 | 2021-09-09 22:28:01.274756+00 |   1 |         38 |    320
        #        83 | MIX              |        2 |              |             2 | 2021-09-09 22:28:01.274756+00 |   1 |         31 |    320

        # Testcases:
        # I have access to department number 2.
        # 1. There is a folder with department number 2 and inside are two features belonging to department number 2 and 3. I will see the folder and one feature.
        # 2. There is a folder with department number 3 and inside are two features belonging to department number 2 and 3. I will not see the folder. I will not see the features.
        # 3. Moving a new feature only gives me access to department 2

        # I change my access to department number 2 + 3
        # in case 1: I can see both features.
        # in case 2: I can see the folder and both features.
        # in case 3: I can move features between departments.

        query = '''
            WITH RECURSIVE recursive_folders AS (
                        SELECT bf.*, 1 AS LVL
                        FROM backend_folder bf
                        WHERE bf.parent_id_id is null

                        UNION

                        SELECT bf.*, rf.LVL + 1
                        FROM backend_folder bf

                            JOIN recursive_folders rf ON bf.parent_id_id = rf.folder_id and rf.LVL < %s
                    )
                    SELECT rf.*, bf.feature_id
                    FROM (recursive_folders rf
                        LEFT JOIN backend_folder_feature bff
                            ON rf.folder_id = bff.folder_id)
                        FULL OUTER JOIN backend_feature bf
                            ON bf.feature_id = bff.feature_id
                    WHERE
                            ( rf.department_id IN %s and ( bf.department_id IN %s or bf.department_id is null) )
                        or
                            ( rf.department_id is null and bf.department_id IN %s )
                    ORDER BY rf.folder_id
        '''


        # make a raw query to folders table
        results = Folder.objects.raw(query, [MAX_FOLDER_HIERARCHY, departments, departments, departments])
        logger.debug("Query: %s" % results)
        # serialize raw data to JSON
        folders = self.serializeResultsFromRawQuery(results)
        logger.debug("Folders: %s" % folders)

        # add features with parent none to final_dict.features
        if None in folders:
            final_dict['features'] = folders[None]['features']
            del folders[None]
        else:
            final_dict['features'] = []
        # add all folders to final object
        final_dict['folders'] = list(folders.values())

        # return results
        return Response(final_dict)

        ''' # get all features related to the user departments
        features = Feature.objects.filter(department_id__in=departments)
        # get all feature ids
        feature_ids = [x.feature_id for x in features]
        # get all user folders
        folder_ids = Folder.objects.filter(department__in=departments).values_list("folder_id")
        # get all the features inside the user folders
        folder_feature = Folder_Feature.objects.filter(folder__in=folder_ids)
        # get all the feature ids from the folders if feature id is in feature ids list
        folder_feature_ids = [x.feature.feature_id for x in folder_feature if x.feature.feature_id in feature_ids]
        # remove all the features that are inside folders
        features = [x for x in feature_ids if x not in folder_feature_ids]
        # get all the folders that will be shown in the home page
        mainFolders = Folder.objects.filter(parent_id=None, department__in=departments).order_by('name')
        data = {
            "folders": FolderSerializer(mainFolders, many=True, context={"features_list": feature_ids}).data,
            "features": features
        }

        return Response(data) '''

    def patch(self, request, *args, **kwargs):
        logger.debug('Sending webSockets')
        if 'folder_id' in request.data:
            folder_id = request.data['folder_id']
            try:
                folder = Folder.objects.get(folder_id=folder_id)
                if 'name' in request.data:
                    folder.name = request.data['name']

                if 'parent_id' in request.data:
                    folder.parent_id_id = request.data['parent_id']

                if 'department' in request.data:
                    folder.department_id = request.data['department']

                folder.save()

                requests.post('http://cometa_socket:3001/updatedObjects/folders')
                requests.post('http://cometa_socket:3001/sendAction', json={
                    'type': '[Features] Folder got renamed',
                    'folder': FolderSerializer(folder, many=False).data,
                    'exclude': [request.session['user']['user_id']]
                })
            except Exception as err:
                return JsonResponse({"success": False, "error": str(err) }, status=200)
        return JsonResponse({"success": True }, status=200)


    @require_permissions("delete_folder", folder_id="kwargs['folder_id']")
    def destroy(self, request, *args, **kwargs):
        if 'folder_id' in kwargs:
            folder_id = kwargs['folder_id']
            try:
                folder = Folder.objects.get(folder_id=folder_id)
            except Folder.DoesNotExist:
                return JsonResponse({"success": False, "error": "No folder with folder_id: " + str(folder_id) }, status=200)
            department_id = folder.department.department_id
            if folder.delete():
                requests.post('http://cometa_socket:3001/updatedObjects/folders')
                requests.post('http://cometa_socket:3001/sendAction', json={
                    'type': '[Features] Folder got removed',
                    'folder_id': int(folder_id),
                    'department_id': int(department_id)
                })
                return JsonResponse({"success": True }, status=200)
            else:
                return JsonResponse({"success": False, "error": "An error occurred while deleting folder with id: " + str(folder_id) }, status=200)
        else:
            return JsonResponse({"success": False, "error": "missing folder_id" }, status=200)

class FolderFeatureViewset(viewsets.ModelViewSet):

    queryset = Folder_Feature.objects.all()
    serializer_class = Folder_FeatureSerializer
    renderer_classes = (JSONRenderer, )

    def patch(self, request, *args, **kwargs):
        old_folder = request.data['old_folder'] if 'old_folder' in request.data else None
        new_folder = request.data['new_folder'] if 'new_folder' in request.data else None
        feature = int(request.data['feature_id']) if 'feature_id' in request.data else None
        department_id = request.data.get('department_id', None)

        user = request.session['user']
        user_deps = [x['department_id'] for x in user['departments']]

        feat = Feature.objects.filter(feature_id=feature)
        if not feat.exists():
            error = "Feature with id %d does not exists." % (feature)
            return JsonResponse({"success": False , "error": error}, status=400)

        feat = feat[0]

        if feat.department_id not in user_deps:
            error = "You are not allowed to see this feature, since you don't belong in this feature departments."
            return JsonResponse({"success": False , "error": error}, status=400)

        # Check if the front is sending the department id, meaning that the testcase will be moved to another department
        if department_id is not None :
            # Check if the user has access to the destination department
            if department_id not in user_deps:
                error = "You don't have access to the specified department."
                return JsonResponse({"success": False , "error": error}, status=403)
            try:
                # Get the list of departments
                department = Department.objects.get(department_id=department_id)
                # Change the department id and name
                feat.department_id = department.department_id
                feat.department_name = department.department_name
                # Get the testcase's steps
                steps = Step.objects.filter(feature_id=feat.feature_id).order_by('id').values()
                # Update the testcase
                feat.save(steps=list(steps))
            except Exception as er:
                # Return an error if the previous fails
                return JsonResponse({"success": False , "error": str(er)}, status=404)
            # Send testcase websockets
            requests.post('http://cometa_socket:3001/sendAction', json={
                'type': '[Features] Update feature offline',
                'feature': FeatureSerializer(feat, many=False).data,
                'exclude': [request.session['user']['user_id']]
            })
        # if new_folder is None that means we need to delete instance

        if new_folder is not None:
            newFolder = Folder.objects.filter(folder_id=new_folder) if str(new_folder).isnumeric() else Folder.objects.filter(name=new_folder)
            if not newFolder.exists():
                error = "No folder found with id or name %s...." % str(new_folder)
                return JsonResponse({"success": False , "error": error}, status=400)
            newFolder = newFolder[0]

        Folder_Feature.objects.filter(feature=feat).delete()

        if new_folder is not None:
            obj = Folder_Feature(folder=newFolder, feature=feat)
            obj.save()

        # update websockets
        requests.post('http://cometa_socket:3001/updatedObjects/folders')

        return JsonResponse({"success": True}, status=200)

def getLog(request, feature_result_id):
    fr = Feature_result.objects.filter(feature_result_id=feature_result_id)
    if len(fr) > 0:
        return JsonResponse({"success": True , "log": fr[0].log}, status=200)
    else:
        return JsonResponse({"success": False , "error": "No feature_result found with id " + feature_result_id}, status=200)

# --------------
# Retrieves the HTML Diff file for a given Step Result ID
# --------------
def getHtmlDiff(request, step_result_id):
    # CD into htmls folder
    os.chdir('/code/behave/html/')
    try:
        # Search for the request step result html diff
        htmlDiffFile = glob.glob(SCREENSHOT_PREFIX + step_result_id + '_diff.html')[0]
        # Open Diff file
        with open(htmlDiffFile, 'r') as htmlFile:
            return JsonResponse({
                "success": True,
                "diff": htmlFile.read()
            })
    except:
        # Error handling
        return JsonResponse({
            "success": False ,
            "error": "No html difference found with step result id " + step_result_id
        }, status=200)

@csrf_exempt
def UpdateTask(request):
    data = json.loads(request.body)
    action = data['action']
    browser = data['browser']
    feature_id = data['feature_id']
    pid = data['pid']
    # The action can be 'start' or 'finish' only
    if action == 'start':
        Feature_Task.objects.create(
            feature_id = feature_id,
            browser = browser,
            pid = pid
        )
    else:
        tasks = Feature_Task.objects.filter(pid = pid).delete()
    return JsonResponse({"success": True})

@csrf_exempt
def KillTask(request, feature_id):
    tasks = Feature_Task.objects.filter(feature_id = feature_id)
    for task in tasks:
        request = requests.get('http://behave:8001/kill_task/' + str(task.pid) + "/")
        Feature_Task.objects.filter(pid=task.pid).delete()
    if len(tasks) > 0:
        # Force state of stopped for current feature in WebSocket Server
        request = requests.get('http://cometa_socket:3001/feature/%s/killed' % feature_id)
    return JsonResponse({"success": True, "tasks": len(tasks)}, status=200)

@csrf_exempt
def KillTaskPID(request, pid):
    tasks = Feature_Task.objects.filter(pid = pid)
    for task in tasks:
        request = requests.get('http://behave:8001/kill_task/' + str(task.pid) + "/")
        Feature_Task.objects.filter(pid=task.pid).delete()
    return JsonResponse({"success": True, "tasks": len(tasks)}, status=200)

@csrf_exempt
def GetJsonFile(request, feature_id):
    feature = Feature.objects.get(feature_id=feature_id)
    jsonFile = get_feature_path(feature)['fullPath']+'.json'
    f = open(jsonFile, "r")
    content = json.loads(f.read())
    return JsonResponse(content, status=200, safe=False)

@csrf_exempt
def Encrypt(request):
    data = json.loads(request.body.decode('utf-8'))
    action = data['action']
    text = data['text']
    if action == 'encrypt':
        result = encrypt(text)
    else:
        result = decrypt(text)
    return JsonResponse({ 'result': result }, status=200)

class VariablesViewSet(viewsets.ModelViewSet):

    queryset = Variable.objects.all()
    serializer_class = VariablesSerializer
    renderer_classes = (JSONRenderer, )

    def list(self, request, *args, **kwargs):
        user_departments = GetUserDepartments(request)
        result = Variable.objects.filter(department__department_id__in=user_departments)
        data = VariablesSerializer(VariablesSerializer.fast_loader(result), many=True).data
        return JsonResponse(data, safe=False)

    def validator(self, data, key, obj=None):
        logger.debug("-------------------------------------------------")
        logger.debug("Checking key: %s " % key)
        if key not in data:
            raise Exception(f"{key} is required.")

        value = data[key]
        if obj is not None:
            # try to validate for the rest
            try:
                # on feature we except null values
                if key == 'feature' and value is None:
                    logger.debug("Found value=null for FeatureID, which is ok for new variables.")
                else:
                    value = obj.objects.get(pk=data[key])
                    logger.debug("Found value: %s " % value)
            except:
                raise Exception(f"{key} does not exists.")
        logger.debug("Using value: %s " % value)
        return value

    def optionalValidator(self, data, key, default):
        return data.get(key, default)
    
    def optionalValidatorWithObject(self, data, key, default, obj=None):
        value = data.get(key, default)
        if obj is not None and isinstance(value, int):
            try:
                return obj.objects.get(pk=value)
            except:
                raise Exception(f"{key} does not exists.")
        return value
        

    @require_permissions("create_variable")
    def create(self, request, *args, **kwargs):
        data = json.loads(request.body)
        logger.debug("=================================================")
        logger.debug("Received request to save variables.")
        logger.debug("=================================================")
        logger.debug("Will try validating the data: %s" % data)
        try:
            valid_data = {
                "department": self.validator(data, 'department', Department),
                "environment": self.validator(data, 'environment', Environment),
                "feature": self.validator(data, 'feature', Feature),
                "variable_name": self.validator(data, 'variable_name'),
                "variable_value": self.validator(data, 'variable_value'),
                "encrypted": self.optionalValidator(data, 'encrypted', False),
                "based": self.optionalValidator(data, 'based', 'feature'),
                "created_by": self.optionalValidatorWithObject(data, 'created_by', request.session['user']['user_id'], OIDCAccount),
                "updated_by": self.optionalValidatorWithObject(data, 'updated_by', request.session['user']['user_id'], OIDCAccount)
            }
            # encrypt the value if needed
            if valid_data['encrypted'] and not valid_data['variable_value'].startswith(ENCRYPTION_START):
                valid_data['variable_value'] = encrypt(valid_data['variable_value'])
            # check if feature belongs to the department, only if feature is not null 
            if valid_data['feature'] is not None and valid_data['feature'].department_id != None and valid_data['feature'].department_id != valid_data['department'].department_id:
                raise Exception(f"Feature does not belong the same department id, please check.")
            logger.debug("Validation done. I think, we should validate that variable name is unique in relation to department or environment or feature ... FIXME??")
        except Exception as err:
            logger.debug("Exception while creating variable: %s" % err)
            return JsonResponse({
                'success': False,
                'error': str(err)
            }, status=400)

        logger.debug("Will try creating the variable with data: %s" % valid_data)
        try:
            # create the new variable
            variable = Variable.objects.create(**valid_data)
            logger.debug("Data has been saved to database.")
            logger.debug("=================================================")
        except IntegrityError as err:
            logger.error("IntegrityError occured ... unique variable already exists.")
            logger.exception(err)
            return JsonResponse({
                'success': False,
                'error': 'Variable already exists with specified requirements, please update the variable.'
            }, status=400)
        return JsonResponse({
            "success": True,
            "data": VariablesSerializer(variable, many=False).data
        }, status=201)
    
    @require_permissions("edit_variable")
    def patch(self, request, *args, **kwargs):
        data = json.loads(request.body)
        try:
            # get the variable
            variable = self.validator(kwargs, 'id', Variable)
            variable.department = self.optionalValidatorWithObject(data, 'department', variable.department, Department)
            variable.environment = self.optionalValidatorWithObject(data, 'environment', variable.environment, Environment)
            variable.feature =  self.optionalValidatorWithObject(data, 'feature', variable.feature, Feature)
            variable.variable_name = self.optionalValidator(data, 'variable_name', variable.variable_name)
            variable.variable_value = self.optionalValidator(data, 'variable_value', variable.variable_value)
            variable.encrypted = self.optionalValidator(data, 'encrypted', variable.encrypted)
            variable.based = self.optionalValidator(data, 'based', variable.based)
            variable.updated_by = self.optionalValidatorWithObject(data, 'updated_by', request.session['user']['user_id'], OIDCAccount)
            # encrypt the value if needed
            if variable.encrypted and not variable.variable_value.startswith(ENCRYPTION_START):
                variable.variable_value = encrypt(variable.variable_value)

            # check if feature belongs to the department
            # commented for now
            # this condition raises exception if variable.feature coming from front is null, which prevents user from patching old variables
            # if variable.feature.department_id != variable.department.department_id:
            #    raise Exception(f"Feature does not belong the same department id, please check.")
            variable.save()
        except Exception as err:
            return JsonResponse({
                'success': False,
                'error': str(err)
            }, status=400)
        return JsonResponse({
            "success": True,
            "data": VariablesSerializer(variable, many=False).data
        }, status=200)

    @require_permissions("delete_variable")
    def delete(self, request, *args, **kwargs):
        try:
            # get the variable
            variable = self.validator(kwargs, 'id', Variable)
            variable.delete()
        except Exception as err:
            return JsonResponse({
                'success': False,
                'error': str(err)
            }, status=400)
        return JsonResponse({
            "success": True
        }, status=200)

class FeatureRunViewSet(viewsets.ModelViewSet):

    queryset = Feature_Runs.available_objects.all()
    serializer_class = FeatureRunsSerializer
    renderer_classes = (JSONRenderer, )

    def patch(self, request, *args, **kwargs):
        # get request payload
        data = json.loads(request.body)
        # check if run_id exists in payload else throw error
        if 'run_id' not in kwargs:
            return JsonResponse({"success": False, "error": "Missing run_id"})
        # pop feautre_results field to avoid any errors
        data.pop('feature_results', None)
        try:
            # update data with object recieved as payload
            self.queryset.filter(run_id=kwargs['run_id']).update(**data)
            # return success response if all went OK
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    @require_permissions("remove_feature_runs")
    def delete(self, request, *args, **kwargs):
        # get deleteTemplate from get parameters
        deleteTemplate = request.GET.get('delete_template', False)

        # check if client sent a run_id
        if kwargs.get('run_id', False):
            # get the object from the model
            feature_run = self.queryset.filter(run_id=kwargs['run_id'], archived=False)
            # check if there are any runs with the conditions marked
            if not feature_run.exists():
                return JsonResponse({'success': False, 'error': 'No feature runs found with id %s or it is marked as "Saved".'})
            # get the run from the array of runs
            feature_run = feature_run[0]
            # check if run is marked as archived
            if feature_run.archived:
                return JsonResponse({'success': False, 'error': 'Feature run is marked as archived, please uncheck the archived checkbox and try again.'})
            # remove feature_results not marked as archived
            removeNotArchivedFeatureResults(feature_run, deleteTemplate=deleteTemplate)
            # check if there are any results left in the run if so don't delete the run
            if len(feature_run.feature_results.all()) != 0:
                return JsonResponse({'success': False, 'error': 'Unable to remove some feature results since they are marked as SAVED.'})
            # remove the feature run if results in run are 0
            feature_run.delete(deleteTemplate=deleteTemplate)
        elif request.GET.get('type', False): # check if client wants to delete bunch of runs
            # get type to later switch case over it
            deleteType = request.GET.get('type')
            # get the feature_id from which we'll be getting the runs.
            feature_id = request.GET.get('feature_id', False)
            # check if feature_id is passed
            if not feature_id:
                return JsonResponse({'success': False, 'error': 'Missing feature_id with type parameter.'})
            # get all feature runs for feature_id
            feature_runs = self.queryset.filter(archived=False, feature_id=feature_id).order_by('-date_time')
            # switch case over type
            if deleteType == "all":
                pass # pass because there is no need to filter over feature_runs since it contains all the runs that we want to delete
            elif deleteType == 'all_failed':
                feature_runs = feature_runs.filter(Q(status='Failed') | Q(feature_results__fails__gt=0) | Q(feature_results__success=False))
            elif deleteType == 'all_except_last':
                feature_runs = feature_runs[1:]
            else:
                return JsonResponse({'success': False, 'error': 'Unknow type, please send one of next types: all, all_failed, all_except_last'})

            # loop over all feature_runs and delete them one by one
            for feature_run in feature_runs:
                # remove feature_results not marked as archived
                removeNotArchivedFeatureResults(feature_run, deleteTemplate=deleteTemplate)
                # check if all results where removed else keep the run, main reason being results are archived
                if len(feature_run.feature_results.all()) == 0:
                    feature_run.delete(deleteTemplate=deleteTemplate)
        else: # throw error because unable to find run_id or type
            return JsonResponse({'success': False, 'error': 'Unable to find run_id or type.'})

        # return success response if all went OK
        return JsonResponse({"success": True})

class AuthenticationProviderViewSet(viewsets.ModelViewSet):

    queryset = AuthenticationProvider.objects.filter(active=True)
    serializer_class = AuthenticationProviderSerializer
    renderer_classes = (JSONRenderer, )

class ScheduleViewSet(viewsets.ModelViewSet):

    queryset = Schedule.objects.none()
    serializer_class = ScheduleSerializer
    renderer_classes = (JSONRenderer, )

    def create(self, request, *args, **kwargs):
        # get request payload
        data = json.loads(request.body)
        # get the feature
        feature = Feature.objects.filter(feature_name=data['feature'])
        if not feature.exists():
            return JsonResponse({"success": False, "error": "No feature found with specified name."})
        data['feature'] = feature[0]
        # check if id exists in payload else throw error
        try:
            # update data with object recieved as payload
            Schedule.objects.create(**data)
            # return success response if all went OK
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    def patch(self, request, *args, **kwargs):
        # get request payload
        data = json.loads(request.body)
        # check if id exists in payload else throw error
        if 'id' not in kwargs:
            return JsonResponse({"success": False, "error": "Missing id"}, status=404)
        try:
            # update data with object recieved as payload
            Schedule.objects.filter(id=kwargs['id']).update(**data)
            # return success response if all went OK
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)})

    def delete(self, request, *args, **kwargs):
        # get request payload
        data = json.loads(request.body)
        # check if id exists in payload else throw error
        if 'id' not in data:
            return JsonResponse({"success": False, "error": "Missing id"}, status=404)
        try:
            # update data with object recieved as payload
            Schedule.objects.get(id=data['id']).delete()
            # return success response if all went OK
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'success': False, 'error': str(e)}, status=404)

def sendInvite(request, receiver, departments, code, customText):
    try:
        # generate email subject
        email_subject = '[COMETA][Invitation] %s invited you' % (request.session['user']['name'])
        # Decorate custom text
        if customText:
            customText = """
                <br>Custom message: %s<br>
            """ % customText
        # generate email body
        email_body = """
        <html>
            <head>
                <style>
                    .inner {
                        box-shadow: 0 3px 1px -2px rgb(0 0 0 / 20%%), 0 2px 2px 0 rgb(0 0 0 / 14%%), 0 1px 5px 0 rgb(0 0 0 / 12%%);
                        display: block;
                        border-radius: 3px;
                        padding: 20px;
                        background-color: white;
                    }
                </style>
            </head>
            <body style="margin: 0; padding: 0">
                <div style="display: block; margin: 0 auto; padding: 35px; background-color: #F6F6F6;">
                    <div style="display: block; border-radius: 3px; padding: 20px; background-color: white;box-shadow: 0 3px 1px -2px rgb(0 0 0 / 20%%), 0 2px 2px 0 rgb(0 0 0 / 14%%), 0 1px 5px 0 rgb(0 0 0 / 12%%);">
                        Dear User,<br><br>

                        %s has invited you to join these department(s): %s.<br><br>

                        <a href="https://%s/?invite=%s" style="padding:8px 12px; background-color:#1565C0; border-radius:3px; font-size:14px; color:#ffffff; text-decoration:none; font-weight:bold; display:inline-block;">
                            Join cometa
                        </a>
                        <br>
                        <br>
                        If the above button doesn't work, please copy and paste the following link in your browser: https://%s/?invite=%s
                        <br>
                        %s
                        <br>
                        Have a nice day!<br><br>
                        Best regards<br>
                        co.meta<br>
                    </div>
                </div>
            </body>
        </html>
        """ % (
            request.session['user']['name'],
            ", ".join(departments.values_list('department_name', flat=True)),
            DOMAIN,
            code,
            DOMAIN,
            code,
            customText
        )
        # generate email object
        email = EmailMultiAlternatives(
            email_subject,
            "",
            settings.EMAIL_HOST_USER,
            to=[receiver],
            headers={'X-COMETA': 'proudly_generated_by_amvara_cometa', 'X-COMETA-SERVER': 'AMVARA', 'X-COMETA-VERSION': str(version), 'X-COMETA-DEPARTMENTS':", ".join(departments.values_list('department_name', flat=True))}
        )
        # attatch html content (body)
        email.attach_alternative(email_body, "text/html")
        # send email
        email.send()
        # help print
        print("Email has been sent.... to: %s" % receiver)
    except Exception as err:
        print("Error: %s" % str(err))

class InviteViewSet(viewsets.ModelViewSet):

    queryset = Invite.objects.all()
    serializer_class = InviteSerializer
    renderer_classes = (JSONRenderer, )

    # @require_permissions("create_invite")
    def create(self, request, *args, **kwargs):
        # Get parameters from request body
        data=json.loads(request.body)
        emails = data['emails']
        department_ids = data['departments']
        custom_text = data['custom_text'] or ''

        # Get & check deparment
        departments =  Department.objects.filter(department_id__in=department_ids)
        if not departments.exists():
            return JsonResponse({"success": False, "error": "The department you selected does not exist." }, status=200)

        # Create Thread Pool for emails, 1 at a time
        executor = ThreadPoolExecutor(max_workers=1)

        # Create one invite for each email
        for email in emails:
            # Generate invite token
            token = secrets.token_hex(20)
            # Create invite
            invite = Invite(
                issuer_id = request.session['user']['user_id'],
                code = token
            )
            # Save invite
            invite.save()
            # once saved, set the departments
            invite.departments.set(departments)
            # Send invite email in another thread
            executor.submit(sendInvite, request, email, departments, token, custom_text)

        # Send response to Front
        return JsonResponse({"success": True }, status=200)

class IntegrationViewSet(viewsets.ModelViewSet):

    queryset = Integration.objects.select_related('department').all()
    serializer_class = IntegrationSerializer
    renderer_classes = (JSONRenderer, )

    def list(self, request, *args, **kwargs):
        # Get all the departments which the current user has access to
        departments = GetUserDepartments(request)
        # Get integrations filtered by departments
        integrations = self.queryset.filter(department__department_id__in=departments)
        # paginate the queryset
        page = self.paginate_queryset(integrations)
        # serialize the paginated data
        serialized_data = IntegrationSerializer(page, many=True).data
        # return data to the user
        return self.get_paginated_response(serialized_data)

    def create(self, request, *args, **kwargs):
        # Get parameters from request body
        data = json.loads(request.body)
        integration = Integration.objects.create(**data)

        # Send response to Front
        return JsonResponse(IntegrationSerializer(integration, many=False).data, status=200)

    def patch(self, request, *args, **kwargs):
        # Get parameters from request body
        data = json.loads(request.body)
        # Get id from URL param
        id = self.kwargs.get('id', None)
        if not id:
            return JsonResponse({"success": False, "error": "No integration ID provided." }, status=200)
        # Check id is valid
        integrations = self.queryset.filter(id=id)
        if not integrations.exists():
            return JsonResponse({"success": False, "error": "Invalid integration ID provided." }, status=200)
        # Update properties
        integrations.update(**data)
        # Return reponse
        return JsonResponse(IntegrationSerializer(integrations[0], many=False).data)

    def delete(self, request, *args, **kwargs):
        # Get id from URL param
        id = self.kwargs.get('id', None)
        if not id:
            return JsonResponse({"success": False, "error": "No integration ID provided." }, status=200)
        # Check id is valid
        integrations = self.queryset.filter(id=id)
        if not integrations.exists():
            return JsonResponse({"success": False, "error": "Invalid integration ID provided." }, status=200)
        # Perform delete of integration
        integrations.delete()
        # Return reponse
        return JsonResponse({ "success": True })

class SubscriptionsViewSet(viewsets.ModelViewSet):
    """
    API endpoint to view subscriptions
    """
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionPublicSerializer
    renderer_classes = (JSONRenderer, )

#
# FIXME - Why is this needed to register the router-url?
#
class CometaUsageViewSet(viewsets.ModelViewSet):
    # Get the feature runs
    queryset = Feature_Runs.objects.all()
    serializer_class = FeatureRunsSerializer
    renderer_classes = (JSONRenderer, )

@csrf_exempt
def CometaUsage(request):
    """
    Returns basic usage numbers as JSON
    04.01.2022 RRO initial report, much more figures to be reported - FIXME
    """
    logger.debug("Getting Usage")

    # Get the feature runs
    queryset = Feature_Runs.objects.all()
    serializer_class = FeatureRunsSerializer
    renderer_classes = (JSONRenderer, )

    # calc average times on feature runs
    avg_execution_time = Feature_Runs.objects.all().aggregate(Avg('execution_time')).get('execution_time__avg', 0.00)
    avg_execution_time_seconds = avg_execution_time / 1000

    # calc total times on feature runs
    sum_execution_time = Feature_Runs.objects.all().aggregate(Sum('execution_time')).get('execution_time__sum', 0.00)
    sum_execution_time_seconds = sum_execution_time/1000
    sum_execution_time_minutes = sum_execution_time/1000/60
    sum_execution_time_hours = sum_execution_time/1000/60/60

    # get total number of runs
    total_tests_executed = queryset.count()

    # some logging before returning JSON
    logger.debug("Count: "+str(total_tests_executed))

    #
    # get number of features
    #
    logger.debug("Getting number of features")
    queryset = Feature.objects.all()
    total_number_of_features = queryset.count() 

    # This is something needed to calculate numbers depending on department that the user has access to
    departments = tuple([x['department_id'] for x in request.session['user']['departments']])

    return JsonResponse(
        {
            "average_execution_time_ms": str(avg_execution_time), 
            "average_execution_time_s": str(avg_execution_time_seconds), 
            "total_execution_time_ms": str(sum_execution_time),
            "total_execution_time_s": str(sum_execution_time_seconds),
            "total_execution_time_m": str(sum_execution_time_minutes),
            "total_execution_time_h": str(sum_execution_time_hours),
            "total_tests_executed": str(total_tests_executed),
            "total_number_features": str(total_number_of_features)
        }, status=200)

    '''
    # needs to be implemented

    # 0. Total Number of testing minutes per month
    
        SELECT 
            to_char(date_time, 'YYYY-MM'), 
            sum(execution_time)/1000/60 
        FROM  backend_feature_runs 
        GROUP BY to_char(date_time, 'YYYY-MM') 
        ORDER BY to_char(date_time, 'YYYY-MM')

    # 1. average testing minutes on local + browser per day / week / month over the last 24 month "rolling"



    # 1.1. Testing minutes per department

        SELECT
                d.department_name, 
                fr.feature_id, 
                f.feature_name,
                sum(execution_time)/1000/60 as total_execution
            FROM  backend_feature_runs as fr 
                join backend_feature as f on fr.feature_id = f.feature_id 
                join backend_department d on f.department_id = d.department_id
            GROUP BY fr.feature_id, f.feature_name, d.department_name
            ORDER BY total_execution desc

    # 2. same for number of logins
    # 3. number of active users 
    # 4. number of succeded tests
    # 5. number of failed tests
    '''



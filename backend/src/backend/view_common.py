import time
from backend.common import *
from backend.models import *
from backend.serializers import *
from backend.utility.functions import *
from backend.utility.timezone_utils import *
from backend.utility.uploadFile import *
from backend.utility.config_handler import *

import requests
from requests.auth import HTTPBasicAuth
from django.http import JsonResponse

logger = getLogger()


def timediff(method):
    def wrapper(*args, **kwargs):
        method_name = method.__qualname__ or method.__name__
        logger.debug("Mesuring time differance for " + method_name + "...")
        start = time.time()
        result = method(*args, **kwargs)
        end = time.time()
        logger.debug(method_name + " took: " + str(end - start) + " seconds")
        return result

    return wrapper


def bytesToMegaBytes(bytes):
    kilobytes = bytes / 1024
    megabytes = kilobytes / 1024

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
    account = OIDCAccount.objects.filter(email=user_email)
    user_id = account[0].user_id
    DepartmentsRelated = Account_role.objects.all().filter(user=user_id)
    departmentsList = []
    for d in DepartmentsRelated:
        departmentsList.append(
            d.department_id if type == "id" else Department.objects.all().filter(department_id=d.department_id)[
                0].department_name)
    return departmentsList


def browser_stack_request():
    # get browserstack cloud from database
    try:
        bsCloud = Cloud.objects.get(name="browserstack")
        browsers = requests.get("https://api.browserstack.com/automate/browsers.json",
                                auth=HTTPBasicAuth(bsCloud.username, bsCloud.password))
        if browsers.status_code == 200:
            results = browsers.json()
        else:
            raise Exception(browsers.text)
        return results
    except Cloud.DoesNotExist:
        return []


def GetBrowserStackBrowsers(request):
    try:
        results = browser_stack_request()
    except Exception as err:
        logger.exception(err)
        return JsonResponse({
            "success": False,
            "msg": "Failed to make request to Browserstack, maybe provided credentials are incorrect?",
            "results": []
        })
    # send a response back
    return JsonResponse({
        "success": True,
        "results": results
    }, safe=False)


def get_lyrid_browsers(request):
    results = []
    try:
        lyridCloud = Cloud.objects.get(name="Lyrid.io")
        if lyridCloud.active:
            results = [
                {
                    "os": "Lyrid.io",
                    "cloud": "Lyrid.io",
                    "device": None,
                    "browser": "chrome",
                    "os_version": "Cloud",
                    "real_mobile": False,
                    "browser_version": "120.0"
                }
            ]
    except Cloud.DoesNotExist:
        logger.debug("Lyrid cloud does not exists returning empty browsers list.")

    return JsonResponse({
        "success": True,
        "results": results
    }, safe=False)


def GetUserDepartments(request):
    # Get an array of the departments ids owned by the current logged user
    # try:
    #     departmentsOwning = Department.objects.filter(owners__user_id=request.session['user']['user_id']).values_list('department_id', flat=True)
    # except FieldError:
    #     print('DepartmentOwners not implemented yet')
    #     departmentsOwning = []
    # Get an array of department ids which the user has access to from the OIDCAccount info
    userDepartments = [x['department_id'] for x in request.session['user']['departments']]
    # Merge arrays of departments and owning, and return
    # return userDepartments + list(set(departmentsOwning) - set(userDepartments))
    return userDepartments + list(set(userDepartments))


# function that recieves feature_run are removes all feature_results not
# marked as archived.
def removeNotArchivedFeatureResults(feature_run, *args, **kwargs):
    # get deleteTemplate from kwargs
    deleteTemplate = kwargs.get('deleteTemplate', False)
    # loop over are the results and remove them if not marked as archived
    for feature_result in feature_run.feature_results.filter(archived=False):
        # finally remove the feature_result
        feature_result.delete(deleteTemplate=deleteTemplate)

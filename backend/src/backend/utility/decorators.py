from backend.models import *
from backend.payments import get_requires_payment, get_subscriptions_from_request
import requests
from django.http import JsonResponse, HttpResponse
from django.core.handlers.wsgi import WSGIRequest
from rest_framework.request import Request
from pprint import pprint

def compareOIDCAccount(user, compareId):
    return user['user_id'] == int(compareId)

def compareFeatureOwner(user, compareId):
    feature = Feature.objects.filter(feature_id=compareId)
    if not feature.exists():
        return False
    if not isinstance(feature[0].created_by, OIDCAccount):
        return False
    return feature[0].created_by.email == user['email']

def compareFolderOwner(user, compareId):
    folder = Folder.objects.filter(folder_id=compareId)
    if not folder.exists():
        return False
    if not isinstance(folder[0].owner, OIDCAccount):
        return False
    return folder[0].owner.email == user['email']

# users own if a method that checks if the object
# that user is trying to access is his/her own.
# if true then return True else False
def usersOwn(user, **_kwargs):
    if 'account_id' in _kwargs:
        return compareOIDCAccount(user, _kwargs['account_id'])
    elif 'feature_id' in _kwargs:
        return compareFeatureOwner(user, _kwargs['feature_id'])
    elif 'folder_id' in _kwargs:
        return compareFolderOwner(user, _kwargs['folder_id'])
    return False

# has Permission gets user using email and then return True or False depending
# on if currently logged in user has the specified permission. 
def hasPermission(user, permission):
    permissions = user['user_permissions']
    permissions_list = permission.split("||")
    for permission in permissions_list:
        if permission in permissions and permissions[permission]:
            return True
    return False

# requiere permissions calls the method after checking if user
# logged in has permissions to specified permission otherwise
# user gets an 401 reponse with permission_denied.

# permission = String based excat name permission from Permissions model
# *_args = non keyword arguments
# **_kwargs = keyword arguments
## kwargs are used to check if the object is users like for e.g.:
### User account 
### Feature created by user
def require_permissions(permission, *_args, **_kwargs):
    def decorator(fn):
        def decorated(*args, **kwargs):
            kwargs['usersOwn'] = None
            require_permissions_kwargs = {}
            for property in _kwargs:
                require_permissions_kwargs[property] = eval(_kwargs[property]) if isinstance(_kwargs[property], str) else _kwargs[property]
            index = 0
            for i in range(0, len(args)):
                if isinstance(args[i], WSGIRequest) or isinstance(args[i], Request):
                    index = i
                    break
            user = args[index].session['user']
            if hasPermission(user, permission): # user has permissions
                return fn(*args, **kwargs)
            elif usersOwn(user, **require_permissions_kwargs): # user owns the object
                kwargs['usersOwn'] = True
                return fn(*args, **kwargs)
            return JsonResponse({"success": False, "error": "Missing permission '%s'." % permission}, status=200)
        return decorated
    return decorator

def get_request(args):
    for arg in args:
        if isinstance(arg, WSGIRequest) or isinstance(arg, Request):
            return arg

def has_one_active_subscription(subscriptions):
    # active_subs = [ sub for sub in subscriptions if sub['active'] is True ]
    return len(subscriptions) > 0

# Used to verify if logged user has at least 1 subscription
def require_subscription(*_args, **_kwargs):
    def decorator(fn):
        def decorated(*args, **kwargs):
            request = get_request(args)
            subscriptions = get_subscriptions_from_request(request)
            if not get_requires_payment() or has_one_active_subscription(subscriptions):
                return fn(*args, **kwargs)
            else:
                return HttpResponse(status=403)
        return decorated
    return decorator
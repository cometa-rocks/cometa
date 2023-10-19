from backend.models import OIDCAccount, Department, Account_role, Permissions, Invite
from backend.serializers import OIDCAccountLoginSerializer
from django.http import JsonResponse
import uuid, datetime, re, requests
from backend.common import *
import secret_variables
from backend.utility.functions import getLogger
from pprint import pprint
from django.shortcuts import redirect
import urllib3

logger = getLogger()

DOMAIN = getattr(secret_variables, 'COMETA_DOMAIN', '')

class AuthenticationMiddleware:
    def __init__(self, get_response):
        urllib3.disable_warnings()
        self.get_response = get_response
        # One-time configuration and initialization.

    def __call__(self, request):
        # save all public routes, this is a temporary fix.
        # FIXME not a good idea.
        public_routes = [
            '/api/authproviders/'
        ]
        public_route_found = len([x for x in public_routes if request.get_full_path().startswith(x)]) > 0
        if public_route_found:
            return self.get_response(request)

        # check if user_info is already saved in session
        user_info = request.session.get('user_info', None)
        # if not in session make a request to callback and get userinfo from openidc.
        if user_info == None:
            try:
                # get the host from request
                HTTP_HOST = request.META.get('HTTP_HOST', DOMAIN)
                if HTTP_HOST == 'cometa.local':
                    raise Exception("User session none existent from behave.")
                if not re.match(r'^(cometa.*\.amvara\..*)|(.*\.cometa\.rocks)$', HTTP_HOST):
                    HTTP_HOST = 'cometa_front'
                # make a request to cometa_front to get info about the logged in user
                response = requests.get('https://%s/callback?info=json' % HTTP_HOST, verify=False, cookies={
                    'mod_auth_openidc_session': request.COOKIES.get('mod_auth_openidc_session', '')
                }, headers={
                    'Host': request.META.get('HTTP_HOST', DOMAIN)
                })
                # save user_info to self
                self.user_info = response.json().get('userinfo', {})
            except Exception as error: # if executed from crontab or sent by behave
                self.user_info = {}
            
            # create a session variable
            request.session['user_info'] = self.user_info
        else:
            # assign the user_info session variable to the class
            self.user_info = request.session['user_info']

        # cookies to backup before executing any request
        cookiesToBackup = ['_auth_user_id', '_auth_user_backend', '_auth_user_hash']
        
        if not re.search(r'^/admin/', request.get_full_path()):
            # delete admin cookies from session
            [self.createSessionCookieBackup(request, x) for x in cookiesToBackup]
        else:
            # retore admin cookies
            [self.restoreSessionCookie(request, x) for x in cookiesToBackup]

        # check if user exists in session or user has been changed
        # removed since it return inconsistent data after update
        # TODO: if not self.checkSessionUser(request):
        # create a user field in session / update
        if not self.checkSessionUser(request):
            result = self.createSession(request)
            if result != True:
                return result
        # pass the request to next middleware
        return self.get_response(request)
    
    def checkSessionUser(self, request): # check if user in HTTP_PROXY_USER and session.user are the same
        REMOTE_USER = self.user_info.get('email', None)
        user = request.session.get('user', None)
        HTTP_HOST = request.META.get('HTTP_HOST', '')
        sessionid = request.session.get('session', None)
        mod_auth_openidc_session = request.COOKIES.get('mod_auth_openidc_session', 'sessionid')
            
        if user == None or sessionid != mod_auth_openidc_session:
            return False # need login

        # update any information that was updated on user
        request.session['user'] = OIDCAccountLoginSerializer(OIDCAccount.objects.get(user_id=user['user_id']), many=False).data
        return True # no need for login

    def get_dummy_user(self):
        # get the superuser permissions
        superuser = Permissions.objects.filter(permission_name="SUPERUSER")[0]
        user, created = OIDCAccount.objects.get_or_create(name="Scheduled Job", email="scheduled_job_dummy@amvara.de", user_permissions=superuser)
        return user

    def createSession(self, request): # create the object user inside request sessions
        REMOTE_USER = self.user_info.get('email', None)

        # if REMOTE_USER is none check if HTTP_HOST is "cometa.local" and REMOTE_ADDR startswith 172
        if REMOTE_USER == None:
            HTTP_HOST = request.META.get('HTTP_HOST', '')
            REMOTE_ADDR = request.META.get('REMOTE_ADDR', '')
            HTTP_COMETA_ORIGIN = request.META.get("HTTP_COMETA_ORIGIN", '')
            HTTP_COMETA_USER = request.META.get("HTTP_COMETA_USER", None) # Used to know which user scheduled a feature
            SERVER_PORT = request.META.get('SERVER_PORT', '443')
            HTTP_X_FORWARDED_PROTO = request.META.get('HTTP_X_FORWARDED_PROTO', 'http')

            # get the superuser permissions
            superuser = Permissions.objects.filter(permission_name="SUPERUSER")[0]
            if REMOTE_ADDR.startswith('172'):
                # save the user as Scheduler
                if HTTP_COMETA_ORIGIN == 'CRONTAB':
                    # Try to get HTTP_COMETA_USER from behave cron, we will fallback to dummy user
                    if HTTP_COMETA_USER:
                        # Retrieve user account with id
                        user = OIDCAccount.objects.filter(user_id=int(HTTP_COMETA_USER))
                        # Check if user exists
                        if user.exists():
                            user = user[0]
                        else:
                            # Fallback to dummy user
                            logger.info('Request by Crontab sent a non-existing user_id, falling back to dummy user.')
                            user = self.get_dummy_user()
                    else:
                        # create a scheculed job user with admin rights
                        user = self.get_dummy_user()
                    # set the session user to serialized user
                    request.session['user'] = OIDCAccountLoginSerializer(user, many=False).data
                    return True

            # don't save the user in case accessing from port 8000
            if HTTP_HOST == "cometa.local" or (HTTP_X_FORWARDED_PROTO == "http" and SERVER_PORT == '8000'):
                # create a dummy user with admin rights
                user = OIDCAccount(name=HTTP_HOST, email=REMOTE_ADDR, user_permissions=superuser)
                # set the session user to dummy serialized user
                request.session['user'] = OIDCAccountLoginSerializer(user, many=False).data
                return True
            
            return JsonResponse({
                "success": False, 
                "error": """
                Unable to determin user information.
                This could mean that oAuth provider did not return user information.
                
                Try again later or please contact us @ %s
                """ % secret_variables.COMETA_FEEDBACK_MAIL
            }, status=200)

        # get the user from the OIDCAccounts model
        users = OIDCAccount.objects.filter(email=REMOTE_USER)
        # check if user does not exists
        if not users.exists():
            if ('prod.cometa.' in request.META.get('HTTP_HOST', '') or 'stage.cometa.' in request.META.get('HTTP_HOST', '')) and request.GET.get('invite', None) == None:
                # return the user a 302 to the invite form.
                if request.META.get('HTTP_X_REQUESTED_WITH', None) == 'XMLHttpRequest': # send a json with type redirect so front can react over it
                    return JsonResponse({
                        'success': False,
                        'reason': 'Beta phase has ended.',
                        'type': 'redirect',
                        'url': 'https://cometa.rocks/early-access-form/'
                    })
                else: # it a normal request send the user to the form directly.
                    return redirect('https://cometa.rocks/early-access-form/')
            # register the user
            if not self.register(request): # if fails return a 401 letting user know about the issue
                return JsonResponse({
                    "success": False,
                    "error": "Missing name and/or email, unable to register the user."
                }, status=401)
            else:
                users = OIDCAccount.objects.filter(email=REMOTE_USER)
        # get the first user from the users
        user = users[0]
        # update user name just in case
        user.name = self.user_info.get('name', user.name)
        # update user last login
        user.last_login = datetime.datetime.utcnow()
        user.login_counter = user.login_counter + 1
        user.save()
        # get the mod_auth_sessionid and save it as user.sessionid
        mod_auth_openidc_session = request.COOKIES.get('mod_auth_openidc_session', 'sessionid')
        request.session['session'] = mod_auth_openidc_session
        # serialize it and save it to session
        request.session['user'] = OIDCAccountLoginSerializer(user, many=False).data
        return True


    def register(self, request): # create account if missing
        # get the Full name from the request
        fullName = self.user_info.get('name', None)
        # get the email from the request
        email = self.user_info.get('email', None)
        # get the invite code if set
        inviteCode = request.GET.get('invite', None)

        # check if fullName or email are missing in the request
        if fullName == None or email == None or fullName == "(null)" or email == "(null)":
            return False

        # create the account
        user = OIDCAccount(name=fullName, email=email)
        # is this first ever user
        first_user = OIDCAccount.objects.all().count() == 0
        if first_user:
            try:
                # find the superuser role and assign it to the first ever user.
                superuser = Permissions.objects.get(permission_name="SUPERUSER")
                user.user_permissions = superuser
            except Exception as err:
                logger.error("Seems like SUPERUSER role isn't created yet....")
                logger.exception(err)
        user.save()

        # if no invite code was set then add user to default department
        if inviteCode == None:
            # add user to the default department
            defaultDepartment = Department.objects.filter(department_name="Default")[0]
            user_department = Account_role(user=user, department=defaultDepartment)
            user_department.save()
        else:
            try:
                inviteObject = Invite.objects.get(code=inviteCode)
                for department in inviteObject.departments.all():
                    # add user to invited department
                    user_department = Account_role(user=user, department=department)
                    #save the user_department object
                    user_department.save()
            except Exception as err:
                print("No invites found with code: %s" % inviteCode)
                print("Adding user to default department.")
                # add user to the default department
                defaultDepartment = Department.objects.filter(department_name="Default")[0]
                user_department = Account_role(user=user, department=defaultDepartment)
                user_department.save()

        return True
    
    def logout(self, request):
        # delete the user from the session
        del request.session['user']

    # create backup for admin cookies and remove them from session
    def createSessionCookieBackup(self, request, cookieName):
        try:
            bkpCookieName = "%s_bkp" % cookieName
            # create new session key with bkpCookieName that contains content of cookieName
            request.session[bkpCookieName] = request.session[cookieName]
            # remove the cookie from session
            del request.session[cookieName]
        except:
            pass
    
    # restore backup for admin cookies and remove backup from session
    def restoreSessionCookie(self, request, cookieName):
        try:
            bkpCookieName = "%s_bkp" % cookieName
            # create new session key with cookieName that contains content of bkpCookieName
            request.session[cookieName] = request.session[bkpCookieName]
            # remove the backup cookie from session
            del request.session[bkpCookieName]
        except:
            pass

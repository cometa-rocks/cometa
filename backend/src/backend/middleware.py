from backend.models import OIDCAccount
from backend.models import Account_role
from django.http import JsonResponse
import base64
import binascii
from django.conf import settings

class AuthMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response
        # One-time configuration and initialization.

    def __call__(self, request):
        response = self.get_response(request)
        return response

    def process_view(self, request, view_func, view_args, view_kwargs):
        
        function_name = view_func.__name__
        print("process view->" , function_name)        
        #base64Token = base64.b64decode(base64Token).decode('UTF-8')
        if not hasattr(settings, 'USERIDFLAG'):
            return JsonResponse({"Error" : "USERIDFLAG param not exits"}, status=400)
        
        if settings.USERIDFLAG != "OPTIONAL":
            email = request.META.get('HTTP_PROXY_USER')

            if email is None:
                return JsonResponse({"Error" : "PROXY_USER header is mising"}, status=400)
            try:
                # uname, passwd = base64.b64decode(base64Token).decode('UTF-8').split(':')
                #validation
                users = OIDCAccount.objects.filter(email=email)
                if not users.exists():
                    return JsonResponse({"Error" : "User not exits"}, status=401)
                user = users[0]
                RESULT_VIEWS = ["FeatureResultViewSet","StepResultViewSet"]
                DEVOP_VIEWS = ["FeatureViewSet","StepViewSet"]
                print("ROLE->", user.user_role)
                if user.user_role == "DEVOP" or user.user_role == "ANALYSIS":
                    
                    if user.user_role == "DEVOP":
                        print("is DEVOP")                       
                        res = self.check_view(function_name, RESULT_VIEWS + DEVOP_VIEWS)
                        if(res != True):
                            return res

                    if user.user_role == "ANALYSIS":
                        print("is ANALYSIS")
                        res = self.check_view(function_name, RESULT_VIEWS)
                        if(res != True):
                            return res
                        if request.method != "GET":
                            return JsonResponse({"Error" : "Access denied. Only have read access."}, status=401)

                    if function_name == "FeatureResultViewSet" and request.method == "GET":
                        print("FeatureResultViewSet")      
                        department_id = request.GET.get("department_id")
                        if department_id is None:
                            return JsonResponse({"Error" : "Access denied. You must set 'department_id' param."}, status=400)
                        users_role = Account_role.objects.filter(user_id=user.user_id, department_id = department_id)
                        if not users_role.exists():
                            return JsonResponse({"Error" : "Access denied. department not allowed."}, status=401)

                    if function_name == "StepResultViewSet":
                        print("kwargs->", view_kwargs['feature_result_id'])
                elif user.user_role == "SUPERUSER":
                    print("is SUPERUSER")
                else:
                    return JsonResponse({"Error" : "Access denied. Invalid ROLE."}, status=401)

            except binascii.Error:
                return JsonResponse({"Error" : "Invalid base64 token"}, status=400)

        return None

    def check_view(self, VIEW, VIEWS):
        if not VIEW in VIEWS:
            return JsonResponse({"Error" : "Access denied. Resource not allowed."}, status=401)
        print("VIEWS->" , VIEWS)
        
        return True
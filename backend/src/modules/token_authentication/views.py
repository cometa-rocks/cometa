# Import all models and all the utility methods

from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework import viewsets, mixins
from backend.ee.modules.mobile.models import Mobile

# Django Imports
from django.http import HttpResponse, JsonResponse
from .models import OIDCUserAppSecret
from .serializers import OIDCUserAppSecretSerializer
from backend.utility.response_manager import ResponseManager
from backend.utility.functions import getLogger
from backend.utility.decorators import require_permissions
import os, requests, traceback, json
from json import JSONDecodeError
import time
from datetime import datetime, timedelta
from django.views.decorators.csrf import csrf_exempt
from backend.utility.config_handler import get_cometa_backend_url

logger = getLogger()


class OIDCUserAppSecretViewSet(viewsets.ModelViewSet):

    queryset = OIDCUserAppSecret.objects.all()
    serializer_class = OIDCUserAppSecretSerializer
    renderer_classes = (JSONRenderer,)
    response_manager = ResponseManager("OIDCUserAppSecret")

    @require_permissions("manage_secret")
    def retrieve(self, request, *args, **kwargs):
        return self.response_manager.not_implemented_response()
        
    @require_permissions("manage_secret")
    def list(self, request, *args, **kwargs):
        queryset = OIDCUserAppSecret.objects.filter().order_by("created_on")
        serializer = self.get_serializer(queryset, many=True)
        return self.response_manager.get_response(list_data=serializer.data)

    @require_permissions("manage_secret")
    def update(self, request, *args, **kwargs):
        return self.response_manager.not_implemented_response()

    @require_permissions("manage_secret")
    def create(self, request, *args, **kwargs):
        new_secret = request.data
        serializer = self.get_serializer(data=new_secret)
        if serializer.is_valid():
            serializer.save()
            return self.response_manager.created_response(dict_data=serializer.data)
        return super().create(request, args, kwargs)

    @require_permissions("manage_secret")
    def destroy(self, request, *args, **kwargs):
        try:
            OIDCUserAppSecret.objects.get(id=int(kwargs['pk'])).delete()
            return self.response_manager.deleted_response(id=kwargs['pk'])
        except Exception as e:
            return self.response_manager.can_not_be_deleted_response(id=kwargs['pk'])


# This method is used to validate the secret provided in the request body during the CICD integration test start
def validate_secrets(secret):
    if secret is None:
        return None
    secret_id = secret.get("secret_id", None)
    secret_key = secret.get("secret_key", None)
    if secret_id is None or secret_key is None:
        return None
    try:
        logger.debug("Checking secret")
        secret = OIDCUserAppSecret.objects.select_related('oidc_account').get(secret_id=secret_id)
        # If the failed count is more than 10, then the secret is invalid
        if secret.failed_count > 10:
            logger.debug(f"Secret {secret.token_id} failed count exceeded 10, this secret is disabled")
            return None
            
        if secret.secret_key != secret_key:
            logger.debug(f"Invalid secret key provided for secret {secret.token_id}")
            secret.failed_count += 1
            secret.save()
            return None
        
        secret.failed_count = 0
        secret.last_used = datetime.now()
        secret.save()
        
        return secret       
    except Exception as e:
        traceback.print_exc()
        return None
                
# This method is used to start the test using Cometa integration tools
# 
@csrf_exempt
def login_start_test(request):
    
    required_body_template = {
        "message": "Please ask your cometa administrator to provide you with the secret_id and secret_key related to your account to use this feature, then use following request body to start the test",
        "body_template":{
            "secret":{
                "secret_id":"************ secret_id ***********",
                "secret_key":"************ secret_key ***********"
            },
            "test_info":{
                "execution_type":"feature | datadriven", 
                "id":5 
            }
        }
    }
    response_manager = ResponseManager("integration_v2")
    if request.method == 'POST':
        try:
            data = request.body.decode('utf-8')
            data = json.loads(data)
            
            # this section is to check if the secret is provided in the request body is correct
            secret = data.get("secret", None)
            if secret is None:
                return response_manager.validation_error_response({
                    "error": "Please provide the 'secret' in the request body",
                    **required_body_template
                })
            
            secret = validate_secrets(secret)
            if not secret:
                return response_manager.validation_error_response({
                    "error": "Invalid secret provided",
                    **required_body_template
                })
            
            logger.debug("Secret validated")                
            # this section is to check if the secret is provided in the request body is correct
            test_info = data.get("test_info", None)
            if test_info is None:
                return response_manager.validation_error_response({
                    "error": "Please provide the 'test_info' in the request body",
                    **required_body_template
                })

            id = test_info.get("id", None)
            execution_type = test_info.get("execution_type", None)
            
            if id is None or execution_type is None:
                return response_manager.validation_error_response({
                    "error": "Please provide the 'id' and 'execution_type' in the request body",
                    **required_body_template
                })
            
            logger.debug(f"Starting test using secrets, related to account : {secret.oidc_account.email}")
            
            headers  = {
                "COMETA-ORIGIN": "DJANGO",
                "COMETA-USER": str(secret.oidc_account.user_id)
            }
            
            if execution_type == "feature":
                body = {"feature_id": id, "wait": False}
                response = requests.post(f"{get_cometa_backend_url()}/exectest/", data=json.dumps(body), headers=headers)
                logger.debug(f"Response from Cometa: {response.text}")
                
                response_body = response.json()
                return response_manager.response(response_body)
                
            elif execution_type == "datadriven":
                body = {"file_id": id}
                response = requests.post(f"{get_cometa_backend_url()}/exec_data_driven/", data=json.dumps(body), headers=headers)
                logger.debug(f"Response from Cometa: {response.text}")
                
                response_body = response.json()
                return response_manager.response(response_body)
            
            return response_manager.validation_error_response({
                "error": "Invalid execution_type provided",
                **required_body_template
            })
            
        except JSONDecodeError as e:
            return response_manager.json_decode_error_response(e)
        except Exception as e:
            traceback.print_exc()
            logger.error(f"Internal server error: {str(e)}")
            return JsonResponse({"error": "Internal server error"}, status=500)
    else:
        return JsonResponse({"error": "Method not allowed"}, status=405)

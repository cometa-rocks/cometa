# # Import all models and all the utility methods

# from rest_framework.renderers import JSONRenderer
# from rest_framework.response import Response
# from rest_framework import viewsets, mixins

# # Django Imports
# from django.http import HttpResponse, JsonResponse
# from .models import OIDCUserAppSecret
# from .serializers import OIDCUserAppSecretSerializer
# from backend.utility.response_manager import ResponseManager
# from backend.utility.functions import getLogger
# from backend.utility.decorators import require_permissions
# import os, requests, traceback, json
# from json import JSONDecodeError
# import time
# from datetime import datetime, timedelta
# from django.views.decorators.csrf import csrf_exempt

# logger = getLogger()


# class OIDCUserAppSecretViewSet(viewsets.ModelViewSet):

#     queryset = OIDCUserAppSecret.objects.all()
#     serializer_class = OIDCUserAppSecretSerializer
#     renderer_classes = (JSONRenderer,)
#     response_manager = ResponseManager("OIDCUserAppSecret")

#     @require_permissions("manage_secret")
#     def retrieve(self, request, *args, **kwargs):
#         return self.response_manager.not_implemented_response()
        
#     @require_permissions("manage_secret")
#     def list(self, request, *args, **kwargs):
#         queryset = OIDCUserAppSecret.objects.filter().order_by("created_on")
#         serializer = self.get_serializer(queryset, many=True)
#         return self.response_manager.get_response(list_data=serializer.data)

#     @require_permissions("manage_secret")
#     def update(self, request, *args, **kwargs):
#         return self.response_manager.not_implemented_response()

#     @require_permissions("manage_secret")
#     def create(self, request, *args, **kwargs):
#         new_secret = request.data
#         serializer = self.get_serializer(data=new_secret)
#         if serializer.is_valid():
#             serializer.save()
#             return self.response_manager.created_response(dict_data=serializer.data)
#         return super().create(request, args, kwargs)

#     @require_permissions("manage_secret")
#     def destroy(self, request, *args, **kwargs):
#         try:
#             OIDCUserAppSecret.objects.get(id=int(kwargs['pk'])).delete()
#             return self.response_manager.deleted_response(id=kwargs['pk'])
#         except Exception as e:
#             return self.response_manager.can_not_be_deleted_response(id=kwargs['pk'])


# # This method is used to start the test using Cometa integration tools
# # 
# def validate_login(request):
    
#     required_body_template = {
#         "message": "Please ask your cometa administrator to provide you with the secret_id and secret_key related to your account to use this feature, then use following request body to start the test",
#         "body_template":{
#             "secret":{
#                 "secret_id":"************ secret_id ***********",
#                 "secret_key":"************ secret_key ***********"
#             },
#             "body_data":{}
#         }
#     }
#     response_manager = ResponseManager("integration_v2")
#     if request.method == 'POST':
#         try:
#             data = request.body.decode('utf-8')
#             data = json.loads(data)
            
#             # this section is to check if the secret is provided in the request body is correct
#             secret = data.get("secret", None)
#             if secret is None:
#                 return {
#                     "error": "Please provide the 'secret' in the request body",
#                     **required_body_template,
#                     "success": False
#                 }
            
#             secret = validate_secrets(secret)
#             if not secret:
#                 return {
#                     "error": "Invalid secret provided",
#                     **required_body_template,
#                     "success": False
#                 }
            
#             return data.get("body_data", None)
        
#         except JSONDecodeError as e:
#             return response_manager.json_decode_error_response(e)
#         except Exception as e:
#             traceback.print_exc()
#             logger.error(f"Internal server error: {str(e)}")
#             return {"error": "Internal server error", "success": False}
#     else:
#         return {"error": "Method not allowed", "allowed_methods": ["POST"], "success": False}

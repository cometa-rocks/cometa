# Import all models and all the utility methods

from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework import viewsets, mixins
from backend.ee.modules.mobile.models import Mobile

# Django Imports
from django.http import HttpResponse, JsonResponse
from .models import ContainerService 
from .serializers import ContainerServiceSerializer
from backend.utility.response_manager import ResponseManager
from backend.utility.functions import getLogger
from backend.utility.decorators import require_permissions
import os, requests, traceback
import time
from datetime import datetime, timedelta
from django.views.decorators.csrf import csrf_exempt

logger = getLogger()


class ContainerServiceViewSet(viewsets.ModelViewSet):

    queryset = ContainerService.objects.all()
    serializer_class = ContainerServiceSerializer
    renderer_classes = (JSONRenderer,)
    response_manager = ResponseManager("ContainerService")

    # @require_permissions("manage_house_keeping_logs")
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, args, kwargs)

    # @require_permissions("manage_house_keeping_logs")
    def list(self, request, *args, **kwargs):
        return super().list(request, args, kwargs)
    
    # @require_permissions("manage_house_keeping_logs")
    def update(self, request, *args, **kwargs):
        try:
            container_service = ContainerService.objects.get(id=kwargs['pk'])
            container_service.save(**(request.data))
            return super().update(request, args, kwargs)
        except Exception as e:
            return self.response_manager.can_not_be_updated_response(kwargs['pk'])

    # @require_permissions("manage_house_keeping_logs")
    def create(self, request, *args, **kwargs):
        request.data['user_id'] = request.session['user']['user_id']
        # request.data['image_id'] = mobile_id=request.data['image']
        # request.data['user_id'] = request.session['user']['user_id']
        # serializer = self.serializer_class(data=request.data)
        # if serializer.is_valid():
        #     serializer.save()
        #     return self.response_manager.created_response(data=serializer.data)
        # else:
        #     return self.response_manager.validation_error_response(error_data=serializer.errors)            
        return super().create(request, args, kwargs)
    
    def delete(self, request, *args, **kwargs):
        return super().delete(request, args, kwargs)





# #########
# This view acts as a proxy to forward HTTP requests to an emulator service container.
# It handles various HTTP methods (GET, POST, PUT, PATCH, etc.) and passes the incoming request 
# to the emulator's Appium service, hosted on port 4723.
# 
# Steps:
# 1. Retrieve the emulator container details from the database using the provided emulator_id.
#    - If the container is not found, return a 404 "Not Found" response.
# 2. Construct the target URL using the emulator's hostname and the remaining path.
# 3. Exclude specific request headers ('Host', 'X-Forwarded-For', 'Content-Length') to avoid conflicts.
# 4. Log the details of the incoming request (method, URL, headers, and body if applicable).
# 5. Forward the request to the emulator service using the same HTTP method.
#    - For methods like POST, PUT, PATCH, the request body is included, and `Content-Length` is recalculated.
# 6. Capture the response from the emulator service and log the response details (headers, status code, and part of the body).
# 7. Return the response from the emulator service back to the client, with the appropriate status code and content.
# 
# Error handling:
# - If there is a timeout or connection error when communicating with the emulator service, return a relevant error response (504 or 502).
# - Any other unexpected errors will result in a 500 "Internal Server Error" response.
# #########
@csrf_exempt
def emulator_proxy_view(request, emulator_id, remaining_path):
    try:
        # Fetch the emulator container information
        emulator_container = ContainerService.objects.filter(id=emulator_id, service_type="Emulator").first()
        if not emulator_container:
            return HttpResponse("Not found", status=404)

        # Prepare target URL based on hostname and path
        hostname = emulator_container.information["Config"]["Hostname"]
        remaining_path = remaining_path.rstrip('/')
        url = f"{request.scheme}://{hostname}:4723/{remaining_path}"

        # Exclude certain headers and add 'Connection: keep-alive'
        headers_to_exclude = ['Host', 'X-Forwarded-For', 'Content-Length']
        headers = {key: value for key, value in request.headers.items() if key not in headers_to_exclude}
        headers['Connection'] = 'keep-alive'

        logger.info(f"REQUEST METHOD: {request.method}")
        logger.info(f"REQUEST URL: {url}")
        logger.info(f"REQUEST HEADERS: {headers}")

        # Log request body for POST, PUT, PATCH methods
        if request.method in ['POST', 'PUT', 'PATCH']:
            request_body = request.body
            logger.info(f"REQUEST BODY: {request_body}")
            headers['Content-Length'] = str(len(request_body))  # Ensure Content-Length is properly set

        # Send the proxied request and capture response
        try:
            if request.method in ['POST', 'PUT', 'PATCH']:
                response = requests.request(request.method, url, headers=headers, data=request.body, params=request.GET, timeout=60)
            else:
                response = requests.request(request.method, url, headers=headers, params=request.GET, timeout=60)

            logger.info(f"RESPONSE HEADERS: {response.headers}")
            logger.info(f"RESPONSE Status Code: {response.status_code}")
            logger.info(f"RESPONSE BODY (First 500 chars): {response.text[:500]}")  # Log first 500 characters for brevity

            return HttpResponse(response.content, status=response.status_code, content_type=response.headers.get('Content-Type'))
        
        except requests.Timeout:
            logger.error("Request timed out")
            return JsonResponse({'error': 'Request timed out'}, status=504)
        except requests.ConnectionError:
            logger.error("Connection error")
            return JsonResponse({'error': 'Failed to connect to the target service'}, status=502)
        except requests.RequestException as e:
            logger.error(f"Request failed: {str(e)}")
            return JsonResponse({'error': str(e)}, status=500)
    
    except Exception as e:
        logger.error(f"Internal server error: {str(e)}")
        return JsonResponse({'error': 'Internal server error'}, status=500)

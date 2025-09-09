# author : Anand Kushwaha
# version : 10.0.0
# date : 2024-10-14

# Import all models and all the utility methods

from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework import viewsets, mixins
from backend.ee.modules.mobile.models import Mobile

# Django Imports
from django.http import HttpResponse, JsonResponse
from django.core.exceptions import ValidationError
from .models import ContainerService
from .serializers import ContainerServiceSerializer
from backend.utility.response_manager import ResponseManager
from backend.utility.functions import getLogger
from backend.utility.decorators import require_permissions
from backend.utility.config_handler import get_cometa_socket_url, get_cometa_backend_url
import os, requests, traceback
import time
from datetime import datetime, timedelta
from django.views.decorators.csrf import csrf_exempt
import threading
from threading import Thread
import json
from backend.utility.configurations import ConfigurationManager
import requests

logger = getLogger()


class ContainerServiceViewSet(viewsets.ModelViewSet):

    queryset = ContainerService.objects.all()
    serializer_class = ContainerServiceSerializer
    renderer_classes = (JSONRenderer,)
    response_manager = ResponseManager("ContainerService")

    # @require_permissions("manage_house_keeping_logs")
    def retrieve(self, request, *args, **kwargs):
        # FIXME superuser permissions
        try:
            container_service  = ContainerService.objects.select_related('created_by', 'image').get(id=int(kwargs['pk']))
            serializer = self.get_serializer(container_service)
            return self.response_manager.get_response(dict_data=serializer.data)
        except Exception as e:
            traceback.print_exc()
            return self.response_manager.id_not_found_error_response(kwargs['pk']) 
        
    # @require_permissions("manage_house_keeping_logs")
    def list(self, request, *args, **kwargs):
        superuser = (
            request.session["user"]["user_permissions"]["permission_name"]
            == "SUPERUSER"
        )
        filters = {key: value[0] if isinstance(value, list) else value  for key, value in request.query_params.items()}
        
        if superuser:
            queryset = ContainerService.objects.filter(**filters)
        else:
            
            departments = [
                x["department_id"] for x in request.session["user"]["departments"]
            ]
            # FIXME fix the logic of fetching the container service 
            # if user creates the mobile container and does not share it will be visible to all
            filters['department_id__in']=departments
            queryset = ContainerService.objects.filter(**filters).select_related('created_by', 'image')

        serializer = self.get_serializer(queryset, many=True)
        return self.response_manager.get_response(list_data=serializer.data)

        # return super().list(request, args, kwargs)

    # @require_permissions("manage_house_keeping_logs")
    def update(self, request, *args, **kwargs):
        # this container can be updated by the administrator or the owner of this emulator
        superuser = (request.session["user"]["user_permissions"]["permission_name"] == "SUPERUSER")
        try:
            filters = {
                "id":int(kwargs["pk"]),
            }
            if not superuser:
                filters["department_id__in"] = [x['department_id'] for x in request.session["user"]["departments"]]
                # Allow updates if user is the creator OR if the container is shared within the same department
                container_service = ContainerService.objects.filter(**filters).first()
                if not container_service:
                    # Try to find the container without the created_by filter to check if it's shared
                    shared_filters = {
                        "id": int(kwargs["pk"]),
                        "department_id__in": [x['department_id'] for x in request.session["user"]["departments"]],
                        "shared": True
                    } 
                    container_service = ContainerService.objects.filter(**shared_filters).first()
                
                if not container_service:
                    return self.response_manager.can_not_be_updated_response(kwargs["pk"])
            else:
                container_service = ContainerService.objects.get(**filters)
            container_service.save(**(request.data))
            updated_data = self.serializer_class(container_service).data
            
            # Send WebSocket notification for container update
            try:
                # Determine the type of update based on request data
                if 'shared' in request.data:
                    # Shared status update
                    requests.post(f'{get_cometa_socket_url()}/sendAction', json={
                        'type': '[MobileWebSockets] Container Shared Update',
                        'container_id': container_service.id,
                        'shared': request.data['shared']
                    })
                elif 'apk_file' in request.data:
                    # APK file update
                    requests.post(f'{get_cometa_socket_url()}/sendAction', json={
                        'type': '[MobileWebSockets] Container APK Update',
                        'container_id': container_service.id,
                        'apk_file': request.data['apk_file']
                    })
                elif 'apk_file_remove' in request.data:
                    # APK file removal
                    requests.post(f'{get_cometa_socket_url()}/sendAction', json={
                        'type': '[MobileWebSockets] Container APK Update',
                        'container_id': container_service.id,
                        'apk_file': request.data['apk_file']
                    })
                elif 'action' in request.data:
                    # Container action (start, stop, restart)
                    action = request.data['action']
                    if action == 'stop':
                        requests.post(f'{get_cometa_socket_url()}/sendAction', json={
                            'type': '[MobileWebSockets] Container Stopped',
                            'container_id': container_service.id
                        })
                    elif action == 'restart':
                        requests.post(f'{get_cometa_socket_url()}/sendAction', json={
                            'type': '[MobileWebSockets] Container Started',
                            'container_id': container_service.id,
                            'hostname': updated_data.get('hostname')
                        })
                else:
                    # General status update
                    requests.post(f'{get_cometa_socket_url()}/sendAction', json={
                        'type': '[MobileWebSockets] Container Status Update',
                        'containerUpdate': {
                            'container_id': container_service.id,
                            'service_status': updated_data['service_status'],
                            'shared': updated_data['shared'],
                            'hostname': updated_data.get('hostname'),
                            'apk_file': updated_data.get('apk_file', []),
                            'created_by': updated_data['created_by'],
                            'department_id': updated_data['department_id']
                        }
                    })
            except Exception as e:
                logger.error(f"Failed to send WebSocket notification for container update: {str(e)}")
            
            return self.response_manager.updated_response(updated_data)
        except ValidationError as e:
            # Return the specific validation error message
            error_message = str(e.messages[0]) if hasattr(e, 'messages') and e.messages else str(e)
            return JsonResponse({"success": False, "message": error_message}, status=200)
        except Exception as e:
            traceback.print_exc()
            return self.response_manager.can_not_be_updated_response(kwargs["pk"])

    # @require_permissions("manage_house_keeping_logs")
    def create(self, request, *args, **kwargs):
        request.data["created_by"] = request.session["user"]["user_id"]        
        
        # check for container which are in use for more than 3hrs
        in_use_containers = ContainerService.objects.filter(in_use=True, service_type="Browser", since_in_use__lt=datetime.now()-timedelta(hours=3))
        for container in in_use_containers:
            container.delete()
            logger.info(f"Deleted in use container {container.id} to make space for new container")
        
        standby_containers = ContainerService.objects.filter(in_use=False, service_type="Browser").order_by('created_on')
        maximum_standby_containers = int(ConfigurationManager.get_configuration("COMETA_TEST_CONTAINER_MAXIMUM_STANDBY", "2"))
        # Check if the maximum number of containers is reached
        if len(standby_containers) >= maximum_standby_containers:
            for i in range(len(standby_containers)+1-maximum_standby_containers):
                standby_container = standby_containers[i]
                standby_container.delete()
                logger.info(f"Deleted standby container {standby_container.id} to make space for new container")

        total_running_containers = ContainerService.objects.filter(in_use=False, service_type="Browser").count()
        maximum_running_containers = int(ConfigurationManager.get_configuration("COMETA_TEST_CONTAINER_MAXIMUM_RUNNING", "10"))
        # Check if the maximum number of containers is reached
        if total_running_containers > maximum_running_containers:
            return self.response_manager.response(dict_data={"success": False, "message": "Maximum number of containers reached, please wait for some resources to be freed up"})

        response = super().create(request, args, kwargs)
        # Above create method takes some time to create the container, so we need to check again if the maximum number of containers is reached
        # Check again if in between the creation of the container the maximum number of containers is reached by some other thread
        total_running_containers = ContainerService.objects.filter(in_use=False, service_type="Browser").count()
        if total_running_containers > maximum_running_containers:
            logger.error(f"Maximum number of containers reached, deleting container {response.data['id']}")
            container_service = ContainerService.objects.filter(id=response.data['id']).first()
            container_service.delete()
            return self.response_manager.response(dict_data={"success": False, "message": "Maximum number of containers reached, please wait for some resources to be freed up"})

        logger.debug("Container created, Updating socket")

        # Send WebSocket notification for container creation
        try:
            container_data = response.data
            requests.post(f'{get_cometa_socket_url()}/sendAction', json={
                'type': '[MobileWebSockets] Container Status Update',
                'containerUpdate': {
                    'container_id': container_data['id'],
                    'service_status': container_data['service_status'],
                    'shared': container_data['shared'],
                    'hostname': container_data.get('hostname'),
                    'apk_file': container_data.get('apk_file', []),
                    'created_by': container_data['created_by'],
                    'department_id': container_data['department_id']
                }
            })
        except Exception as e:
            logger.error(f"Failed to send WebSocket notification for container creation: {str(e)}")
        
        return response

    def destroy(self, request, *args, **kwargs):
        logger.debug("Container Delete request received")
        try:
            # When deleting Container services from cometa_front is uses id (int) to delete the container,
            # when deleting Container which was started by the behave container it uses container ID (long hash string) to delete the container
            try:
                container = ContainerService.objects.get(id=int(kwargs['pk']))
            except Exception:
                container = ContainerService.objects.get(service_id=kwargs['pk'])
            # Send WebSocket notification for container termination
            try:
                requests.post(f'{get_cometa_socket_url()}/sendAction', json={
                    'type': '[MobileWebSockets] Container Terminated',
                    'container_id': container.id
                })
            except Exception as e:
                logger.error(f"Failed to send WebSocket notification for container termination: {str(e)}")
            
            # Start deletion in background thread
            def delete_container():
                try:
                    container.service_status = "Deleting"
                    container.save()
                    container.delete()
                    logger.debug("Container Deleting by thread")

                except Exception as e:
                    traceback.print_exc()
                    # FIXME send and notification that the container was not deleted
                    # This needs to be done in the cometa_monitorig server
                    logger.error(f"Error deleting container {kwargs['pk']}: {str(e)}")

            # Start the deletion in a background thread
            thread = threading.Thread(target=delete_container)
            thread.daemon = True  # This ensures the thread will be killed when the main program exits
            thread.start()
            logger.debug("Delete Thread Started")
            # Return success response immediately
            logger.debug("Return the response")
            return self.response_manager.deleted_response(id=kwargs['pk'])
        except ContainerService.DoesNotExist:
            return self.response_manager.id_not_found_error_response(kwargs['pk'])
        except Exception as e:
            traceback.print_exc()
            return self.response_manager.can_not_be_deleted_response(kwargs['pk'])
            
            

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
@require_permissions("manage_mobiles")
def emulator_proxy_view(request, emulator_id, remaining_path,*args, **kwargs):
    try:
        user_info = request.session["user"]
        filter_values = {
            "id": emulator_id,
            "service_type": "Emulator",
        }
        # Give permission to all running emulator_container/mobile to the superuser 
        superuser = request.session['user']['user_permissions']['permission_name'] == "SUPERUSER"
        if not superuser:
            departments = [x['department_id'] for x in request.session['user']['departments']]
            filter_values["department_id__in"] = departments

        # Fetch the emulator container information
        emulator_container = ContainerService.objects.filter(**filter_values).first()
        # If the emulator container is not shared and the user trying to access it is neither the creator nor a superuser, revoke access.
        # If the emulator container is shared and the user belongs to the same department as the creator, provide access.

        if not emulator_container or (
            not emulator_container.shared
            and emulator_container.created_by != user_info["user_id"] and not superuser
        ):
            return HttpResponse("Not found", status=404)

        # Prepare target URL based on hostname and path
        hostname = emulator_container.information["Config"]["Hostname"]
        remaining_path = remaining_path.rstrip("/")
        url = f"{request.scheme}://{hostname}:4723/{remaining_path}"

        # Exclude certain headers and add 'Connection: keep-alive'
        headers_to_exclude = ["Host", "X-Forwarded-For", "Content-Length"]
        headers = {
            key: value
            for key, value in request.headers.items()
            if key not in headers_to_exclude
        }
        headers["Connection"] = "keep-alive"

        logger.info(f"REQUEST METHOD: {request.method}")
        logger.info(f"REQUEST URL: {url}")
        logger.info(f"REQUEST HEADERS: {headers}")

        # Log request body for POST, PUT, PATCH methods
        if request.method in ["POST", "PUT", "PATCH"]:
            request_body = request.body
            logger.info(f"REQUEST BODY: {request_body}")
            headers["Content-Length"] = str(
                len(request_body)
            )  # Ensure Content-Length is properly set

        # Send the proxied request and capture response
        try:
            if request.method in ["POST", "PUT", "PATCH"]:
                response = requests.request(
                    request.method,
                    url,
                    headers=headers,
                    data=request.body,
                    params=request.GET,
                    timeout=60,
                )
            else:
                response = requests.request(
                    request.method, url, headers=headers, params=request.GET, timeout=60
                )

            logger.info(f"RESPONSE HEADERS: {response.headers}")
            logger.info(f"RESPONSE Status Code: {response.status_code}")
            logger.info(
                f"RESPONSE BODY (First 500 chars): {response.text[:500]}"
            )  # Log first 500 characters for brevity

            return HttpResponse(
                response.content,
                status=response.status_code,
                content_type=response.headers.get("Content-Type"),
            )

        except requests.Timeout:
            logger.error("Request timed out")
            return JsonResponse({"error": "Request timed out"}, status=504)
        except requests.ConnectionError:
            logger.error("Connection error")
            return JsonResponse(
                {"error": "Failed to connect to the target service"}, status=502
            )
        except requests.RequestException as e:
            logger.error(f"Request failed: {str(e)}")
            return JsonResponse({"error": str(e)}, status=500)

    except Exception as e:
        logger.error(f"Internal server error: {str(e)}")
        return JsonResponse({"error": "Internal server error"}, status=500)


import json
# #########
@csrf_exempt
def get_running_browser(request):
        try:
            response_manager = ResponseManager("ContainerService")
            data = json.loads(request.body)
            
            image_name=data['image_name']
            image_version=data['image_version']
            filters = {'service_type':'Browser', 'image_name': image_name, 'image_version': image_version, 'in_use':False}
            container_service = ContainerService.objects.filter(**filters).first()
            
            # This function is used to centralize the validation create the container service
            def call_create_container_service(data):
                return requests.post(f'{get_cometa_backend_url()}/api/container_service/', json=data)
            
            new_data = data.copy()
            new_data['shared'] = False

            if container_service:
                            
                def create_container_service(data):
                    # Remove labels as this container will be used by some other test excution
                    new_data['labels'] = {}
                    response = call_create_container_service(new_data)
                    if response.status_code == 201:
                        logger.debug("Standby container created")
                    else:
                        logger.error(f"Failed to create standby container: {response.text}")
                    logger.debug("Standby container created")
                    
                logger.debug("Starting a thread to start the standby container")
                # Create a new thread and start it
                thread = Thread(target=create_container_service, args=(data,))
                thread.daemon = True
                thread.start()    
            
                logger.debug("Updating container state to in_use=True")
                container_service.in_use = True
                # Update labels to already running tests
                container_service.labels = data.get("labels",{})
                container_service.save()
                serializer = ContainerServiceSerializer(container_service, many=False)
                return response_manager.get_response(serializer.data)
            
            else:            
                logger.debug("Requested container configuration did not find will use recent one")
                # Start a container with requested configuration
                new_data['in_use'] = True
                response = call_create_container_service(new_data)
                if response.status_code == 201:
                    logger.debug("Standby container created")
                    return response_manager.response(dict_data={"success": True, 
                                                                "message": "Standby container created", 
                                                                'containerservice': response.json()})
                else:
                    logger.error(f"Failed to create standby container: {response.json()}")
                    return response_manager.response(dict_data=response.json())
                
        except Exception as e:
            logger.error(f"Error in get_running_browser: {str(e)}")
            return response_manager.response(dict_data={"success": False, 
                                                        "message": "Error while starting browser, Please contact administrator"})
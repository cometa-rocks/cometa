# Import all models and all the utility methods

from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework import viewsets, mixins

# Django Imports
from django.http import HttpResponse, JsonResponse
from .models import Mobile
from .serializers import MobileSerializer
from backend.utility.response_manager import ResponseManager
from backend.utility.functions import getLogger
from backend.utility.decorators import require_permissions
from backend.utility.config_handler import get_cometa_socket_url
import os, requests, traceback
import time
from datetime import datetime, timedelta
import json
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt


logger = getLogger()


class MobileViewSet(viewsets.ModelViewSet):

    queryset = Mobile.objects.all()
    serializer_class = MobileSerializer
    renderer_classes = (JSONRenderer,)
    response_manager = ResponseManager("Mobile")

    @require_permissions("manage_mobiles")
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, args, kwargs)

    @require_permissions("manage_mobiles")
    def list(self, request, *args, **kwargs):
        filters = {key: value[0] if isinstance(value, list) else value  for key, value in request.query_params.items()}
        mobiles = Mobile.objects.filter(**filters)
        return self.response_manager.get_response(
            list_data=MobileSerializer(mobiles, many=True).data
        )
        # return super().list(request, args, kwargs)

    @require_permissions("manage_mobiles")
    def update(self, request, *args, **kwargs):
        Mobile.objects.all().delete()
        logger.info("Deleted all the mobiles")

        try:
            import subprocess

            # Example of running a simple shell command
            command = (
                "python /opt/code/manage.py loaddata /opt/code/defaults/mobiles.json"
            )
            process = subprocess.run(
                command, shell=True, capture_output=True, text=True
            )

            # Output the result
            logger.info("Output:", process.stdout)
            logger.info("Error:", process.stderr)
            return self.response_manager.updated_response(data={})
        except Exception as e:
            traceback.print_exc()
            logger.error("Exception while updating the")
            return self.response_manager.server_error_response(data={"error": str(e)})


@csrf_exempt
@require_permissions("manage_mobiles")
def parseCometaMobiles(request, *args, **kwargs):
    mobilesFile = '/opt/code/defaults/mobiles.json'
    
    # Check if the file exists
    if not os.path.exists(mobilesFile):
        print(f"File {mobilesFile} doesn't exist, please contact administrator")
        return JsonResponse({'success': False, 'error': 'mobiles.json not found'}, status=503)
    
    # Load JSON data from mobiles.json
    try:
        with open(mobilesFile, 'r') as file:
            mobiles_data = json.load(file)
    except json.JSONDecodeError:
        return JsonResponse({'success': False, 'error': 'mobiles.json contains invalid JSON data'}, status=503)
    
    # Delete all previous mobile objects
    Mobile.objects.all().delete()
    
    # Insert data into the Mobile model
    for entry in mobiles_data:
        model = entry.get("model")
        fields = entry.get("fields", {})
        if model == "mobile.Mobile" and "mobile_json" in fields:
            Mobile.objects.create(
                mobile_id=fields.get("mobile_id"),
                mobile_image_name=fields.get("mobile_image_name"),
                mobile_json=fields.get("mobile_json"),
                capabilities=fields.get("capabilities")
            )
    
    # Notify websockets about the mobile update
    requests.post(f'{get_cometa_socket_url()}/sendAction', json={
        'type': '[Mobiles] Get All'
    })
    
    return JsonResponse({'success': True})

from django.shortcuts import render

# Create your views here.
# Import all models and all the utility methods

from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework import viewsets, mixins

# Django Imports
from .models import Configuration
from .serializers import ConfigurationSerializer
from backend.utility.response_manager import ResponseManager
from backend.utility.functions import getLogger
from backend.utility.decorators import require_permissions
import os
from cometa_pj.settings import CONFIGURATION_FILE_PATH

import traceback, json

logger = getLogger()    
 

class ConfigurationViewSet(viewsets.ModelViewSet):

    queryset = Configuration.objects.all().order_by('configuration_name')
    serializer_class = ConfigurationSerializer
    renderer_classes = (JSONRenderer,)
    response_manager = ResponseManager("Configurations")

    @require_permissions("manage_configurations")
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, args, kwargs)

    @require_permissions("manage_configurations")
    def list(self, request, *args, **kwargs):
        return super().list(request, args, kwargs)

    @require_permissions("manage_configurations")
    def destroy(self, request, *args, **kwargs):
        try:
            configuration = Configuration.objects.get(id=kwargs.get("pk"))
            if configuration.can_be_deleted:
                configuration.delete()
                return self.response_manager.deleted_response(kwargs.get("pk"))
            else:
                return self.response_manager.can_not_be_deleted_response(kwargs.get("pk"))             
        except Exception:
            return self.response_manager.id_not_found_error_response(kwargs.get("pk"))
    
    @require_permissions("manage_configurations")
    def patch(self, request, *args, **kwargs):
        return super().patch(request, args, kwargs)
    
    @require_permissions("manage_configurations")
    def put(self, request, *args, **kwargs):
        return super().put(request, args, kwargs)

    @require_permissions("manage_configurations")
    def create(self, request, *args, **kwargs):
        return super().create(request, args, kwargs)


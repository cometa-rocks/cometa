# author : Anand Kushwaha
# version : 10.0.0
# date : 2024-08-09

from django.shortcuts import render

# Create your views here.
# Import all models and all the utility methods

from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework import viewsets, mixins
from django.http import JsonResponse 
# Django Imports
from .models import Configuration
from .serializers import ConfigurationSerializer
from backend.utility.response_manager import ResponseManager
from backend.utility.functions import getLogger
from backend.utility.decorators import require_permissions
from backend.models import OIDCAccount
import os

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

    # @require_permissions("view_feature")
    def list(self, request, *args, **kwargs):
        # This logic is required to have security over configuration variables,
        # configuration values should be visible based on the user access levels
        user_id = request.session['user']['user_id']
        user = OIDCAccount.objects.filter(user_id=user_id)
        if len(user)==0:
            return super().list(request, args, kwargs)
        user = user[0]
        if user.user_permissions.permission_power >= 80: 
            return super().list(request, args, kwargs)
        
        query_result = self.queryset.filter(configuration_type="all")

        data = self.serializer_class(query_result, many=True).data
        response = {
            "count": len(data),
            "results": data
        }
        return JsonResponse(response, status=200, safe=False)

        

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
        try:
            configuration = Configuration.objects.get(id=kwargs.get("pk"))
            if configuration.can_be_edited:
                return super().patch(request, args, kwargs)
            else:
                return self.response_manager.can_not_be_updated_response(kwargs.get("pk"))             
        except Exception:
            return self.response_manager.id_not_found_error_response(kwargs.get("pk"))

    @require_permissions("manage_configurations")
    def put(self, request, *args, **kwargs):
        try:
            configuration = Configuration.objects.get(id=kwargs.get("pk"))
            if configuration.can_be_edited:
                return super().put(request, args, kwargs)
            else:
                return self.response_manager.can_not_be_updated_response(kwargs.get("pk"))             
        except Exception:
            return self.response_manager.id_not_found_error_response(kwargs.get("pk"))

    @require_permissions("manage_configurations")
    def create(self, request, *args, **kwargs):
        return super().create(request, args, kwargs)


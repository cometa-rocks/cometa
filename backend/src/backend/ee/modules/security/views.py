import json
import traceback

from django.http import JsonResponse
from rest_framework.permissions import AllowAny

from .serializers import ResponseHeadersSerializer
from .models import ResponseHeaders
from rest_framework.viewsets import ModelViewSet
from backend.utility.response_manager import ResponseManager


class ResponseHeadersViewSet(ModelViewSet):
    serializer_class = ResponseHeadersSerializer
    queryset = ResponseHeaders.objects.all()
    response_manager = ResponseManager('ResponseHeaders')

    def retrieve(self, request, *args, **kwargs):
        try:
             # Add department in the filter
            instance = ResponseHeaders.objects.get(result_id=int(kwargs['pk']))
            serializer = self.get_serializer(instance)
            return JsonResponse(serializer.data)
        except Exception as e:
            traceback.print_exc()
            return self.response_manager.validation_error_response({
                'feature_result_id': f"Response Header dose not exists with Id {kwargs['pk']}"
            })

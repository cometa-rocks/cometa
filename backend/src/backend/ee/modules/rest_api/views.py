# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from .serializers import (
    RESTAPISerializer
)
from backend.views import (
    GetUserDepartments,
    logger
)
from .models import REST_API
from rest_framework import viewsets
from rest_framework.renderers import JSONRenderer
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse
import json

class RestAPIViewset(viewsets.ModelViewSet):
    queryset = REST_API.objects.none()
    serializer_class = RESTAPISerializer
    renderer_classes = (JSONRenderer, )

    def list(self, request, *args, **kwargs):
        api_id = kwargs.get('id', None)
        try:
            api = REST_API.objects.get(pk=api_id, department__in=GetUserDepartments(request))
        except REST_API.DoesNotExist:
            return JsonResponse({
                "success": False,
                "error": "API call not found."
            }, status=404)

        data = RESTAPISerializer(api, many=False).data

        return JsonResponse({
            'success': True,
            "result": data
        })

    def create(self, request, *args, **kwargs):
        # get data from request
        data = json.loads(request.body)

        if 'call' not in data:
            return JsonResponse({
                "success": False,
                "error": "Missing 'call' parameter."
            })
        
        if 'department_id' not in data:
            return JsonResponse({
                "success": False,
                "error": "Missing 'department_id' parameter."
            })
        
        api = REST_API(call=data.get('call'), department_id=data.get('department_id'))
        api.save()
        return JsonResponse({
            "success": True,
            "id": api.pk
        }, status=201)

@csrf_exempt
def compileJQ(request):
    data = json.loads(request.body)

    if 'pattern' not in data:
        return JsonResponse({
            "success": False,
            "error": "Missing 'pattern' parameter."
        }, status=400)
    
    if 'content' not in data and 'rest_api' not in data:
        return JsonResponse({
            "success": False,
            "error": "Missing 'content' or 'rest_api' parameter."
        }, status=400)

    if 'rest_api' in data:
        try:
            rest_api = REST_API.objects.get(pk=data.get('rest_api'), department__in=GetUserDepartments(request))
            content = rest_api.call
        except REST_API.DoesNotExist:
            return JsonResponse({
                "success": False,
                "error": "REST API Object not found."
            }, status=404)
    else:
        content = data.get('content')

    pattern = data.get('pattern')
    try:
        content = json.loads(content)
    except Exception as err:
        logger.exception(err)
    
    try:
        import jq
        result = jq.compile(pattern).input_value(content).text()
        return JsonResponse({
            'success': True,
            'result': result
        })
    except Exception as err:
        return JsonResponse({
            'success': False,
            'result': str(err)
        }, status=200)
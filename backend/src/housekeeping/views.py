# Import all models and all the utility methods

from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework import viewsets, filters, generics, status, mixins

# Django Imports
from django.http import JsonResponse
from .models import HouseKeepingLogs
from .serializers import HouseKeepingLogsSerializer
from .house_keeping import HouseKeepingThread
from backend.utility.response_manager import ResponseManager
from backend.utility.functions import getLogger
from backend.utility.decorators import require_permissions

logger = getLogger()


class HouseKeepingViewSet(
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):

    queryset = HouseKeepingLogs.objects.all()
    serializer_class = HouseKeepingLogsSerializer
    # permission_classes = [IsAdminUser]
    renderer_classes = (JSONRenderer,)
    response_manager = ResponseManager("HouseKeepingLog")

    @require_permissions("manage_house_keeping_logs")
    def retrieve(self, request, *args, **kwargs):
        return super().retrieve(request, args, kwargs)

    @require_permissions("manage_house_keeping_logs")
    def list(self, request, *args, **kwargs):
        # house_keeping_logs = HouseKeepingLogs.objects.defer('house_keeping_logs').all()
        house_keeping_logs = HouseKeepingLogs.objects.values(
            "id", "created_on", "success", "approved_by_id"
        ).order_by("-created_on")[:20]
        serializer = self.serializer_class(house_keeping_logs, many=True)
        return self.response_manager.get_response(list_data=serializer.data)

    @require_permissions("manage_house_keeping_logs")
    def delete(self, request, *args, **kwargs):
        # Creating house keeping logs object, ID will pass with response and housekeeping will continue with new thread,
        # Logs will be updated with in database for future reference 
        house_keeping_logs = HouseKeepingLogs()
        house_keeping_logs.save()
        try:
            logger.debug("Started housekeeping")
            house_keeping_thread = HouseKeepingThread(house_keeping_logs)
            house_keeping_thread.start()
            logger.debug("Thread started and processing")
            response = self.response_manager.response(
                {
                    "success": house_keeping_thread.is_alive(),
                    "logs_id": house_keeping_logs.id,
                }
            )
            logger.debug("Finished housekeeping")
        except Exception as exception:
            logger.debug(f'Housekeeping ended with error "{str(exception)}"')
            response = JsonResponse({"success": False, "exception":str(exception)}, status=500)
        return response

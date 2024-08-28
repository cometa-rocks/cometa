# Import all models and all the utility methods

from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework import viewsets, mixins

# Django Imports
from django.http import JsonResponse
from .models import HouseKeepingLogs
from .serializers import HouseKeepingLogsSerializer
from .house_keeping import HouseKeepingThread
from backend.utility.response_manager import ResponseManager
from backend.utility.functions import getLogger
from backend.utility.decorators import require_permissions
logger = getLogger()

    
import os
import time
from datetime import datetime, timedelta
    

class HouseKeepingViewSet(
    mixins.RetrieveModelMixin,
    mixins.DestroyModelMixin,
    viewsets.GenericViewSet,
):

    queryset = HouseKeepingLogs.objects.all()
    serializer_class = HouseKeepingLogsSerializer
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



    # @require_permissions("manage_house_keeping_logs")
    # def patch(self, request, *args, **kwargs):
        
    #     try:
    #     # Example usage
    #         directory = "/code/behave/department_data"
    #         days = 0.1  # Files older than 30 days will be deleted
    #         # Calculate the threshold time
    #         threshold_time = time.time() - (days * 86400)  # 86400 seconds in a day
    #         logger.debug(os.walk(directory))
    #         for root, dirs, files in os.walk(directory):
    #             logger.debug(root)
    #             logger.debug(dirs)
    #             logger.debug(files)
    #             for file in files:
    #                 file_path = os.path.join(root, file)
                 
    #                 # Get the file's creation time
    #                 if os.path.exists(file_path):
                     
    #                     creation_time = os.path.getctime(file_path)
    #                     dt_object = datetime.fromtimestamp(creation_time)
    #                     logger.debug(f"CT : {dt_object} Checking for file path {file_path}")
    #                     # Compare the file's creation time with the threshold time
    #                     if creation_time < threshold_time:
    #                         try:
    #                             # os.remove(file_path)
    #                             print(f"Deleted {file_path}")
    #                         except Exception as e:
    #                             print(f"Error deleting {file_path}: {e}")
                            
    #         response = JsonResponse({"success": True}, status=200)
            
    #     except Exception as exception:
    #         logger.debug(f'Housekeeping ended with error "{str(exception)}"')
    #         response = JsonResponse({"success": False, "exception":str(exception)}, status=500)
    #     return response

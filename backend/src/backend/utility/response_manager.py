import traceback

from django.http import JsonResponse
from rest_framework import status
from django.core.exceptions import ValidationError
from cometa_pj.settings import DEBUG

# This class used to provide simmiler structure while sending response.
class ResponseManager:

    def __init__(self, app_name: str):
        self.__app_name = app_name

    def json_decode_error_response(self, error_message=None):
        data = dict()
        data['success'] = False
        data["message"] = "Json decoding error"
        if error_message is not None:
            data['error_message'] = str(error_message)
        return JsonResponse(data,
                            status=status.HTTP_400_BAD_REQUEST)

    def validation_error_response(self, error_data=None):
        data = dict()
        data["message"] = "Validation Error"
        data["success"] = False
        if error_data is not None:
            data["errors"] = error_data
        return JsonResponse(data, status=status.HTTP_422_UNPROCESSABLE_ENTITY)

    def id_not_found_error_response(self, id, app_name=None):
        data = dict()
        data['success'] = False
        data["errors"] = f"{app_name if app_name is not None else self.__app_name} with id {id} dose not exist"
        return JsonResponse(data, status=status.HTTP_400_BAD_REQUEST)

    def user_not_found_error_response(self, id, app_name=None):
        data = dict()
        data['success'] = False
        data["errors"] = f"{app_name if app_name is not None else self.__app_name} with username {id} dose not exist"
        return JsonResponse(data, status=status.HTTP_400_BAD_REQUEST)

    def already_exists_response(self, field, value, app_name=None):
        data = dict()
        data['success'] = False
        data["errors"] = {
            field: [
                f'{app_name if app_name is not None else self.__app_name} {value} already exists'
            ]
        }

        return JsonResponse(data, status=status.HTTP_400_BAD_REQUEST)

    def created_response(self, data):
        return JsonResponse({
            "success": True,
            'Result': f"{self.__app_name} Created", self.__app_name.lower(): data, "module": self.__app_name},
            status=status.HTTP_201_CREATED)

    def updated_response(self, data):
        return JsonResponse({
            "success": True,
            'Result': f"{self.__app_name} Updated", self.__app_name.lower(): data, "module": self.__app_name},
            status=status.HTTP_201_CREATED)

    def deleted_response(self, id):
        return JsonResponse(
            {
                "success": True,
                "message": f"{self.__app_name} with id '{id}' deleted"
            }, status=status.HTTP_200_OK)

    def deleted_response_with_count(self, count, app_name=None):
        return JsonResponse(
            {
                "success": True,
                "message": f"{count} {app_name if app_name is not None else self.__app_name} deleted"
            }, status=status.HTTP_200_OK)

    def get_response(self, dict_data: dict = None, list_data: list = None):
        if dict_data is not None:
            return JsonResponse({self.__app_name.lower(): dict_data},
                                status=status.HTTP_200_OK)
        else:
            return JsonResponse({self.__app_name.lower() + 's': list_data},
                                status=status.HTTP_200_OK)

    def response(self, dict_data: dict = None, list_data: list = None):
        if dict_data is not None:
            return JsonResponse(dict_data, status=status.HTTP_200_OK)
        else:
            return JsonResponse(list_data, status=status.HTTP_200_OK)

    def server_error_response(self, exception: Exception = None):

        if isinstance(exception, ValidationError):
            return self.validation_error_response(str(exception))
        traceback.print_exc()
        data = dict()
        data['success'] = False
        data["error"] = "Exception while processing your request"
        data["message"] = "Internal Server Error"
        if DEBUG:
            data["module"] = self.__app_name

        if exception is not None and DEBUG:
            data['exception'] = str(exception)
        else:
            data['exception'] = "Please ask site admin to resolve this issue"
        return JsonResponse(data, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from threading import Thread
from django.http import JsonResponse
from backend.models import Department, Feature_result
from backend.utility.classes import LogCommand


# This class is responsible to select all files which should be delete based on it's department day's policy
class FileSelector(LogCommand):
    def __init__(self):
        pass

    def select_files(self, kwargs):
        self.__logs.append()
        departments_housekeeping_enabled = []
        departments_housekeeping_enabled = Department.objects.filter(
            settings__result_expire_days__gt=0
        )
        # Get the list of department ID's
        departments_housekeeping_enabled_ids = [department.department_id for department in departments_housekeeping_enabled]

        self.log("============================================")
        self.log(f"{len(departments_housekeeping_enabled)} departments with expire days configured" )
        self.log("============================================")
        
        feature_results = Feature_result.objects.filter(department_id__in=departments_housekeeping_enabled_ids, archived=False)
        print(feature_results)
            
        pass


class HouseKeepingThread(Thread, FileSelector):

    def __init__(self) -> None:
        pass

    def run():
        pass


def start_cleaning(request):
    try:
        house_keeping_thread = HouseKeepingThread()
        house_keeping_thread.run()
        response = JsonResponse({"success": house_keeping_thread.is_alive}, status=200)

    except Exception as exception:
        response = JsonResponse({"success": False}, status=500)
    return response

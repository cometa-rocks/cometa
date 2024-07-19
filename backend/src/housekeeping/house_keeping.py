from threading import Thread
from django.http import JsonResponse
from backend.models import Department, Feature_result, Step_result
from backend.utility.classes import LogCommand
from datetime import datetime, timedelta
from .models import HouseKeepingLogs
import os, json
import traceback
from backend.utility.functions import getLogger

logger = getLogger()

# This class is responsible to select all files which should be delete based on it's department day's policy
class HouseKeepingThread(LogCommand, Thread):
    screenshot_file_path = "/code/behave/screenshots"
    video_directory_path = "/code/behave"
    pdf_report_file_path = "/code/behave/pdf"

    def __init__(self, house_keeping_logs: HouseKeepingLogs):
        Thread.__init__(self)
        LogCommand.__init__(self)
        
        self.house_keeping_logs = house_keeping_logs
        

    def __delete_video_file_if_exists(self, result: Feature_result):
        try:
            # Delete video
            if result.video_url is None or result.video_url.strip()=="":
                return False

            videoPath = f"{self.video_directory_path}{result.video_url}"
            if os.path.isfile(videoPath):
                self.log(f"{videoPath} file exists", spacing=3)
                # os.remove(videoPath)
                self.log(f"{videoPath} file deleted", spacing=3)
                return True
            else:
                self.log(
                    f"Video path {result.video_url} is defined but file doesn't exist",
                    type="warning",
                    spacing=3,
                )
                self.log(
                    f"Complete Video file path {videoPath}",
                    type="warning",
                    spacing=3,
                )
                return False
        
        except Exception as exception:
            self.log(
                f'Exception occurred while deleting video file  "{result.video_url}", Error Message: {traceback.format_exc()}',
                type="error",
                spacing=3,
            )
            return False
        
        
    # PDF file name is stored with Feature_results 
    # This change is introduced on 16-07-2024
    def __delete_pdf_file_if_exists(self, result: Feature_result):
        try:
            # Delete pdf file
            if result.pdf_result_file_path is None or result.pdf_result_file_path.strip()=="":
                return False

            pdf_file_path = f"{self.pdf_report_file_path}/{result.pdf_result_file_path}"
            if os.path.isfile(pdf_file_path):
                self.log(f"{pdf_file_path} file exists", spacing=3)
                # os.remove(videoPath)
                self.log(f"{pdf_file_path} file deleted", spacing=3)
                return True
            else:
                self.log(
                    f"PDF report file path {result.video_url} is defined but file doesn't exist",
                    type="warning",
                    spacing=3,
                )
                self.log(
                    f"Complete PDF report file path {pdf_file_path}",
                    type="warning",
                    spacing=3,
                )
                return False
            
        except Exception as exception:
            self.log(
                f'Exception occurred while deleting PDF report file  "{result.video_url}", Error Message: {traceback.format_exc()}',
                type="error",
                spacing=3,
            )
            return False
        

    def __delete_screenshot_file_if_exists(self, step_result: Step_result):
        # dirPath = '/code/behave/screenshots/%d/%d/%d/' % (featureId, featureRunId, featureResultId)
        try:
            # screenshot = os.path.join(self.screenshot_file_path,featureId, featureRunId, featureResultId)
            current_screenshot = os.path.join(
                self.screenshot_file_path, step_result.screenshot_current
            )

            if step_result.screenshot_current and os.path.isfile(current_screenshot):
                # self.log(f'{current_screenshot} file exists', spacing=3)
                # os.remove(current_screenshot)
                self.log(f"{current_screenshot} file deleted", spacing=3)
                return True
            else:
                self.log(
                    f"Video path {step_result.screenshot_current} is defined but file doesn't exist",
                    type="warning",
                    spacing=3,
                )
                return False

        except Exception as exception:
            self.log(
                f'Exception occurred while deleting video file  "{step_result.screenshot_current}", Error Message: {traceback.format_exc()}',
                type="error",
                spacing=3,
            )

    def filter_and_delete_files(self):
        housekeeping_enabled_departments = []
        housekeeping_enabled_departments = Department.objects.filter(
            settings__result_expire_days__gt=0
        )
        # Get the list of department ID's
        # departments_housekeeping_enabled_ids = [department.department_id for department in housekeeping_enabled_departments]
        self.log("============================================")
        self.log(
            f"{len(housekeeping_enabled_departments)} departments with expire days configured"
        )
        self.log("============================================")
        for department in housekeeping_enabled_departments:
            # Handle any error that comes while deleting files
            self.log(
                f"Cleaning files in department [ID:{department.department_id}] [NAME:{department.department_name}]",
                spacing=1,
            )
            # Calculate the date and time n days ago
            date_time_department_days_ago = datetime.now() - timedelta(days=1)
            try:
                feature_results_with_in_department = Feature_result.objects.filter(
                    department_id=department.department_id,
                    result_date__lt=date_time_department_days_ago,
                    house_keeping_done=False,
                    archived=False,
                ).order_by("result_date")
                self.log(
                    f"Found {len(feature_results_with_in_department)} Feature_Result video in department to clean",
                    spacing=1,
                )
                for feature_result in feature_results_with_in_department:
                    self.log(
                        f"Cleaning Feature_Result [ID:{feature_result.feature_result_id}] [FeatureID:{feature_result.feature_id}]",
                        spacing=2,
                    )
                    self.__delete_video_file_if_exists(feature_result)
                    self.__delete_pdf_file_if_exists(feature_result)
                    # Clean Step result screen shots
                    step_results = Step_result.objects.filter(
                        feature_result_id=feature_result.feature_result_id
                    ).exclude(screenshot_current="")
                    self.log(
                        f"Found {len(step_results)} Step_result screenshots in Feature_Result [ID:{feature_result.feature_result_id}] to clean",
                        spacing=2,
                    )

                    self.log("Deleting Step_results", spacing=3)
                    for step_result in step_results:
                        self.__delete_screenshot_file_if_exists(step_result)
                        pass

                    self.log(f"Deleted {len(step_results)} screenshots", spacing=3)
                    feature_result.house_keeping_done = True
                    feature_result.save()


            except Exception as exception:
                self.log(exception)

    def run(self):
        logger.debug("Started selecting files for cleanup ")
        try:
            self.filter_and_delete_files()
            self.house_keeping_logs.success = True
        except Exception as e:
            self.house_keeping_logs.success = False
            self.log(f"Exception while doing housekeeping {str(e)}")
        # Saving logs in database for future references, can be seen in the django admin
        self.house_keeping_logs.house_keeping_logs = self.get_logs()
        self.house_keeping_logs.save()
        logger.debug("housekeeping logs saved")
        
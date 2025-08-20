# author : Anand Kushwaha
# version : 10.0.1
# date : 2024-07-11

#CHANGELOG:
# 10.0.1:
# - Added native Django API for clearing sessions (clear_django_sessions)
# - Added native Django API for vacuuming PostgreSQL django_session table (vacuum_postgres_django_sessions)

import sys
from threading import Thread
from django.http import JsonResponse
from backend.models import Department, Feature_result, Step_result
from backend.utility.classes import LogCommand
from datetime import datetime, timedelta
from .models import HouseKeepingLogs
from modules.container_service.models import ContainerService
import os, json
import traceback
from backend.utility.functions import getLogger
from django.utils import timezone
from dateutil.relativedelta import relativedelta
from django.core.management import call_command

import subprocess
logger = getLogger()

# This class is responsible to select all files which should be delete based on it's department day's policy
class HouseKeepingThread(LogCommand, Thread):
    screenshot_file_path = "/data/screenshots"
    video_directory_path = "/data/videos"
    pdf_report_file_path = "/code/behave/pdf"

    def __init__(self, house_keeping_logs: HouseKeepingLogs):
        Thread.__init__(self)
        LogCommand.__init__(self)
        
        self.house_keeping_logs = house_keeping_logs
        
    def clear_django_sessions(self):
        """
        Clear Django sessions using native Django API (no subprocess)
        """
        
        try:
            self.log("============================================")
            self.log("Starting Django sessions cleanup")
            self.log("============================================")

            call_command("clearsessions")

            self.log("Django clearsessions completed successfully (native)")
            return True
        except Exception as e:
            self.log(f"Exception while clearing Django sessions: {str(e)}", type="error", spacing=1)
            self.log(f"Traceback: {traceback.format_exc()}", type="error", spacing=2)
            return False

    def vacuum_postgres_django_sessions(self):
        """
        Run VACUUM on django_session table in PostgreSQL database
        """
        try:
            self.log("============================================")
            self.log("Starting PostgreSQL VACUUM on django_session table")
            self.log("============================================")
            
            from django.db import connection

            with connection.cursor() as cursor:
                cursor.execute("VACUUM django_session;")
            
            self.log("PostgreSQL VACUUM completed successfully")
            return True
        
        except Exception as exception:
            self.log(f"Exception occurred while vacuuming PostgreSQL django_session table: {str(exception)}")
            return False
        
    # This method will check for video and delete the file if exists
    def __delete_video_file_if_exists(self, result: Feature_result):
        video_files = []
        
        # Delete video
        if result.video_url is not None and result.video_url.strip()!="":
            video_files.append(result.video_url.split("/")[-1])


        for mobile in result.mobile:
            video_url = mobile.get("video_recording", False)
            
            if video_url and video_url.strip()!="":
                video_files.append(video_url.split("/")[-1])
        
        
        for video in video_files:  
            videoPath = f"{self.video_directory_path}/{video}"
            try: 
                if os.path.isfile(videoPath):
                    self.log(f"{videoPath} file exists", spacing=3)
                    os.remove(videoPath)
                    self.log(f"{videoPath} file deleted", spacing=3)
                    
                else:
                    self.log(
                        f"Video path {videoPath} is defined but file doesn't exist",
                        type="warning",
                        spacing=3,
                    )
                    self.log(
                        f"Complete video file path {videoPath}",
                        type="warning",
                        spacing=3,
                    )
                return True
            except Exception as exception:
                self.log(
                    f'Exception occurred while deleting video file  "{videoPath}", Error Message: {traceback.format_exc()}',
                    type="error",
                    spacing=3,
                )
                return False
        
    # PDF file name is stored with Feature_results 
    # This change is introduced on 16-07-2024
    def __delete_pdf_file_if_exists(self, result: Feature_result, ):
        pdf_result_file_path = ""
        # Delete pdf file
        if result.pdf_result_file_path is None or result.pdf_result_file_path.strip()=="":
            pdf_result_file_path = f"{result.feature_id.feature_name}-{result.feature_result_id}.pdf"                
        else:
            pdf_result_file_path = result.pdf_result_file_path

        try:
            pdf_file_full_path = f"{self.pdf_report_file_path}/{pdf_result_file_path}"
            if os.path.isfile(pdf_file_full_path):
                self.log(f"{pdf_file_full_path} file exists", spacing=3)
                os.remove(pdf_file_full_path)
                self.log(f"{pdf_file_full_path} file deleted", spacing=3)
            else:
                self.log(
                        f"PDF report file doesn't exist",
                        type="warning",
                        spacing=3,
                    )
                self.log(
                    f"Complete PDF report file path {pdf_file_full_path}",
                    type="warning",
                    spacing=3,
                )
            return True
            
        except Exception as exception:
            self.log(
                f'Exception occurred while deleting PDF report file  "{pdf_result_file_path}", Error Message: {traceback.format_exc()}',
                type="error",
                spacing=3,
            )
            return False
        
    # This method will check for screenshots and delete the file they exists
    def __delete_screenshot_file_if_exists(self, step_result: Step_result):
        current_screenshot = os.path.join(
                self.screenshot_file_path, step_result.screenshot_current
            )
        try:

            if step_result.screenshot_current and os.path.isfile(current_screenshot):
                os.remove(current_screenshot)
                self.log(f"{current_screenshot} file deleted", spacing=3)
            else:
                self.log(
                    f"Screenshot path {step_result.screenshot_current} is defined but file doesn't exist",
                    type="warning",
                    spacing=3,
                )
            return True

        except Exception as exception:
            self.log(
                f'Exception occurred while deleting video file  "{current_screenshot}", Error Message: {traceback.format_exc()}',
                type="error",
                spacing=3,
            )
            return False

    def filter_and_delete_files(self):
        housekeeping_enabled_departments = []
        # Get the list of department ID's
        housekeeping_enabled_departments = Department.objects.filter(
            settings__result_expire_days__gt=0
        )
        
        self.log("============================================")
        self.log(f"Found {len(housekeeping_enabled_departments)} departments with expire days configured")
        for department in housekeeping_enabled_departments:
            self.log(
                f"""Department ID: {department.department_id}\t Name: {department.department_name}, 
                \t Result Expire Days: {department.settings["result_expire_days"]}""",
                spacing=1,
                )

        self.log("============================================")
        self.log("\n")
        for department in housekeeping_enabled_departments:
            self.log(
                f"Cleaning files in department [ID: {department.department_id}] [NAME: {department.department_name}]",
                spacing=1,
            )
            # Calculate the date and time n days ago
            date_time_department_days_ago = datetime.now() - timedelta(days=department.settings['result_expire_days'])

            # Handle any error that comes while deleting files
            try:
                feature_results_with_in_department = Feature_result.objects.filter(
                    department_id=department.department_id,
                    result_date__lt=date_time_department_days_ago,
                    house_keeping_done=False,
                    archived=False,
                ).order_by("result_date")
                self.log(
                    f"Found {len(feature_results_with_in_department)} Feature_Result to clean",
                    spacing=1,
                )
                for feature_result in feature_results_with_in_department:
                    house_keeping_done = True
                    self.log(
                        f"Cleaning Feature_Result [ID: {feature_result.feature_result_id}] [FeatureID: {feature_result.feature_id}]",
                        spacing=2,
                    )
                    if not self.__delete_video_file_if_exists(feature_result):
                        house_keeping_done = False
                    if not self.__delete_pdf_file_if_exists(feature_result):
                        house_keeping_done = False
                        
                    # Clean Step result screen shots
                    step_results = Step_result.objects.filter(
                        feature_result_id=feature_result.feature_result_id
                    ).exclude(screenshot_current="")
                    self.log(
                        f"Found {len(step_results)} Step_result screenshots in Feature_Result [ID: {feature_result.feature_result_id}] to clean",
                        spacing=2,
                    )

                    self.log("Cleaning Step_results", spacing=3)
                    for step_result in step_results:
                        if not self.__delete_screenshot_file_if_exists(step_result):
                            house_keeping_done = False
                    self.log(f"Cleaned {len(step_results)} screenshots", spacing=3)

                    if house_keeping_done:
                        feature_result.house_keeping_done = house_keeping_done
                        feature_result.save()
                    else:
                        self.log(
                            f"Feature_Result [ID: {feature_result.feature_result_id}] [FeatureID: {feature_result.feature_id}] not cleaned, will retry again",
                            spacing=2,
                        )

            except Exception as exception:
                self.log(exception)

    def check_container_service_and_clean(self):
        # Get containers that are in use and created 3 hours ago
        three_hours_ago = timezone.now() - timedelta(hours=3)
        
        # Filter for the containers which are use
        container_services_to_clean = ContainerService.objects.filter(
            in_use=True,
            created_on__lte=three_hours_ago,
            service_type="Browser"
        )
        
        self.log("============================================")
        self.log(f"Found {len(container_services_to_clean)} container to clean")
        self.log("============================================")
        for container in container_services_to_clean:
            try:
                container_id = container.id
                self.log(f"""Deleting Container ID: {container.id}, Image: {container.image_name}:{container.image_version}, Type:  {container.service_type}, Created At : {container.created_on} """,
                    spacing=1)
                container.delete()
                self.log(f"""Deleted Container ID: {container_id}""",
                    spacing=1)
            except Exception as exception:
                self.log(exception)

    def run(self):
        logger.debug("Started selecting files for cleanup ")
        count_six_month_previous_logs = 0
        try:
            self.filter_and_delete_files()
            self.check_container_service_and_clean()
            self.clear_django_sessions()
            self.vacuum_postgres_django_sessions()
            self.house_keeping_logs.success = True
            
            # Delete the Housekeeping logs itself when its 6 month older
            six_months_ago = datetime.now() - timedelta(days=30.5*6)
            six_month_old_records = HouseKeepingLogs.objects.filter(created_on__lt=six_months_ago)
            count_six_month_previous_logs  = len(six_month_old_records)
            six_month_old_records.delete()
            self.log(f"Deleted {count_six_month_previous_logs} Housekeeping logs from DB")
        except Exception as e:
            self.house_keeping_logs.success = False
            self.log(f"Exception while doing housekeeping {str(e)}")
        # Saving logs in database for future references, can be seen in the django admin
           
 
        self.log("Saving logs in the database")
        self.house_keeping_logs.house_keeping_logs = self.get_logs()
        self.house_keeping_logs.save()
        
        logger.debug("housekeeping logs saved")
    
        
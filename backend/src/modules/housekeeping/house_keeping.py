# author : Anand Kushwaha
# version : 10.0.11
# date : 2024-07-11

#CHANGELOG:
# 10.0.11:
# - Added native Django API for clearing sessions (clear_django_sessions)
# - Added native Django API for vacuuming PostgreSQL django_session table (vacuum_postgres_django_sessions)
# - Improved deletion logic for video, pdf, screenshot files - no longer looks for already deleted item 
import sys
from threading import Thread
from django.http import JsonResponse
from backend.models import Department, Feature_result, Step_result, Feature, Browser
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
from django.db import transaction
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

            self.log("Django clearsessions completed successfully")
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
    
    def update_outdated_browser_from_features(self):
        """
        For each feature browser config:
          - If exact name+version exists in DB: keep.
          - Else if name exists in DB: set version to 'latest'.
          - Else (name not found): replace name with first available DB browser and set version to 'latest'.
        """
        self.log("============================================")
        self.log("Starting outdated browser update in features")
        self.log("============================================")

        # Normalizes strings
        def _norm(s):
            return (s or "").strip().lower()

        # Load DB browsers once and make lookups fast
        available_browsers_qs = Browser.objects.all().order_by("pk")
        available_browsers_list = list(available_browsers_qs)

        if not available_browsers_list:
            self.log("No browsers available in database; nothing will be changed.", type="warning")
            return

        # fast lookups
        # exact_set: "name|version" presence - exact match
        # names_set: "name" presence - name match
        exact_set = set() 
        names_set = set()
        # first_browser_json: first available browser json (in case browser name not found, assign first available browser)
        first_browser_json = None

        for browser in available_browsers_list:
            browser_json = (getattr(browser, "browser_json", None) or {})
            name = _norm(browser_json.get("browser"))
            version  = (browser_json.get("browser_version") or "").strip()
            if not name:
                continue

            # Add name to names_set
            names_set.add(name)

            # Add name|version to exact_set if version is present
            if version:
                exact_set.add(f"{name}|{version}")

            # Assign first available browser json if not assigned yet
            if first_browser_json is None:
                first_browser_json = browser_json

        if first_browser_json is None:
            self.log("No valid browser entries (missing names); nothing will be changed.", type="warning")
            return

        # Set fallback browser in case browser name not found
        fallback_name = first_browser_json.get("browser") 
        fallback_version = "latest"

        # Process features
        features_qs = Feature.objects.all()
        total_features = features_qs.count()
        self.log(f"Processing {total_features} features")

        updated_features = 0
        total_browsers_updated = 0

        @transaction.atomic
        def _run():

            # makes it so inner function can access outer function variables
            nonlocal updated_features, total_browsers_updated

            for feature in features_qs:
                selected_browsers = getattr(feature, "browsers", None)
                if not selected_browsers:
                    self.log(f"Feature {feature.feature_name} has no browsers configured, skipping", spacing=1)
                    continue

                changed = False
                new_selected_browsers = []

                for browser in selected_browsers:
                    name = _norm(browser.get("browser"))
                    version_raw = (browser.get("browser_version") or "").strip()
                    version_lc  = version_raw.lower()

                    # already 'latest' and name exists -> no action
                    if version_lc == "latest" and name in names_set:
                        new_selected_browsers.append(browser)
                        continue

                    # exact name+version exists -> no action
                    if version_raw and f"{name}|{version_raw}" in exact_set:
                        new_selected_browsers.append(browser)
                        continue

                    # name exists but version outdated/missing -> set to 'latest'
                    if name in names_set:
                        if version_lc != "latest":
                            updated_browser = dict(browser)
                            updated_browser["browser_version"] = "latest"
                            new_selected_browsers.append(updated_browser)
                            changed = True
                            total_browsers_updated += 1
                            self.log(f"Updated {browser.get('browser')} {version_raw or '(none)'} → latest", spacing=2)
                        else:
                            new_selected_browsers.append(browser)
                        continue

                    # name not found -> replace with first available + 'latest'
                    updated_browser = dict(browser)
                    updated_browser["browser"] = fallback_name
                    updated_browser["browser_version"] = fallback_version
                    new_selected_browsers.append(updated_browser)
                    changed = True
                    total_browsers_updated += 1
                    self.log(
                        f"Browser '{browser.get('browser')}' not found. Using fallback: {fallback_name} latest",
                        spacing=2
                    )

                if changed:
                    feature.browsers = new_selected_browsers
                    try:
                        feature.save(dontSaveSteps=True, backup_feature_info=True)
                        updated_features += 1
                        self.log(f"Feature {feature.feature_name} updated successfully", spacing=1)
                    except Exception as e:
                        self.log(f"Error saving feature {feature.feature_name}: {str(e)}", type="error", spacing=1)
                else:
                    self.log(f"Feature {feature.feature_name} doesn't require updates", spacing=1)

        _run()

        # Summary
        self.log("============================================")
        self.log("Browser update completed:")
        self.log(f"- Features processed: {total_features}")
        self.log(f"- Features updated: {updated_features}")
        self.log(f"- Browsers updated: {total_browsers_updated}")
        self.log("============================================")

    
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
        
        # If no video files exist, return True (just means nothing to delete)
        if not video_files:
            return True
        
        # Track if any deletion operations fail
        deletion_success = True
        
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
                                        
            except Exception as exception:
                self.log(
                    f'Exception occurred while deleting video file  "{videoPath}", Error Message: {traceback.format_exc()}',
                    type="error",
                    spacing=3,
                )
                deletion_success = False
        
        return deletion_success
        
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
                return True
            else:
                # File doesn't exist
                self.log(
                    f"PDF file already clean: {pdf_file_full_path}",
                    type="info",
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
        # Skip if no screenshot path is defined
        if not step_result.screenshot_current or step_result.screenshot_current.strip() == "":
            return True
            
        current_screenshot = os.path.join(
                self.screenshot_file_path, step_result.screenshot_current
            )
        try:

            if os.path.isfile(current_screenshot):
                os.remove(current_screenshot)
                self.log(f"{current_screenshot} file deleted", spacing=3)
                return True
            else:
                # File doesn't exist
                self.log(
                    f"Screenshot already clean: {step_result.screenshot_current}",
                    type="info",
                    spacing=3,
                )
                return True

        except Exception as exception:
            self.log(
                f'Exception occurred while deleting screenshot file  "{current_screenshot}", Error Message: {traceback.format_exc()}',
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
            date_time_department_days_ago = timezone.now() - timedelta(days=department.settings['result_expire_days'])

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
                
                # Track cleanup statistics
                total_processed = 0
                successfully_cleaned = 0
                failed_cleanup = 0
                max_retries_exceeded = 0
                
                for feature_result in feature_results_with_in_department:
                    total_processed += 1
                    retry_count = getattr(feature_result, 'housekeeping_retry_count', 0)
                    max_retries = 3  # Maximum number of retry attempts
                    
                    self.log(
                        f"Cleaning Feature_Result [ID: {feature_result.feature_result_id}] [FeatureID: {feature_result.feature_id}] (Retry: {retry_count}/{max_retries})",
                        spacing=2,
                    )
                    
                    # Check if we've exceeded max retries
                    if retry_count >= max_retries:
                        self.log(
                            f"Feature_Result [ID: {feature_result.feature_result_id}] exceeded max retries ({max_retries}), marking as cleaned",
                            type="warning",
                            spacing=2,
                        )
                        feature_result.house_keeping_done = True
                        feature_result.save()
                        max_retries_exceeded += 1
                        continue
                    
                    # Track individual operation results
                    video_clean = self.__delete_video_file_if_exists(feature_result)
                    pdf_clean = self.__delete_pdf_file_if_exists(feature_result)
                    
                    # Clean Step result screen shots
                    step_results = Step_result.objects.filter(
                        feature_result_id=feature_result.feature_result_id
                    ).exclude(screenshot_current="")
                    self.log(
                        f"Found {len(step_results)} Step_result screenshots in Feature_Result [ID: {feature_result.feature_result_id}] to clean",
                        spacing=2,
                    )

                    self.log("Cleaning Step_results", spacing=3)
                    screenshot_clean = True
                    for step_result in step_results:
                        if not self.__delete_screenshot_file_if_exists(step_result):
                            screenshot_clean = False
                    self.log(f"Cleaned {len(step_results)} screenshots", spacing=3)

                    # Determine if housekeeping was successful
                    # Consider it successful if all operations completed (even if files didn't exist)
                    if video_clean and pdf_clean and screenshot_clean:
                        feature_result.house_keeping_done = True
                        # Reset retry count on success
                        if hasattr(feature_result, 'housekeeping_retry_count'):
                            feature_result.housekeeping_retry_count = 0
                        feature_result.save()
                        successfully_cleaned += 1
                        self.log(
                            f"Feature_Result [ID: {feature_result.feature_result_id}] successfully cleaned",
                            spacing=2,
                        )
                    else:
                        # Increment retry count
                        feature_result.housekeeping_retry_count = retry_count + 1
                        feature_result.save()
                        failed_cleanup += 1
                        self.log(
                            f"Feature_Result [ID: {feature_result.feature_result_id}] [FeatureID: {feature_result.feature_id}] not cleaned, will retry again (Retry: {feature_result.housekeeping_retry_count}/{max_retries})",
                            spacing=2,
                        )
                
                # Log cleanup summary for this department
                self.log(
                    f"Department {department.department_name} cleanup summary: {total_processed} processed, {successfully_cleaned} cleaned, {failed_cleanup} failed, {max_retries_exceeded} max retries exceeded",
                    spacing=1,
                )

            except Exception as exception:
                self.log(f"Error processing department {department.department_name}: {str(exception)}", type="error", spacing=1)
                self.log(f"Traceback: {traceback.format_exc()}", type="error", spacing=2)
                continue  # Continue with next department instead of failing completely

    def check_container_service_and_clean(self):
        # Get containers that are in use and created 3 hours ago
        three_hours_ago = timezone.now() - timedelta(hours=3)
        
        # Filter for the containers which are use
        container_services_to_clean = ContainerService.objects.filter(
            in_use=True,
            since_in_use__lte=three_hours_ago,
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
            six_months_ago = timezone.now() - timedelta(days=30.5*6)
            six_month_old_records = HouseKeepingLogs.objects.filter(created_on__lt=six_months_ago)
            count_six_month_previous_logs  = len(six_month_old_records)
            six_month_old_records.delete()
            self.log(f"Deleted {count_six_month_previous_logs} Housekeeping logs from DB")

            # Update outdated browser from features
            self.update_outdated_browser_from_features()


        except Exception as e:
            self.house_keeping_logs.success = False
            self.log(f"Exception while doing housekeeping {str(e)}")
        # Saving logs in database for future references, can be seen in the django admin
           
 
        self.log("Saving logs in the database")
        self.house_keeping_logs.house_keeping_logs = self.get_logs()
        self.house_keeping_logs.save()
        
        logger.debug("housekeeping logs saved")
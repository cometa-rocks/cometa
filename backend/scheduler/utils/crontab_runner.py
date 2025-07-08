import subprocess
from apscheduler.triggers.cron import CronTrigger
import os
from utils.common import get_django_server_url, logger, JOB_LIST_FILE_PATH
from utils.curl_processor import parse_curl_command
import requests
import json
from requests.exceptions import ConnectionError

def get_schedules():
    """Fetches scheduled tasks from a Django API and updates them in the scheduler."""
    url = f"{get_django_server_url()}/api/schedule/"
    response = requests.get(url)

    if response.status_code == 200:
        schedules = response.json().get('schedules', [])
        return schedules
    else:
        logger.error(f"Failed to fetch schedules: {response.text}")
        return []


def run_command(command: str):
    try:
        if command.strip().startswith("curl"):
            parsed_info = parse_curl_command(command)

            request_body = parsed_info.get("data")
            if request_body:
                try:
                    request_body = json.loads(request_body)
                except json.JSONDecodeError:
                    logger.warning("Data is not a valid JSON format. Sending as raw string.")
            else:
                request_body = None

            # Enhanced logging for scheduled executions
            is_data_driven = "/exec_data_driven/" in parsed_info['url']
            is_feature = "/exectest/" in parsed_info['url']
            
            if is_data_driven:
                file_id = request_body.get('file_id') if request_body else 'Unknown'
                logger.info(f"[CRON SCHEDULER] Executing SCHEDULED DATA-DRIVEN test - File ID: {file_id}, URL: {parsed_info['url']}")
            elif is_feature:
                feature_id = request_body.get('feature_id') if request_body else 'Unknown'
                logger.info(f"[CRON SCHEDULER] Executing SCHEDULED FEATURE test - Feature ID: {feature_id}, URL: {parsed_info['url']}")
            else:
                logger.info(f"[CRON SCHEDULER] Executing SCHEDULED command - URL: {parsed_info['url']}")

            try:
                logger.info(
                    f"[CRON SCHEDULER] Sending HTTP request to {parsed_info['url']}, Request Method : {parsed_info.get('method')}, Request body : {request_body}"
                )
                response = requests.request(
                    method=parsed_info.get("method"),
                    json=request_body,
                    url=parsed_info.get("url"),
                    headers=parsed_info["headers"]
                )

                logger.info(
                    f"[CRON SCHEDULER] HTTP response - URL: {parsed_info['url']}, Status: {response.status_code}, Body: {response.text}"
                )
                
                if is_data_driven and response.status_code == 200:
                    logger.info(f"[CRON SCHEDULER] Data-driven test started successfully for file {file_id}")
                elif response.status_code != 200:
                    logger.error(f"[CRON SCHEDULER] Failed to execute scheduled task - Status: {response.status_code}")
                    
            except ConnectionError as e:
                logger.exception("[CRON SCHEDULER] Connection error while making HTTP request to Django server", exc_info=e)

        else:
            result = subprocess.run(command, shell=True, capture_output=True, text=True)
            if result.returncode == 0:
                logger.info(result.stdout)
            else:
                logger.error(f"Error occurred during execution:\n{result.stderr}")
                
    except Exception as e:
        logger.exception(f"Exception when running command {command}", exc_info=e)

def update_jobs(scheduler, jobs, called_by="Scheduler"):
    """Updates the scheduler with new jobs from fetched schedules."""
    # Clear existing jobs
    scheduler.remove_all_jobs()
    logger.info(f"Updating jobs, Called by {called_by}")

    # Add new jobs from fetched schedules
    os.makedirs(os.path.dirname(JOB_LIST_FILE_PATH), exist_ok=True)
    job_file = open(JOB_LIST_FILE_PATH, "w")
    for job_info in jobs:
        job_file.writelines(job_info+"\n")
        schedule_time_and_command = job_info.split("curl")
        if len(schedule_time_and_command) > 1:
            # Since command is in string format take the * * * * * and command into different variables
            cron_schedule = schedule_time_and_command[0]
            job_command = f'curl {schedule_time_and_command[1]}'
            scheduler.add_job(run_command, CronTrigger.from_crontab(cron_schedule), args=[job_command],
                              max_instances=100)

    # Add auto update job to the scheduler
    scheduler.add_job(lambda: update_jobs(scheduler, get_schedules()), 'interval', minutes=1, misfire_grace_time=10 )
    job_file.close()

import subprocess
from apscheduler.triggers.cron import CronTrigger
import os
from utils.common import get_django_server_url, logger, JOB_LIST_FILE_PATH
from utils.curl_processor import parse_curl_command
import requests
from requests.exceptions import ConnectionError

from urllib.parse import urlparse


def get_schedules():
    """Fetches scheduled tasks from a Django API and updates them in the scheduler."""
    try:
        url = f"{get_django_server_url()}/api/schedule/"
        response = requests.get(url)

        if response.status_code == 200:
            schedules = response.json().get('schedules', [])
            logger.debug(schedules)
            return schedules
        else:
            logger.debug("Failed to fetch schedules:", response.text)
            return []
    except:
        logger.error(f"Exception while connecting to server {get_django_server_url()}, will retry..")
        return []


def run_command(command: str):
    # Start running feature with current browser
    try:

        if command.strip().startswith("curl"):
            parsed_info = parse_curl_command(command)
            logger.debug(f"HTTP Method: {parsed_info.get('method')}")
            logger.debug(f"URL: {parsed_info.get('url')}")
            logger.debug(f"Data Payload: {parsed_info.get('data')}")
            logger.debug(f"Headers: {parsed_info.get('headers')}")

            # Parse the URL
            parsed_url = urlparse(parsed_info.get('url'))

            try:
                url=f'{get_django_server_url()}{parsed_url.path}' 
                response = requests.request(method=parsed_info.get("method"), data=parsed_info["data"], url=url,
                                            headers=parsed_info["headers"])
                logger.info(
                    f"Sent HTTP request to {url}, Response status : {response.status_code}, Response body : {response.text}")
            except ConnectionError as e:
                logger.exception("Exception while making http request to Django server",e)


        else:
                result = subprocess.run(command, shell=True, capture_output=True, text=True)
                if result.returncode == 0:
                    logger.info(result.stdout)
                else:
                    logger.error(f"Error occurred during the feature execution, please check the output:\n{result.stderr}")

    except Exception as e:
        logger.exception(f"Exception when running command {command}", exc_info=e)


def update_jobs(scheduler, jobs: list, called_by="Scheduler"):
    """Updates the scheduler with new jobs from fetched schedules."""
    # Clear existing jobs
    scheduler.remove_all_jobs()
    logger.info(f"Updating jobs, Called by {called_by}")

    # Add new jobs from fetched schedules
    job_file = open(JOB_LIST_FILE_PATH, "w")
    for job_info in jobs:
        job_file.writelines(job_info+"\n")
        # * 1 * * * curl --silent --data '{"feature_id":1, "jobId":2}' -H "Content-Type: application/json" -H "COMETA-ORIGIN: CRONTAB" -H "COMETA-USER: 1" -X POST http://django:8000/exectest/ # added by cometa JobID: 2 on 2024-06-27, to be deleted on ***never*** (disable it in feature)
        # [* 1 * * *] and  [curl --silent --data '{"feature_id":1, "jobId":2}' -H "Content-Type: application/json" -H "COMETA-ORIGIN: CRONTAB" -H "COMETA-USER: 1" -X POST http://django:8000/exectest/ # added by cometa JobID: 2 on 2024-06-27, to be deleted on ***never*** (disable it in feature)]
        schedule_time_and_command = job_info.split("curl")
        if len(schedule_time_and_command) > 1:
            # Since command is in string format take the * * * * * and command into different variables
            cron_schedule = schedule_time_and_command[0]
            job_command = f'curl {schedule_time_and_command[1]}'
            scheduler.add_job(run_command, CronTrigger.from_crontab(cron_schedule), args=[job_command],
                              max_instances=100)
    job_file.close()
    # Add auto update job to the scheduler
    scheduler.add_job(lambda: update_jobs(scheduler, get_schedules()), 'interval', minutes=1)

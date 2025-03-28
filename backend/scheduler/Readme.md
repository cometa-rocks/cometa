# Scheduler
This is an alternative to crontab, which require root permissions in the container and needs cli that pose security risks.
Developed as a replacement for crontab, this solution addresses those concerns.

## Enhancements
* It does not need cron or crontab to run feature
* It call's api directly

## Start server on different IP and port
* If you need to change the server host name or port number, you can do so by setting the environment variables listed below before running the scheduler.
    - name: SCHEDULER_HOST
      value: "cometa-scheduler-service"
    - name: SCHEDULER_PORT
      value: "8080"

## Setup development environment for Scheduler
* Create virtual environment using python
* Install required dependency using requirements.txt

  ```pip install -r requirements.txt```

* Set Environment variables for Django server,  in console, IDE level or system level

  - name: DJANGO_SERVER_URL
    value: "cometa-django-service"

  - name: DJANGO_SERVER_PORT
    value: "8000"

  Optionally
  - name: DEBUG_LEVEL 
    value: "20"

* Run Scheduler
  ```python Server.py```

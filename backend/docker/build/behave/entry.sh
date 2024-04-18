#!/bin/bash

# Run Django migrations
python manage.py makemigrations
python manage.py migrate

# ${REDIS_WORKERS} values should come from environment variable

# configure django-rq service in supervisor / redis - number of workers equals number of CPUs - #4236
# limit number of procs to Cores - 2
cat <<EOF > /etc/supervisor/conf.d/django-rq.conf
[program:django-rq]
environment=PYTHONUNBUFFERED=1
process_name=%(program_name)s-%(process_num)s
command=python manage.py rqworker default
numprocs=$REDIS_WORKERS
directory=/opt/code/behave_django
stopsignal=TERM
autostart=true
autorestart=true
stdout_logfile=/proc/1/fd/1
stdout_logfile_maxbytes=0
stderr_logfile=/proc/1/fd/1
stderr_logfile_maxbytes=0
EOF

# start supervisord to spin django-rq workers.
supervisord -c /etc/supervisor/supervisord.conf

# ${THREADS} values should come from environment variable
# spin up gunicorn
gunicorn behave_django.wsgi:application --workers=2 --threads=${THREADS:-2} --worker-class=gthread --bind 0.0.0.0:8001 --preload

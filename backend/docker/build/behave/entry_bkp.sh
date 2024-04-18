#!/bin/bash

function install_cron() {
    apt install -y cron
    touch /etc/cron.d/crontab
    chmod 0644 /etc/cron.d/crontab
    crontab /etc/cron.d/crontab
    cron
}

# sh -c service rsyslog start; tail -f /dev/null # FIXME: This fails every time
# Install requirements
apt update
apt install --no-install-recommends -y rsyslog vim jq nano supervisor
service rsyslog start
apt-get purge -y exim*
# Upgrade PIP
python -m pip install -U pip
# Install poetry package manager
curl -sSL https://install.python-poetry.org | python3 -
# Create symbolic link to Poetry so it's available as command everywhere
ln -s /root/.local/bin/poetry /usr/local/bin/poetry
# Disable creation of virtual env
poetry config virtualenvs.create false
# Install project dependencies
poetry install --no-interaction --no-ansi
# Install Behave
pip install behave
# Run Django migrations
python manage.py makemigrations
python manage.py migrate

# install crontab
# 2024-02-15 ASO No longer needed since we are using the contrab container for that.
# install_cron

# Start Django server
# python manage.py runserver 0.0.0.0:8001

# get processor cores
CPUCORES=`getconf _NPROCESSORS_ONLN`
# calculate workers
# GUNI_WORKERS=$((($CPUCORES*2+1)))

GUNI_WORKERS=$((($CPUCORES+1)))

# prevents $CPUCORES to be set to <=0, which causes failure during test execution on Cometa due to non existant CPU cores.
if [ $CPUCORES -le 2 ]; then
    REDIS_WORKERS=$((($CPUCORES)))
else
    REDIS_WORKERS=$((($CPUCORES-2)))
fi

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

# spin up gunicorn
gunicorn behave_django.wsgi:application --workers=2 --threads=${THREADS:-2} --worker-class=gthread --bind 0.0.0.0:8001 --preload

# SEMFILE="stop_behave_semaphore.sem"

# while [ ! -e "${SEMFILE}" ]
# do
#     sleep 30s
#     logger "Behave Docker up and running, polling for ${SEMFILE} ... "
# done
# rm -f ${SEMFILE}
# logger "Behave exited."

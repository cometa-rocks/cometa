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
apt install --no-install-recommends -y rsyslog vim jq nano
service rsyslog start
apt-get purge -y exim*
# Upgrade PIP
python -m pip install -U pip
# Install poetry package manager
curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python -
# Create symbolic link to Poetry so it's available as command everywhere
ln -s /root/.poetry/bin/poetry /usr/local/bin/poetry
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
install_cron


# Start Django server
# python manage.py runserver 0.0.0.0:8001

# get processor cores
CPUCORES=`getconf _NPROCESSORS_ONLN`
# calculate workers
# GUNI_WORKERS=$((($CPUCORES*2+1)))
GUNI_WORKERS=$((($CPUCORES+1)))

# spin up gunicorn
gunicorn behave_django.wsgi:application --workers=${WORKERS:-$GUNI_WORKERS} --threads=${THREADS:-2} --worker-class=gthread --bind 0.0.0.0:8001

# SEMFILE="stop_behave_semaphore.sem"

# while [ ! -e "${SEMFILE}" ] 
# do
#     sleep 30s
#     logger "Behave Docker up and running, polling for ${SEMFILE} ... "
# done
# rm -f ${SEMFILE}
# logger "Behave exited."

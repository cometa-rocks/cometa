#!/bin/bash


# Make sure log folder exists
mkdir -p /opt/code/logs || true
# Install requirements
apt update && apt install -y rsyslog jq nano vim clamav-daemon
service rsyslog start
# Install cron
# install_cron
# check and create secret_variables.py
# create_secret_variables
# Install poetry package manager
curl -sSL https://install.python-poetry.org | python3 -
# Create symbolic link to Poetry so it's available as command everywhere
ln -s /root/.local/bin/poetry /usr/local/bin/poetry
# Disable creation of virtual env
poetry config virtualenvs.create false
# Install project dependencies
poetry install --no-interaction --no-ansi
# Upgrade PIP
pip install -U pip
# Run Django migrations
python manage.py makemigrations backend
python manage.py makemigrations security
python manage.py makemigrations housekeeping
python manage.py makemigrations configuration
python manage.py makemigrations container_service
python manage.py makemigrations mobile
python manage.py migrate

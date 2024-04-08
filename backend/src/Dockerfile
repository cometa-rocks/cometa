# This docker file is used to create create a python image which contains all required dependencies
# to run Cometa django container
# Intension is to reduce installation time of Cometa
# Date v1: 08-04-2024 (Anand Kushwaha)  

FROM python:3.9

ENV PYTHONBUFFERED=1
WORKDIR /opt/code
COPY ./poetry.lock ./poetry.lock
COPY ./pyproject.toml ./pyproject.toml
# Install poetry package manager
RUN curl -sSL https://install.python-poetry.org | python3 -
# Make sure log folder exists
RUN mkdir -p /opt/code/logs || true
# Install requirements
RUN apt update && apt install -y rsyslog jq nano vim clamav-daemon
# Create symbolic link to Poetry so it's available as command everywhere
RUN ln -s /root/.local/bin/poetry /usr/local/bin/poetry
# Disable creation of virtual env
RUN poetry config virtualenvs.create false
# Install project dependencies
RUN poetry install --no-interaction --no-ansi
# Upgrade PIP
RUN pip install -U pip

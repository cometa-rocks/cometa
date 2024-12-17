# Use Python 3.9 base image from the Docker Hub
FROM python:3.9

LABEL AUTHOR="COMETA ROCKS S.L."

# SHELL ["/bin/bash", "-c"]
USER root

# Install necessary packages
RUN apt-get update && apt-get install --no-install-recommends -y \
    rsyslog \
    vim \
    jq \
    nano \
    telnet \
    supervisor \
    && apt-get purge -y --auto-remove exim* \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get purge -y exim*
# Update pip
RUN python -m pip install --upgrade pip

# Create a non-root user 'cometa' with UID 472 and GID 472
RUN groupadd -g 472 cometa && \
    useradd -u 472 -g cometa -m cometa -s /bin/bash

RUN usermod -aG sudo cometa
    

# Create necessary directories with appropriate ownership and permissions
RUN mkdir -p /etc/supervisor/conf.d
RUN mkdir -p /opt/code 
RUN mkdir -p /code
RUN mkdir -p /share
RUN mkdir -p /dev/log
RUN mkdir -p /code/behave/screenshots
RUN mkdir -p /code/behave/videos
RUN mkdir -p /code/behave/pdf
RUN mkdir -p /data/test/downloads
RUN mkdir -p /code/behave/department_data
RUN mkdir -p /code/src/logs


RUN chown -R cometa:cometa /code
RUN chown -R cometa:cometa /code/src/logs
RUN chown -R cometa:cometa /share
RUN chown -R cometa:cometa /opt/code
RUN chown -R cometa:cometa /home/cometa
RUN chown -R cometa:cometa /usr/local/
RUN chown -R cometa:cometa /var/log/
# RUN chown -R cometa:cometa /dev/log
RUN chown -R cometa:cometa /var/run
RUN chown -R cometa:cometa /etc/rsyslog.d
RUN chown -R cometa:cometa /proc/kmsg
RUN chown -R cometa:cometa /etc/supervisor
RUN chown -R cometa:cometa /var/log/supervisor/


RUN chmod -R 755 /code 
RUN chmod -R 755 /code/src/logs
RUN chmod -R 755 /share
RUN chmod -R 755 /opt/code 
RUN chmod -R 755 /proc/kmsg 
RUN chmod -R 755 /var/run 
RUN chmod -R 755 /var/log/supervisor/ 
RUN chmod -R 755 /usr/local/lib/python3.9/
# RUN chmod -R 755 /usr/local/bin/chardetect/

# RUN rsyslogd -n

# Set the working directory
WORKDIR /code/behave

COPY --chown=cometa:cometa ./supervisord.conf /etc/supervisor/supervisord.conf
COPY --chown=cometa:cometa . /opt/code

WORKDIR /opt/code/
# Switch to non-root user
USER cometa

# Set working directory
WORKDIR /opt/code

# Update file permissions
RUN chmod -R 755 /opt/code

# Install Poetry via curl
RUN curl -sSL https://install.python-poetry.org | python3 -

# Add Poetry to PATH
ENV PATH="/home/cometa/.local/bin:$PATH"

# Verify Poetry installation
RUN poetry --version

# # Configure Poetry to avoid creating virtual environments
RUN poetry config virtualenvs.create false --local

# Install project dependencies
RUN poetry install --no-interaction --no-ansi

# Install Behave for testing
RUN pip install behave


# Set the entry point script, ensure it's executable

RUN chmod +x /opt/code/behave_django/start_pod.sh
RUN chmod +x /opt/code/run_remote_from_django.sh

WORKDIR /opt/code/behave_django

# Finish setup, execute the entrypoint script
ENTRYPOINT ["/bin/sh", "-c", "/opt/code/behave_django/start_pod.sh"]


# build image for arm and amd processors 
# docker buildx build  --platform linux/amd64,linux/arm64 -t cometa/behave:latest --push .
# docker build -t cometa/behave:0.1 --push .
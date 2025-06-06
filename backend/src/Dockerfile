# Use the specified Python base image
FROM python:3.11

LABEL AUTHOR="COMETA ROCKS S.L."

SHELL ["/bin/bash", "-c"]

# # Create a non-root user 'cometa' with UID and GID 472
RUN groupadd -g 472 cometa && \
    useradd -u 472 -g cometa -m cometa -s /bin/bash

USER root

# RUN groupadd -g 472 cometa && \
#     useradd -r -u 472 -g cometa cometa
# Set the working directory to /opt/code

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    rsyslog \
    jq \
    nano \
    vim \
    cron \
    curl \
    telnet \
    clamav \
    clamav-daemon && \
    rm -rf /var/lib/apt/lists/* 


# Create application directories
RUN mkdir -p /opt/code
RUN mkdir -p /share
RUN mkdir -p /code
RUN mkdir -p /home/cometa
RUN mkdir -p /migration 


RUN mkdir -p /data/screenshots
RUN mkdir -p /code/behave/videos
RUN mkdir -p /code/behave/pdf
RUN mkdir -p /code/behave/downloads
RUN mkdir -p /code/behave/department_data
RUN mkdir -p /var/log/cron /var/spool/cron/crontabs /var/run/clamav /run/clamav
RUN mkdir -p /dev/log

RUN chown -R cometa:cometa /code
RUN chown -R cometa:cometa /opt/code
RUN chown -R cometa:cometa /share
RUN chown -R cometa:cometa /var
RUN chown -R cometa:cometa /run
RUN chown -R cometa:cometa /usr/bin
# Changing permission for /dev/ throws error sometime as it has some readonly file system
RUN chown -R cometa:cometa /dev/ | echo ""
RUN chown -R cometa:cometa /etc/cron.d
RUN chown -R cometa:cometa /home/cometa
RUN chown -R cometa:cometa /usr/local/
RUN chown -R cometa:cometa /bin/sh
# RUN chown -R cometa:cometa /var/spool/cron/crontabs /var/log/cron /var/run/clamav /run/clamav
RUN chown -R cometa:cometa /usr/sbin/rsyslogd
RUN chown -R cometa:cometa /var/spool/rsyslog
RUN chown -R cometa:cometa /etc/rsyslog.d
# RUN chown -R cometa:cometa /proc/kmsg
RUN chown -R cometa:cometa /migration 

RUN chown clamav:clamav /var/lib/clamav
RUN chmod 775 /var/lib/clamav
RUN chown clamav:clamav /var/log/clamav
RUN chmod 775 /var/log/clamav

RUN chmod -R 755 /code
RUN chmod -R 755 /opt/code
RUN chmod -R 755 /share
RUN chmod -R 755 /var
RUN chmod -R 755 /run
RUN chmod -R 755 /usr/bin
RUN chmod -R 755 /etc/cron.d
RUN chmod -R 755 /var/run/clamav
RUN chmod -R 755 /run/clamav
RUN chmod -R 755 /usr/sbin/rsyslogd
RUN chmod -R 755 /var/spool/rsyslog
RUN chmod -R 755 /migration

# Copy backend application files
# COPY --chown=cometa:cometa ./src /code/src
# COPY --chown=cometa:cometa ./behave /code/behave
# COPY --chown=cometa:cometa . /code
COPY --chown=cometa:cometa . /opt/code
# COPY --chown=cometa:cometa ./crontabs/cometa_django_crontab /etc/cron.d/crontab
COPY --chown=cometa:cometa ./rsyslog/rsyslog.conf /etc/rsyslog.conf
COPY --chown=cometa:cometa ./rsyslog/rsyslog.service /lib/systemd/system/rsyslog.service
WORKDIR /opt/code


RUN touch /etc/cron.d/crontab
RUN chmod 0744 /etc/cron.d/crontab
RUN crontab /etc/cron.d/crontab

RUN usermod -aG cometa clamav

# Switch to non-root user
USER cometa
# Install Poetry under the `cometa` user's local directory and configure it

RUN pip install poetry
RUN poetry config virtualenvs.create false

# Install Python dependencies
RUN poetry install --no-interaction --no-ansi

# Copy the entry script and ensure it's executable
RUN chmod +x ./start_common.sh
RUN chmod +x ./start_pod.sh

# Expose the port Django will run on
EXPOSE 8000

# Command to run the entry script which starts Django or gunicorn based on the environment
CMD ["./start_pod.sh"]

# build image for arm and amd processors 
# docker buildx build -f Dockerfile --platform linux/amd64,linux/arm64 -t cometa/django:latest --push .
# docker build -f Dockerfile -t cometa/django:0.1 --push .
# docker build -f Dockerfile -t cometa/django:1.2 --push .

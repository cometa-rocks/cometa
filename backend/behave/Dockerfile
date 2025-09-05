# Use Python 3.11 base image from the Docker Hub
FROM python:3.11

LABEL AUTHOR="COMETA ROCKS S.L."

# SHELL ["/bin/bash", "-c"]
USER root

# Install necessary packages
RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update && apt-get install --no-install-recommends -y \
    rsyslog \
    vim \
    jq \
    nano \
    telnet \
    supervisor \
    psmisc \
    libgl1 \
    && apt-get purge -y --auto-remove exim* \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get purge -y exim*
# Update pip
RUN python -m pip install --upgrade pip

# Install MSSQL related library
# 1. Clean up any broken repo files
RUN rm -f /etc/apt/sources.list.d/mssql-release.list

# 2. Import Microsoft’s GPG key (new method, no apt-key warnings)
RUN curl -sSL https://packages.microsoft.com/keys/microsoft.asc \
  | gpg --dearmor \
  | tee /usr/share/keyrings/microsoft-prod.gpg > /dev/null

# 3. Add Microsoft SQL Server ODBC repo (use Debian 11, works on Debian 12 too)
# TODO: Check if this is the correct version of Debian
RUN echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/debian/11/prod bullseye main" \
  > /etc/apt/sources.list.d/mssql-release.list
# 4. Update apt and install ODBC driver
RUN apt-get update && ACCEPT_EULA=Y apt-get install -y msodbcsql18 unixodbc-dev




RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update && apt-get install -y \
    unixodbc \
    unixodbc-dev \
    odbcinst \
    curl \
    gnupg2 \
    && rm -rf /var/lib/apt/lists/*
# Create a non-root user 'cometa' with UID 472 and GID 472
RUN groupadd -g 1472 cometa \
&& useradd -u 1472 -g cometa -d /home/cometa -s /bin/bash cometa

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
RUN mkdir -p /opt/code/behave_logs
RUN mkdir -p /home/cometa

RUN chown -R cometa:cometa /code
RUN chown -R cometa:cometa /opt/code/behave_logs
RUN chown -R cometa:cometa /share
RUN chown -R cometa:cometa /opt/code
RUN chown -R cometa:cometa /home/cometa
RUN chown -R cometa:cometa /usr/local/
RUN chown -R cometa:cometa /var/log/
# RUN chown -R cometa:cometa /dev/log
RUN chown -R cometa:cometa /var/run
RUN chown -R cometa:cometa /etc/rsyslog.d
# RUN chown -R cometa:cometa /proc/kmsg
RUN chown -R cometa:cometa /etc/supervisor
RUN chown -R cometa:cometa /var/log/supervisor/


RUN chmod -R 755 /code 
RUN chmod -R 755 /opt/code/behave_logs
RUN chmod -R 755 /share
RUN chmod -R 755 /opt/code 
# RUN chmod -R 755 /proc/kmsg 
RUN chmod -R 755 /var/run 
RUN chmod -R 755 /var/log/supervisor/ 
RUN chmod -R 755 /usr/local/lib/python3.11/ || true
# RUN chmod -R 755 /usr/local/bin/chardetect/

# RUN rsyslogd -n

# Set the working directory
WORKDIR /code/behave

COPY --chown=cometa:cometa ./supervisord.conf /etc/supervisor/supervisord.conf
COPY --chown=cometa:cometa . /opt/code

WORKDIR /opt/code
# Switch to non-root user
USER cometa

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
USER root
RUN export DEBIAN_FRONTEND=noninteractive \
    && apt-get update -y \
    && apt-get install -y gcc g++ make python3-dev libssl-dev openssl \
    && python3 -m ensurepip \
    && python3 -m pip install --upgrade pip setuptools wheel

# Configure Poetry for root user and install Python dependencies
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi



USER cometa



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
# version used for kubernetes development 
# docker build -t cometa/behave:0.1 --push .

# version used for kubernetes deployment 
# docker build -t cometa/behave:1.1 --push .
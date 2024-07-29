# Use the official Python 3.12.2 image from the Docker Hub
FROM python:slim-bullseye

# Set the working directory in the container
WORKDIR /app
USER root
# Create a user named 'cometa' to run the application
# Avoid running the application as the root user for security reasons
# RUN apt update
# RUN apt install -y curl

RUN groupadd -g 472 cometa && \
    useradd -u 472 -g cometa -m cometa -s /bin/bash


RUN chown -R cometa:cometa /usr/bin
RUN chown -R cometa:cometa /home/cometa
RUN chown -R cometa:cometa /usr/local/

# Copy the local directory (where the Dockerfile is located) into the working directory
## Replace `./your_directory` with the path to the directory you want to copy
COPY utils/ /app/utils/
COPY ./Dockerfile /app/Dockerfile
COPY ./requirements.txt /app/requirements.txt
COPY ./Server.py /app/Server.py

# Create job file to store jobs list
RUN mkdir -p /app/tmp
RUN touch /app/tmp/.jobs

# Change the ownership of the copied directory to 'cometa'
RUN chown -R cometa:cometa /app
RUN chown -R cometa:cometa /app/tmp/.jobs
RUN chmod -R 766 /app/tmp/.jobs

# Switch to 'cometa' user
USER cometa

RUN pip install -r requirements.txt
# Your application's default command or entry point, if any
# For example, running a Python script:

CMD ["python", "Server.py"]

# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Update package list and install necessary tools
RUN apt-get update && apt-get install curl procps supervisor libpq5 libpq-dev gcc python3-dev -y

# Create a non-root user `cometa`
RUN useradd -ms /bin/bash cometa

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Set the working directory in the container
WORKDIR /app
# Create a folder to store logs
RUN mkdir -p /logs /home/cometa/.ollama
# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Change the ownership of the /app and /logs directory to the cometa user
RUN chown -R cometa:cometa /app /logs /dev/fd/1 /dev/fd/2 /home/cometa/.ollama

# Switch to the cometa user
USER cometa

# Make port 8080 available to the world outside this container
# EXPOSE 8002

# Define environment variable
ENV NAME ollama

# Run ollama when the container launches
ENTRYPOINT ["supervisord", "-c", "/app/supervisor/supervisord.conf"]

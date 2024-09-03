# Use an official Python runtime as a parent image
FROM python:3.11-slim

RUN apt update
RUN apt install curl -y

# Set the working directory in the container
WORKDIR /app

# Copy the current directory contents into the container at /app
# COPY . /app

# Install any needed packages specified in requirements.txt
# RUN pip install --no-cache-dir -r requirements.txt

# Define environment variable
ENV NAME ollma

# Run ollma when the container launches
CMD ["sleep","infinity"]

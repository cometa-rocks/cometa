# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Update package list and install necessary tools
RUN apt-get update && apt-get install curl procps supervisor libpq5 libpq-dev gcc python3-dev -y

# Install Ollama
RUN curl -fsSL https://ollama.com/install.sh | sh

# Set the working directory in the container
WORKDIR /app
# Create a folder to store logs
RUN mkdir -p /logs /root/.ollama
# Copy the current directory contents into the container at /app
COPY . /app

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Create directories for Django and RAG system
RUN mkdir -p /app/src/cometa_ollama_api/staticfiles
RUN mkdir -p /app/data/chromadb
RUN mkdir -p /app/src/cometa_ollama_api/apps/rag_system/migrations

# Make port 8080 available to the world outside this container
# EXPOSE 8002

# Define environment variable
ENV NAME=ollama

# ONNX Runtime configuration to optimize performance
ENV ONNXRUNTIME_LOG_SEVERITY_LEVEL=3
ENV OMP_NUM_THREADS=1
ENV ONNX_PROVIDERS=CPUExecutionProvider

# Run ollama when the container launches
ENTRYPOINT ["supervisord", "-c", "/app/supervisor/supervisord.conf"]

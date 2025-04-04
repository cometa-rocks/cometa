FROM python:3.11-slim

WORKDIR /app/src/api

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Make init script executable
RUN chmod +x init_rag.sh

EXPOSE 8000

# Container entry point is defined in docker-compose.yml
# This will be `python manage.py runserver 0.0.0.0:8000`

#!/bin/bash
set -e

# Navigate to the correct directory
cd /app/src/cometa_ollama_api

# Run database migrations
echo "Applying database migrations..."
python manage.py migrate --noinput

# Initialize RAG system
echo "Initializing RAG system..."
./init_rag.sh

# Start Gunicorn with Uvicorn workers
echo "Starting Gunicorn with Uvicorn workers..."
gunicorn main.asgi:application \
    --bind 0.0.0.0:8002 \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --log-level debug \
    --access-logfile - \
    --error-logfile - 

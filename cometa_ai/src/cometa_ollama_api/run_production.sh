#!/bin/bash
set -e

# Navigate to the correct directory
cd /app/src/cometa_ollama_api

# Initialize Ollama models and RAG system
echo "\033[96m[$(date '+%Y-%m-%d %H:%M:%S')][MainThread][INFO][run_production.sh:8](main) -\033[0m Initializing Ollama and RAG system..."
./init_ollama.sh

# Start Gunicorn with Uvicorn workers
echo "\033[96m[$(date '+%Y-%m-%d %H:%M:%S')][MainThread][INFO][run_production.sh:12](main) -\033[0m Starting Gunicorn with Uvicorn workers..."
gunicorn main.asgi:application \
    --bind 0.0.0.0:8002 \
    --workers 2 \
    --worker-class uvicorn.workers.UvicornWorker \
    --log-level debug \
    --access-logfile - \
    --error-logfile - 

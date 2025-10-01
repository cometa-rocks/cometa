#!/bin/bash
set -e

echo "\033[96m[$(date '+%Y-%m-%d %H:%M:%S')][MainThread][INFO][init_ollama.sh:4](main) -\033[0m Initializing Ollama and RAG system for Co.meta..."
cd /app/src/cometa_ollama_api

# Wait for the database to be ready
echo "\033[96m[$(date '+%Y-%m-%d %H:%M:%S')][MainThread][INFO][init_ollama.sh:8](main) -\033[0m Waiting for database to be ready..."
python -c "
import sys
import time
import psycopg
from psycopg.errors import OperationalError

max_retries = 30
retry_interval = 1
retries = 0

# Database connection parameters
dbname = 'postgres'
user = 'postgres'
password = 'postgres'
host = 'db.ai'
port = '5432'

while retries < max_retries:
    try:
        with psycopg.connect(f'dbname={dbname} user={user} password={password} host={host} port={port}') as conn:
            with conn.cursor() as cur:
                cur.execute('SELECT 1')
                print('Database connection successful')
                sys.exit(0)
    except OperationalError as e:
        print(f'Database connection failed: {e}')
        retries += 1
        if retries < max_retries:
            print(f'Retrying in {retry_interval} seconds...')
            time.sleep(retry_interval)
        else:
            print('Maximum retries reached')
            sys.exit(1)
"

# Create and apply migrations
echo "\033[96m[$(date '+%Y-%m-%d %H:%M:%S')][MainThread][INFO][init_ollama.sh:45](main) -\033[0m Creating migrations..."
python manage.py makemigrations rag_system --noinput
echo "\033[96m[$(date '+%Y-%m-%d %H:%M:%S')][MainThread][INFO][init_ollama.sh:47](main) -\033[0m Applying migrations..."
python manage.py migrate

# Clear existing RAG data and ingest documents from JSON
echo "\033[96m[$(date '+%Y-%m-%d %H:%M:%S')][MainThread][INFO][init_ollama.sh:51](main) -\033[0m Ingesting documentation into RAG system..."
python manage.py ingest_from_json --clear apps/rag_system/ingestion_documents.json

# Pull required Ollama models that aren't handled by apps.py
echo "\033[96m[$(date '+%Y-%m-%d %H:%M:%S')][MainThread][INFO][init_ollama.sh:55](main) -\033[0m Pulling required Ollama models..."

# List of models to pull (add new models here)
MODELS=(
    "granite3.3:8b" # RAG embeddings and chatbot
    "llava"         # Image analysis
    "llama3.1"      # Text processing fallback
    # "llava:13b"   # Uncomment for larger vision model
)

for model in "${MODELS[@]}"; do
    echo "\033[96m[$(date '+%Y-%m-%d %H:%M:%S')][MainThread][INFO][init_ollama.sh:65](main) -\033[0m Pulling model: $model..."
    ollama pull $model
done

echo "\033[96m[$(date '+%Y-%m-%d %H:%M:%S')][MainThread][INFO][init_ollama.sh:69](main) -\033[0m Ollama and RAG system initialization complete!" 
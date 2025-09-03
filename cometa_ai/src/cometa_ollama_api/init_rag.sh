#!/bin/bash
set -e

echo "Initializing RAG system for Co.meta..."
cd /app/src/cometa_ollama_api

# Wait for the database to be ready
echo "Waiting for database to be ready..."
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
echo "Creating migrations..."
mkdir -p apps/rag_system/migrations
touch apps/rag_system/migrations/__init__.py
python manage.py makemigrations --noinput
echo "Applying migrations..."
python manage.py migrate

# Clear existing RAG data and ingest documents from JSON
echo "Ingesting documentation into RAG system..."
python manage.py ingest_from_json --clear apps/rag_system/ingestion_documents.json

echo "RAG system initialization complete!" 
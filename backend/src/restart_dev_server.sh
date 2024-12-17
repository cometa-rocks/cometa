#!/bin/bash

# Define the Django project directory and server settings
PROJECT_DIR="/opt/code"
MANAGE_PY="$PROJECT_DIR/manage.py"
HOST="0.0.0.0"
PORT="8000" 

# Step 1: Find and kill any running Django development server processes
echo "Searching for running Django development servers on port $PORT..."
PIDS=$(ps aux | grep "[p]ython.*runserver.*$PORT" | awk '{print $2}')

if [ -n "$PIDS" ]; then
    echo "Killing the following process(es) on port $PORT: $PIDS"
    kill -9 $PIDS
else
    echo "No Django development server running on port $PORT."
fi

# Step 2: Navigate to the project directory
echo "Navigating to project directory: $PROJECT_DIR"
cd $PROJECT_DIR || { echo "Failed to navigate to project directory. Exiting."; exit 1; }

# Step 3: Start a new Django development server
echo "Starting new Django development server on $HOST:$PORT..."
python3 $MANAGE_PY runserver $HOST:$PORT 

#!/bin/bash

# 2025-03-06 Keep all common command which needs to be run on both dev and prod and docker kubernetes env environments

# Run Django migrations for all apps
python manage.py makemigrations backend
python manage.py makemigrations security
python manage.py makemigrations housekeeping
python manage.py makemigrations configuration
python manage.py makemigrations container_service
python manage.py makemigrations mobile
python manage.py makemigrations token_authentication
python manage.py migrate

# if this is the first time initializing co.meta
# import basic data
if [ ! -f "/code/config/.initiated" ]; then
    if find defaults -name "*.json" | sort | xargs -I{} python manage.py loaddata {}; then
        touch /code/config/.initiated
        echo "Default configuration loaded"
    else
        echo "Failed to import default data"
        exit 1
    fi
fi
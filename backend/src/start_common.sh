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
python manage.py makemigrations notification
python manage.py migrate


# if this is the first time initializing co.meta
# import basic data
# if [ ! -f "/code/config/.initiated" ]; then

echo "###################################################"  
echo "# Checking if default values are loaded from ./defaults/*.json files"
# When running this "python manage.py is_default_values_loaded" it prints True or False based on the default values loaded from the database
is_default_values_loaded=$(python manage.py is_default_values_loaded)
echo "# default values are loaded : $is_default_values_loaded"  
echo "###################################################"  

# Use value of is_default_values_loaded to check if default values are loaded
if [ "$is_default_values_loaded" = "False" ]; then
    if find defaults -name "*.json" | sort | xargs -I{} python manage.py loaddata {}; then
        echo "Default configuration loaded"
        echo "Setting default values loaded to True in the database"
        python manage.py set_default_values_loaded
    else
        echo "Failed to import default data"
        exit 1
    fi
fi

# Create database indexes only if default values are loaded
if [ "$is_default_values_loaded" = "True" ]; then
    # Create database indexes
    echo "# Creating database indexes"
    python manage.py create_indexes
fi
#!/usr/bin/env python
import os
import sys

# Load configuration values to Configuration class from DB without using Models 
# so that it can be used to initiate Django 


if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cometa_pj.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    
    # This load configurations from DB and set it to Configuration class
    from backend.utility.configurations import load_configurations
    load_configurations()
    
    # This initiates migrations for the first time and creates __init__.py file in migrations folder
    from initiate.initiate_setups import initiate_migrations
    initiate_migrations()

    execute_from_command_line(sys.argv)
    
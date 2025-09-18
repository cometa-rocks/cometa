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
    from backend.utility.configurations import load_configurations, setup_config_file_watcher
    load_configurations()
    if 'runserver' in sys.argv:
        setup_config_file_watcher()

    # This change is avoid dependency on .initiated file in the codebase
    # which often leads to confusion and override of default values in DB, 
    # instead directly check if default values are loaded from database
    from backend.utility.configurations import ConfigurationManager
    if len(sys.argv) >= 2 and sys.argv[1] == 'is_default_values_loaded':
        default_values_loaded = ConfigurationManager.get_configuration("DEFAULT_VALUES_LOADED", "True") == "True"
        if not default_values_loaded:
            print("False")
        else:
            print("True")        
        # Break the flow since request was to check if default values are loaded
        sys.exit(0)
    
    # Update database to set default values loaded to True
    if len(sys.argv) >= 2 and sys.argv[1] == 'set_default_values_loaded':
        ConfigurationManager.update_configuration_in_db("DEFAULT_VALUES_LOADED", "True", False)
        # Break the flow since request was to set default values loaded to True
        sys.exit(0)

        

    # This initiates migrations for the first time and creates __init__.py file in migrations folder
    from initiate.initiate_setups import initiate_migrations
    initiate_migrations()

    execute_from_command_line(sys.argv)
    
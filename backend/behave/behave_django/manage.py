#!/usr/bin/env python
import os
import sys

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "behave_django.settings")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and "
            "available on your PYTHONPATH environment variable? Did you "
            "forget to activate a virtual environment?"
        ) from exc
    
    # This is Behave configuration reader, which read configuration values before django starts
    from utility.configurations import load_configurations,   setup_config_file_watcher
    load_configurations()
    setup_config_file_watcher()
        
    execute_from_command_line(sys.argv)

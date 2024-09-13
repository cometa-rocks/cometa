"""
WSGI config for behave_django project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/2.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

# This is Behave configuration reader, which read configuration values before django starts
from utility.configurations import load_configurations   
load_configurations()

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "behave_django.settings")

application = get_wsgi_application()

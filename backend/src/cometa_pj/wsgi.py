"""
WSGI config for cometa_pj project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/2.0/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

from backend.utility.configurations import load_configurations   
load_configurations()

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cometa_pj.settings")

application = get_wsgi_application()

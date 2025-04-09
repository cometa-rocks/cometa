"""
ASGI config for api project.

It exposes the ASGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/asgi/
"""

import os
from django.core.asgi import get_asgi_application
from asgiref.compatibility import guarantee_single_callable

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'api.settings')

# Initialize Django ASGI application
django_application = get_asgi_application()

async def lifespan(scope, receive, send):
    message = await receive()
    if message["type"] == "lifespan.startup":
        # Do startup initialization here
        await send({"type": "lifespan.startup.complete"})
    elif message["type"] == "lifespan.shutdown":
        # Do cleanup here
        await send({"type": "lifespan.shutdown.complete"})

async def application(scope, receive, send):
    if scope["type"] == "lifespan":
        await lifespan(scope, receive, send)
    else:
        await django_application(scope, receive, send)

# Guarantee ASGI compatibility when Gunicorn workers set callable=application
application = guarantee_single_callable(application)

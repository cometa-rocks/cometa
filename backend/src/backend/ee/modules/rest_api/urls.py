# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from .views import (
    RestAPIViewset,
    compileJQ
)
from django.conf.urls import url
from cometa_pj.urls import router

# Rest API Endpoints
router.register(r'rest_api/(?P<id>[0-9]+)', RestAPIViewset)
router.register(r'rest_api', RestAPIViewset)

# static endpoints
static_endpoints = [
    url(r'^compile_jq/', compileJQ),
]
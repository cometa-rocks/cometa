# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from .views import (
    RestAPIViewset,
    compileJQ
)
from django.conf.urls import url



# Add new modules url here
# This keeps url.py file short and clean
def register_rest_api_routers(router) :        
    # Rest API Endpoints
    router.register(r'rest_api/(?P<id>[0-9]+)', RestAPIViewset)
    router.register(r'rest_api', RestAPIViewset)
    return router


# Add new modules url here
# This keeps url.py file short and clean
def register_rest_api_urlpatterns(urlpatterns) :

    urlpatterns = urlpatterns + [
        url(r'^compile_jq/', compileJQ),
    ]
    return urlpatterns
    
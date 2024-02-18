# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from .views import (
    ResponseHeadersViewSet,
    VulnerableHeaderViewSet
)
from rest_framework import routers
from django.urls import path, include

# network_headers Endpoints
router = routers.DefaultRouter()
router.register(r'network_headers', ResponseHeadersViewSet)
router.register(r'vulnerable_headers', VulnerableHeaderViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
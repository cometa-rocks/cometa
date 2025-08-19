from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HealeniumResultViewSet

router = DefaultRouter()
router.register(r'results', HealeniumResultViewSet, basename='healenium-result')

urlpatterns = [
    path('', include(router.urls)),
]

def register_healenium_routers(router):
    """Register Healenium routers with main router"""
    router.register(r'healenium/results', HealeniumResultViewSet, basename='healenium-result')
    return router
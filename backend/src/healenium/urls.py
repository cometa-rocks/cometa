from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HealeniumResultViewSet

router = DefaultRouter()
router.register(r'results', HealeniumResultViewSet, basename='healenium-result')

urlpatterns = [
    path('', include(router.urls)),
]
from django.conf.urls import url
from .views import save_healing_result

def register_healenium_routers(router):
    """Register Healenium routers """
    return router

def register_healenium_urlpatterns(urlpatterns):
    """Register Healenium URL patterns """
    urlpatterns = urlpatterns + [
        url(r'^api/healenium/results/save/$', save_healing_result),
    ]
    return urlpatterns
from django.conf.urls import url, include
from django.urls import path, re_path

from .security.urls import register_security_routers
from .mobile.urls import register_mobile_routers, register_mobile_urlpatterns
from .data_driven.urls import register_data_driven_urlpatterns, register_data_driven_routers
from .rest_api.urls import register_rest_api_routers, register_rest_api_urlpatterns
from .notification.urls import register_notification_urlpatterns
from .healenium.urls import register_healenium_routers


# Add new modules url here
# This keeps url.py file short and clean
def register_ee_modules_routers(router):
    router = register_security_routers(router)
    router = register_mobile_routers(router)
    router = register_data_driven_routers(router=router)
    router = register_rest_api_routers(router=router)
    router = register_healenium_routers(router=router)
    return router


# Add new modules url here
# This keeps url.py file short and clean
def register_ee_modules_urlpatterns(urlpatterns):
    urlpatterns = register_data_driven_urlpatterns(urlpatterns)
    urlpatterns = register_rest_api_urlpatterns(urlpatterns)
    urlpatterns = register_mobile_urlpatterns(urlpatterns)
    urlpatterns = register_notification_urlpatterns(urlpatterns)
    
    return urlpatterns
    



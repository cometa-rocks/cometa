from .configuration.views import ConfigurationViewSet 
from .housekeeping.views import HouseKeepingViewSet 
from .token_authentication.views import OIDCUserAppSecretViewSet, login_start_test
from .container_service.views import ContainerServiceViewSet, emulator_proxy_view
from django.conf.urls import url, include
from django.urls import path, re_path


# Add new modules url here
# This keeps url.py file short and clean
def register_modules_routers(router) :
    router.register(r'configuration', ConfigurationViewSet)
    router.register(r'housekeeping', HouseKeepingViewSet)
    router.register(r'container_service', ContainerServiceViewSet)
    router.register(r'secret', OIDCUserAppSecretViewSet)
    return router


# Add new modules url here
# This keeps url.py file short and clean
def register_modules_urlpatterns(urlpatterns) :

    urlpatterns = urlpatterns + [
        # url(r'^emulator/(?P<emulator_id>[0-9]+)/ ', emulator_proxy_view),
        re_path(r'^emulator/(?P<emulator_id>[0-9]+)/(?P<remaining_path>.*)$', emulator_proxy_view, name='emulator_proxy_view'),
        re_path(r'^integrations/v2/execute$', login_start_test, name='login_start_test'),
    ]
    return urlpatterns
    



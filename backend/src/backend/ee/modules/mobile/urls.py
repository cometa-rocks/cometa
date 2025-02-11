# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from .views import MobileViewSet, parseCometaMobiles

from django.conf.urls import url

# Add new modules url here
# This keeps url.py file short and clean
def register_mobile_routers(router):
    router.register(r"mobile", MobileViewSet)
    return router




# Add new modules url here
# This keeps url.py file short and clean
def register_mobile_urlpatterns(urlpatterns) :

    urlpatterns = urlpatterns + [
        url(r'^parse_mobiles/', parseCometaMobiles),
    ]
    return urlpatterns
    
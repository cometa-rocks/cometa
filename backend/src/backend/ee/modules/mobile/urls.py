# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from .views import MobileViewSet


# Add new modules url here
# This keeps url.py file short and clean
def register_mobile_routers(router):
    router.register(r"mobile", MobileViewSet)
    return router

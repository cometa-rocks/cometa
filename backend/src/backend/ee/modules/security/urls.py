# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from .views import (
    ResponseHeadersViewSet,
    VulnerableHeaderViewSet
)

# Add new modules url here
# This keeps url.py file short and clean
def register_security_routers(router) :
    router.register(r'security/network_headers', ResponseHeadersViewSet)
    router.register(r'security/vulnerable_headers', VulnerableHeaderViewSet)
    return router

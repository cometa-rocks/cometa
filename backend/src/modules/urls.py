from .configuration.views import ConfigurationViewSet 
from .housekeeping.views import HouseKeepingViewSet 


# Add new modules url here
# This keeps url.py file short and clean
def register_modules_routers(router) :
    router.register(r'configuration', ConfigurationViewSet)
    router.register(r'housekeeping', HouseKeepingViewSet)
    
    return router
    

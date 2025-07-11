# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from .views import (
    DataDrivenResultsViewset,
    DataDrivenFileViewset,
    DataDrivenViewset,
    runDataDriven,
    stop_data_driven_test,
    get_ddt_currently_running_feature,
    get_ddt_all_features
)
from django.conf.urls import url



# Add new modules url here
# This keeps url.py file short and clean
def register_data_driven_routers(router) :
    # DataDriven Endpoints        
    router.register(r'data_driven/results/(?P<run_id>[0-9]+)', DataDrivenResultsViewset)
    router.register(r'data_driven/file/(?P<file_id>[0-9]+)', DataDrivenFileViewset)
    router.register(r'data_driven/(?P<run_id>[0-9]+)', DataDrivenViewset)
    router.register(r'data_driven', DataDrivenViewset)
    return router




# Add new modules url here
# This keeps url.py file short and clean
def register_data_driven_urlpatterns(urlpatterns) :

    urlpatterns = urlpatterns + [
        url(r'^exec_data_driven/', runDataDriven),
        url(r'^stop_data_driven/(?P<run_id>[0-9]+)', stop_data_driven_test),
        url(r'^data_driven/(?P<run_id>[0-9]+)/current_feature/', get_ddt_currently_running_feature),
        url(r'^data_driven/(?P<run_id>[0-9]+)/all_features/', get_ddt_all_features),
    ]
    return urlpatterns
    

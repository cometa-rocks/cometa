from .views import (
    DataDrivenResultsViewset,
    DataDrivenFileViewset,
    DataDrivenViewset,
    runDataDriven
)
from django.conf.urls import url
from cometa_pj.urls import router

# DataDriven Endpoints
router.register(r'data_driven/results/(?P<run_id>[0-9]+)', DataDrivenResultsViewset)
router.register(r'data_driven/file/(?P<file_id>[0-9]+)', DataDrivenFileViewset)
router.register(r'data_driven/(?P<run_id>[0-9]+)', DataDrivenViewset)
router.register(r'data_driven', DataDrivenViewset)

# static endpoints
static_endpoints = [
    url(r'^exec_data_driven/', runDataDriven)
]
# author : Anand Kushwaha
# version : 10.0.2

from django.conf.urls import url, include
from django.urls import path, re_path
from .views_ee import getStepResultsGraph, get_versions

# Add new modules url here
# This keeps url.py file short and clean
# Implemented on 2024-05-08
def register_backend_modules_urlpatterns(urlpatterns) :
    urlpatterns = urlpatterns + [
        re_path(r'^api/reports/StepResultsGraph/(?P<step_result_id>.*)$', getStepResultsGraph, name='StepResultsGraph'),
        re_path(r'^api/services_version', get_versions, name='get_versions'),
    ]
    return urlpatterns
    



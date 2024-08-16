"""behave_django URL Configuration

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/2.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""

from django.contrib import admin
from django.urls import path, re_path
from schedules.views import (
    run_test,
    kill_task,
    update_configuration_in_memory,
    updated_step_actions,
)
from django.conf.urls import include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("run_test/", run_test),
    re_path("kill_task/(?P<pid>[0-9]+)/", kill_task),
    path("update_configuration", update_configuration_in_memory),
    path("updated_step_actions", updated_step_actions),
    # Django RQ URLS
    path("django-rq/", include("django_rq.urls")),
]

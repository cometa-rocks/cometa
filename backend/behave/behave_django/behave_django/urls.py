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
from schedules import views
from django.conf.urls import include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('run_test/', views.run_test),
    re_path('kill_task/(?P<pid>[0-9]+)/', views.kill_task),
    path('set_test_schedule/', views.set_test_schedule),
    path('remove_test_schedule/', views.remove_test_schedule),

    # Django RQ URLS
    path("django-rq/", include("django_rq.urls"))
]

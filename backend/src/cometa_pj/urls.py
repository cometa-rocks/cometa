from django.contrib import admin
from django.urls import path
from backend import views
from backend import payments
from django.conf.urls import url, include
from rest_framework import routers, serializers, viewsets
from rest_framework.documentation import include_docs_urls
from django.views.decorators.csrf import csrf_exempt
from backend.generatePDF import GeneratePDF
from django.views.decorators.cache import cache_page
from backend.common import *
import os
from django.views.static import serve
import re
from django.urls import re_path
router = routers.DefaultRouter()

#
# router.register URLs are exposed as https://server:8000/api/[xyz]
# ... Theses need to have a "class xyzViewSet" definition in views.py
# ... URLs registered here do not need extra URL patterns, as router.registered URLs
#     are automatically build and determined
#     Documentation: https://www.django-rest-framework.org/tutorial/6-viewsets-and-routers/
#
router.register(r'account_roles', views.AccountRoleViewSet)
router.register(r'feature_results/(?P<feature_result_id>[0-9]+)', views.FeatureResultViewSet)
router.register(r'feature_results', views.FeatureResultViewSet)
router.register(r'feature_results/(?P<feature_id>[0-9]+)/step_results/(?P<feature_result_id>[0-9]+)', views.StepResultViewSet)
# ask for all feature results by feature_id
router.register(r'feature_results_by_featureid', views.FeatureResultByFeatureIdViewSet)
router.register(r'step_result/(?P<step_result_id>[0-9]+)', views.StepResultViewSet)
router.register(r'environments/(?P<environment_id>[0-9]+)/(?P<environment_name>[0-9a-zA-Z -_.]+)', views.EnvironmentViewSet)
router.register(r'environments/(?P<environment_id>[0-9]+)', views.EnvironmentViewSet)
router.register(r'environments', views.EnvironmentViewSet)
router.register(r'browsers/(?P<browser_id>[0-9]+)', views.BrowserViewSet)
router.register(r'browsers', views.BrowserViewSet)
router.register(r'applications/(?P<app_id>[0-9]+)/(?P<app_name>[0-9a-zA-Z_.]+)', views.ApplicationViewSet)
router.register(r'applications/(?P<app_id>[0-9]+)', views.ApplicationViewSet)
router.register(r'applications', views.ApplicationViewSet)
router.register(r'integrations/(?P<id>[0-9]+)', views.IntegrationViewSet)
router.register(r'integrations', views.IntegrationViewSet)
router.register(r'departments/(?P<department_id>[0-9]+)', views.DepartmentViewSet)
router.register(r'departments', views.DepartmentViewSet)
router.register(r'steps', views.StepViewSet)
router.register(r'accounts/(?P<account_id>[0-9]+)', views.AccountViewset)
router.register(r'accounts', views.AccountViewset)
router.register(r'folder/feature', views.FolderFeatureViewset)
router.register(r'folders/(?P<folder_id>[0-9]+)', views.FolderViewset)
router.register(r'folders', views.FolderViewset)
router.register(r'features/(?P<feature_id>[0-9]+)/(?P<feature_name>.+)', views.FeatureViewSet)
router.register(r'features/(?P<feature_id>[0-9]+)', views.FeatureViewSet)
router.register(r'features', views.FeatureViewSet)
router.register(r'actions', views.ActionViewSet)
router.register(r'variables/(?P<id>[0-9]+)', views.VariablesViewSet)
router.register(r'variables', views.VariablesViewSet)
router.register(r'invite', views.InviteViewSet)
router.register(r'feature_run/(?P<run_id>[0-9]+)', views.FeatureRunViewSet)
router.register(r'feature_run', views.FeatureRunViewSet)
router.register(r'authproviders', views.AuthenticationProviderViewSet)
router.register(r'schedule', views.ScheduleViewSet)
router.register(r'subscriptions', views.SubscriptionsViewSet)
router.register(r'uploads/(?P<file_id>[0-9]+)', views.UploadViewSet)
router.register(r'uploads', views.UploadViewSet)
# provides numbers of system usage
router.register(r'cometausage', views.CometaUsageViewSet)

# Full path of static admin resources 
STATIC_ADMIN_FILES = os.path.dirname(admin.__file__) + '/static/'

# Allows to serve a folder within a subpath,
# same as original static() fn without DEBUG/Prefix restrictions
def static(prefix, view=serve, **kwargs):
    return [
        re_path(r'^%s(?P<path>.*)$' % re.escape(prefix.lstrip('/')), view, kwargs=kwargs),
    ]

urlpatterns = [
    url(r'^api/contact/', views.Contact),
    url(r'^api/', include(router.urls)),
    url(r'^addoidcaccount/', views.CreateOIDCAccount),
    url(r'^download/(?P<filepath>.+)/$', views.downloadFeatureFiles),
    # url(r'^screenshot/(?P<screenshot_name>[0-9a-zA-Z_.]+)/', views.Screenshot),
    url(r'^removeScreenshot/', views.removeScreenshot),
    url(r'^removeTemplate/', views.removeTemplate),
    url(r'^steps/(?P<step_result_id>[0-9]+)/update/', views.UpdatePixelDifference),
    url(r'^setScreenshots/(?P<step_result_id>[0-9]+)/', views.UpdateScreenshots),
    url(r'^steps/(?P<feature_id>[0-9]+)/', views.GetSteps),
    url(r'^updateTask/', views.UpdateTask),
    url(r'^getJson/(?P<feature_id>[0-9]+)/', views.GetJsonFile),
    url(r'^killTask/(?P<feature_id>[0-9]+)/', views.KillTask),
    url(r'^killTaskPID/(?P<pid>[0-9]+)/', views.KillTaskPID),
    url(r'^stepsByName/', views.GetStepsByName),
    url(r'^schedule/(?P<feature_id>.+)/', views.UpdateSchedule),
    url(r'^exectest/', views.runTest),
    url(r'^info/', views.GetInfo),
    url(r'^migrateScreenshots', views.MigrateScreenshots),
    url(r'^checkBrowserstackVideo', views.CheckBrowserstackVideo),
    url(r'^encrypt/', views.Encrypt),
    url(r'^parseActions/', views.parseActions),
    url(r'^parseBrowsers/', views.parseBrowsers),
    url(r'browsers/browserstack', cache_page(browserstackCacheTime)(views.GetBrowserStackBrowsers)),
    url(r'^feature_results/(?P<feature_result_id>[0-9]+)/log', views.getLog),
    url(r'^html_diff/(?P<step_result_id>[0-9]+)/', views.getHtmlDiff),
    path('admin/', admin.site.urls),
    url(r'^', include('rest_framework.urls', namespace='rest_framework')),
    url(r'^docs/', include_docs_urls(title='My API title')),
    url(r'^pdf/', GeneratePDF.as_view()),
    url(r'^userDetails/', views.userDetails),
    url(r'^isFeatureRunning/(?P<feature_id>[0-9]+)/', views.featureRunning),
    url(r'^noVNC/(?P<feature_result_id>[0-9]+)/', views.noVNCProxy),
    url(r'featureStatus/(?P<feature_id>[0-9]+)/', views.viewRunStatus),
    # Payments API
    url(r'^invoices/(?P<invoice_id>[0-9]+)/', payments.getInvoices),
    url(r'^invoices/', payments.getInvoices),
    url(r'^createPayment/', payments.createPaymentSession),
    url(r'^updatePayment/', payments.updatePayment),
    url(r'^customerPortal', payments.getCustomerPortal),
    url(r'^createDonation/', payments.createDonation),
    # Additional department updates
    url(r'^departments/(?P<department_id>[0-9]+)/updateStepTimeout/', views.UpdateStepTimeout),
    # Reporting
    url(r'^cometausage/', views.CometaUsage),
] + static('/static/', document_root=STATIC_ADMIN_FILES)

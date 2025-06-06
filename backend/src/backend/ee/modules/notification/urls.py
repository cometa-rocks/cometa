# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from .views import send_notifications

from django.conf.urls import url

# # Add new modules url here
# # This keeps url.py file short and clean
# def register_notification_routers(router):
#     # router.register(r"notification", MobileViewSet)
#     return router




# Add new modules url here
# This keeps url.py file short and clean
def register_notification_urlpatterns(urlpatterns) :

    urlpatterns = urlpatterns + [
        url(r'^send_notifications/', send_notifications),
    ]
    return urlpatterns
    
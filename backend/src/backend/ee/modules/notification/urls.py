# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from .views import send_notifications, telegram_webhook, set_telegram_webhook, subscribe_telegram_notifications, unsubscribe_telegram_notifications, list_telegram_subscriptions, link_telegram_chat, generate_auth_token, verify_auth_token
from .health import health_check_view, liveness_check_view, readiness_check_view

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
        # Telegram webhook endpoints
        url(r'^telegram/webhook/$', telegram_webhook),
        url(r'^telegram/set_webhook/$', set_telegram_webhook),
        # Telegram subscription management endpoints
        url(r'^telegram/subscribe/$', subscribe_telegram_notifications),
        url(r'^telegram/unsubscribe/$', unsubscribe_telegram_notifications),
        url(r'^telegram/subscriptions/$', list_telegram_subscriptions),
        url(r'^telegram/link/$', link_telegram_chat),
        # Authentication endpoints
        url(r'^generate_auth_token/$', generate_auth_token),
        url(r'^verify_auth_token/$', verify_auth_token),
        # Health check endpoints
        url(r'^health/$', health_check_view),
        url(r'^health/live/$', liveness_check_view),
        url(r'^health/ready/$', readiness_check_view),
    ]
    return urlpatterns
    
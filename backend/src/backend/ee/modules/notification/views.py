# Import all models and all the utility methods

from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework import viewsets, mixins

# Django Imports
from django.http import HttpResponse, JsonResponse
from .models import FeatureTelegramOptions
from .serializers import FeatureTelegramOptionsSerializer
from backend.utility.response_manager import ResponseManager
from backend.utility.functions import getLogger
from backend.utility.decorators import require_permissions
from backend.utility.config_handler import get_cometa_socket_url
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
import os, requests, traceback
import time
import re
import hmac
import ipaddress
from datetime import datetime, timedelta
import json
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from django.db import transaction
from django.core.cache import cache
from backend.models import Feature_result, Feature
from backend.utility.notification_manager import NotificationManger
from backend.utility.configurations import ConfigurationManager
from backend.views import GetUserDepartments, runFeature
from .models import TelegramSubscription, TelegramUserLink
from .exceptions import (
    handle_notification_error, ErrorContext, ValidationError,
    AuthenticationError, AuthorizationError, RateLimitError,
    WebhookError, SubscriptionError, MessageSendError,
    DatabaseError, ConfigurationError, validate_required_fields,
    safe_int_conversion
)
import gc
logger = getLogger()
import threading

from backend.generatePDF import PDFAndEmailManager
from backend.utility.variable_replacement import replace_feature_variables
from django.utils.html import escape


def escape_telegram_markdown(text):
    """
    Escape special characters for Telegram Markdown to prevent injection
    """
    if not text:
        return ""
    
    # Convert to string and escape markdown special characters
    text = str(text)
    # Escape special characters used in Telegram's Markdown
    escape_chars = ['*', '_', '`', '[', ']', '(', ')', '~', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!']
    for char in escape_chars:
        text = text.replace(char, f'\\{char}')
    return text


def _send_custom_email_notification(feature_result, subject, plain_message, html_message, custom_to=None, custom_cc=None, custom_bcc=None):
    """
    Send a custom email notification using custom or feature's configured recipients.
    
    Args:
        feature_result: Feature result object
        subject: Email subject
        plain_message: Plain text message
        html_message: HTML message
        custom_to: Custom TO recipients (comma-separated string or list), overrides feature config
        custom_cc: Custom CC recipients (comma-separated string or list), overrides feature config
        custom_bcc: Custom BCC recipients (comma-separated string or list), overrides feature config
    """
    import smtplib
    import socket
    
    feature = feature_result.feature_id
    
    # Helper function to parse recipients (handles both string and list)
    def parse_recipients(recipients):
        if recipients is None:
            return []
        if isinstance(recipients, list):
            return [email.strip() for email in recipients if email.strip()]
        if isinstance(recipients, str):
            return [email.strip() for email in recipients.split(',') if email.strip()]
        return []
    
    # Use custom recipients if provided, otherwise fall back to feature configuration
    if custom_to is not None or custom_cc is not None or custom_bcc is not None:
        # At least one custom recipient was specified
        to_addresses = parse_recipients(custom_to) if custom_to is not None else []
        cc_addresses = parse_recipients(custom_cc) if custom_cc is not None else []
        bcc_addresses = parse_recipients(custom_bcc) if custom_bcc is not None else []
    else:
        # No custom recipients, use feature configuration
        to_addresses = feature.email_address or []
        cc_addresses = feature.email_cc_address or []
        bcc_addresses = feature.email_bcc_address or []

    if not any([to_addresses, cc_addresses, bcc_addresses]):
        raise ConfigurationError("No email recipients configured for this feature")

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None) or getattr(settings, 'EMAIL_HOST_USER', None)
    if not from_email:
        raise ConfigurationError("Email sender is not configured")

    email = EmailMultiAlternatives(
        subject=subject,
        body=plain_message,
        from_email=from_email,
        to=to_addresses,
        cc=cc_addresses,
        bcc=bcc_addresses,
        headers={
            'X-COMETA': 'custom_notification',
            'X-COMETA-FEATURE': feature_result.feature_name,
            'X-COMETA-DEPARTMENT': feature_result.department_name
        }
    )
    email.attach_alternative(html_message, "text/html")

    try:
        email.send()
        logger.info(
            "Custom email notification sent",
            extra={
                "feature_id": feature_result.feature_id.feature_id,
                "feature_result_id": feature_result.feature_result_id,
                "recipients": to_addresses,
                "cc": cc_addresses,
                "bcc": bcc_addresses,
                "custom_recipients": custom_to is not None or custom_cc is not None or custom_bcc is not None,
            }
        )
    except smtplib.SMTPAuthenticationError as exc:
        logger.error(
            "SMTP authentication failed",
            exc_info=True,
            extra={
                "feature_id": feature_result.feature_id.feature_id,
                "feature_result_id": feature_result.feature_result_id,
                "error": str(exc),
                "smtp_host": getattr(settings, 'EMAIL_HOST', 'not configured')
            }
        )
        raise MessageSendError(f"SMTP authentication failed: {str(exc)}")
    except smtplib.SMTPConnectError as exc:
        logger.error(
            "SMTP connection failed",
            exc_info=True,
            extra={
                "feature_id": feature_result.feature_id.feature_id,
                "feature_result_id": feature_result.feature_result_id,
                "error": str(exc),
                "smtp_host": getattr(settings, 'EMAIL_HOST', 'not configured'),
                "smtp_port": getattr(settings, 'EMAIL_PORT', 'not configured')
            }
        )
        raise MessageSendError(f"SMTP connection failed: {str(exc)}")
    except socket.gaierror as exc:
        logger.error(
            "SMTP host DNS resolution failed",
            exc_info=True,
            extra={
                "feature_id": feature_result.feature_id.feature_id,
                "feature_result_id": feature_result.feature_result_id,
                "error": str(exc),
                "smtp_host": getattr(settings, 'EMAIL_HOST', 'not configured')
            }
        )
        raise MessageSendError(f"SMTP host not found: {str(exc)} - Check COMETA_EMAIL_HOST configuration")
    except OSError as exc:
        logger.error(
            "Network error connecting to SMTP",
            exc_info=True,
            extra={
                "feature_id": feature_result.feature_id.feature_id,
                "feature_result_id": feature_result.feature_result_id,
                "error": str(exc),
                "smtp_host": getattr(settings, 'EMAIL_HOST', 'not configured'),
                "smtp_port": getattr(settings, 'EMAIL_PORT', 'not configured')
            }
        )
        raise MessageSendError(f"Network error connecting to SMTP server: {str(exc)} - Check COMETA_EMAIL_HOST and network connectivity")
    except smtplib.SMTPException as exc:
        logger.error(
            "SMTP error occurred",
            exc_info=True,
            extra={
                "feature_id": feature_result.feature_id.feature_id,
                "feature_result_id": feature_result.feature_result_id,
                "error": str(exc),
                "error_type": type(exc).__name__
            }
        )
        raise MessageSendError(f"SMTP error: {type(exc).__name__} - {str(exc)}")
    except Exception as exc:
        logger.error(
            "Failed to send custom email notification",
            exc_info=True,
            extra={
                "feature_id": feature_result.feature_id.feature_id,
                "feature_result_id": feature_result.feature_result_id,
                "error": str(exc)
            }
        )
        raise MessageSendError(f"Failed to send custom email notification: {str(exc)}")


@csrf_exempt
@require_permissions("edit_feature")
@handle_notification_error
def send_custom_notification(request, **kwargs):
    """
    Send a custom notification for a specific feature result via email or Telegram.
    """
    if request.method != 'POST':
        raise ValidationError("Only POST method allowed", details={"method": request.method})

    try:
        payload = json.loads(request.body.decode("utf-8"))
    except (ValueError, TypeError):
        raise ValidationError("Invalid JSON payload")

    feature_result_id = payload.get('feature_result_id')
    if feature_result_id is None:
        raise ValidationError("feature_result_id parameter is required")
    feature_result_id = safe_int_conversion(feature_result_id, "feature_result_id", min_value=1)

    channel = (payload.get('channel') or '').strip().lower()
    if channel not in ('email', 'telegram'):
        raise ValidationError("channel must be either 'email' or 'telegram'", details={"channel": channel})

    raw_message = payload.get('message')
    if raw_message is None or str(raw_message).strip() == '':
        raise ValidationError("message parameter is required and cannot be empty")

    subject_template = payload.get('subject') or ''

    try:
        feature_result = Feature_result.objects.select_related('feature_id').get(
            feature_result_id=feature_result_id
        )
    except Feature_result.DoesNotExist:
        raise ValidationError(
            "Feature result not found",
            details={"feature_result_id": feature_result_id}
        )

    # Authorization: ensure user can access the feature's department unless SUPERUSER
    user = request.session.get('user', {})
    is_superuser = user.get('user_permissions', {}).get('permission_name') == "SUPERUSER"

    if not is_superuser:
        user_departments = GetUserDepartments(request)
        if feature_result.feature_id.department_id not in user_departments:
            raise AuthorizationError(
                "Access denied to this feature result",
                details={"feature_result_id": feature_result_id}
            )

    telegram_notification_data = None
    telegram_notification_header = request.META.get('HTTP_X_TELEGRAM_NOTIFICATION')
    if telegram_notification_header:
        try:
            telegram_notification_data = json.loads(telegram_notification_header)
            logger.info(
                "Custom notification received Telegram context",
                extra={
                    "feature_result_id": feature_result_id,
                    "telegram_chat_id": telegram_notification_data.get("telegram_chat_id")
                }
            )
        except json.JSONDecodeError:
            logger.warning(
                "Failed to parse X-Telegram-Notification header for custom notification",
                extra={
                    "feature_result_id": feature_result_id,
                    "header_value": telegram_notification_header
                }
            )

    if telegram_notification_data:
        feature_result.telegram_notification = telegram_notification_data

    # Variable replacement
    subject_template = subject_template if subject_template else f"Custom notification - {feature_result.feature_name}"
    subject_processed = replace_feature_variables(subject_template, feature_result, use_html_breaks=False)
    subject_processed = " ".join(subject_processed.splitlines()).strip()
    if not subject_processed:
        subject_processed = f"Custom notification - {feature_result.feature_name}"

    message_with_variables = replace_feature_variables(str(raw_message), feature_result, use_html_breaks=False)
    message_with_variables = message_with_variables.replace('\r\n', '\n')

    if channel == 'email':
        # Extract custom recipients from payload (optional)
        custom_to = payload.get('to')
        custom_cc = payload.get('cc')
        custom_bcc = payload.get('bcc')
        
        html_message = f'<pre style="white-space: pre-wrap;">{escape(message_with_variables)}</pre>'
        _send_custom_email_notification(
            feature_result, 
            subject_processed, 
            message_with_variables, 
            html_message,
            custom_to=custom_to,
            custom_cc=custom_cc,
            custom_bcc=custom_bcc
        )
    else:
        # Extract custom Telegram settings from payload (optional)
        custom_bot_token = payload.get('telegram_bot_token')
        custom_chat_id = payload.get('telegram_chat_id')
        custom_thread_id = payload.get('telegram_thread_id')
        
        feature_result.custom_notification = {
            "message": message_with_variables,
            "parse_mode": None,
            "attach_pdf": False,
            "attach_screenshots": False,
            "custom_bot_token": custom_bot_token,
            "custom_chat_id": custom_chat_id,
            "custom_thread_id": custom_thread_id
        }
        notification_manager = NotificationManger("telegram", pdf_generated=False)
        if not notification_manager.send_message(feature_result):
            raise MessageSendError("Failed to send Telegram notification")

    return JsonResponse({
        "success": True,
        "channel": channel,
        "feature_result_id": feature_result_id
    })


@require_permissions("edit_feature")
@handle_notification_error
def send_notifications(request, **kwargs):
    """
    Send notifications for a feature result.
    
    This endpoint triggers notification sending for a specific feature result.
    It validates the request, checks permissions, and starts an async notification process.
    """
    if request.method != 'GET':
        raise ValidationError("Only GET method allowed", details={"method": request.method})
    
    # Validate and extract feature_result_id
    feature_result_id = request.GET.get('feature_result_id')
    if not feature_result_id:
        raise ValidationError("feature_result_id parameter is required")
    
    # Convert and validate feature_result_id
    feature_result_id = safe_int_conversion(feature_result_id, "feature_result_id", min_value=1)
    
    logger.info(f"Processing notification request for feature_result_id: {feature_result_id}")
    
    # Use database transaction for consistency
    with transaction.atomic():
        # Verify feature result exists
        try:
            feature_result = Feature_result.objects.select_for_update().get(
                feature_result_id=feature_result_id
            )
        except Feature_result.DoesNotExist:
            raise ValidationError(
                "Feature result not found",
                details={"feature_result_id": feature_result_id}
            )
        
        # Check if telegram notification data was passed in headers
        telegram_notification_data = None
        telegram_notification_header = request.META.get('HTTP_X_TELEGRAM_NOTIFICATION')
        logger.debug(f"Checking for telegram notification header. META keys: {[k for k in request.META.keys() if 'TELEGRAM' in k or 'telegram' in k]}")
        if telegram_notification_header:
            logger.info(f"Found telegram notification header: {telegram_notification_header}")
            try:
                telegram_notification_data = json.loads(telegram_notification_header)
                logger.info(f"Telegram notification data received for feature_result {feature_result_id}")
            except json.JSONDecodeError:
                logger.error(f"Failed to parse telegram notification header: {telegram_notification_header}")
        else:
            logger.debug("No telegram notification header found")
        
        # Check user has access to the feature's department
        # Skip department check for SUPERUSER (used for internal requests from behave environment)
        user = request.session.get('user', {})
        is_superuser = user.get('user_permissions', {}).get('permission_name') == "SUPERUSER"
        
        if not is_superuser:
            user_departments = GetUserDepartments(request)
            if feature_result.feature_id.department_id not in user_departments:
                logger.warning(
                    f"Unauthorized access attempt to feature_result_id {feature_result_id}",
                    extra={
                        "user": user.get('user_id'),
                        "feature_department": feature_result.feature_id.department_id,
                        "user_departments": user_departments
                    }
                )
                raise AuthorizationError(
                    "Access denied to this feature",
                    details={"feature_result_id": feature_result_id}
                )
        else:
            logger.info(f"SUPERUSER notification request for feature_result_id: {feature_result_id}")
    
    # Start notification thread with error handling
    with ErrorContext("Starting notification thread"):
        notification = threading.Thread(
            target=notification_handler,
            args=(request, feature_result_id, telegram_notification_data),
            name=f"notification-{feature_result_id}"
        )
        notification.daemon = True
        notification.start()
    
    logger.info(
        f"Notification thread started successfully",
        extra={"feature_result_id": feature_result_id, "thread_name": notification.name}
    )
    
    return JsonResponse({
        'success': True,
        'message': 'Notification process started',
        'feature_result_id': feature_result_id
    })

    

def notification_handler(request, feature_result_id, telegram_notification_data=None):
    """
    Handle notification sending in a separate thread.
    
    This function runs asynchronously to process and send notifications
    without blocking the main request thread.
    """
    try:
        with ErrorContext("Preparing PDF manager"):
            pdf_email_manager = PDFAndEmailManager()
            # prepares the PDF and send the email
            pdf_email_manager.prepare_the_get(request=request)
        
        # Get the feature result with proper error handling
        with ErrorContext("Fetching feature result"):
            try:
                feature_result = Feature_result.objects.get(feature_result_id=feature_result_id)
            except Feature_result.DoesNotExist:
                logger.error(
                    f"Feature result not found in notification handler",
                    extra={"feature_result_id": feature_result_id}
                )
                return
        
        # Attach telegram notification data to feature_result if available
        # This must be done BEFORE creating the notification manager
        if telegram_notification_data:
            feature_result.telegram_notification = telegram_notification_data
            logger.info(f"Attached telegram notification data to feature_result: {telegram_notification_data}")
        
        # Create and use notification manager
        with ErrorContext("Sending notification"):
            notification_manager = NotificationManger("telegram", pdf_email_manager.is_pdf_generated())
            logger.debug(
                "Created Telegram notification manager",
                extra={"feature_result_id": feature_result_id}
            )
            
            result = notification_manager.send_message(feature_result)
            
            if result:
                logger.info(
                    "Notification sent successfully",
                    extra={"feature_result_id": feature_result_id}
                )
            else:
                logger.warning(
                    "Notification sending returned false",
                    extra={"feature_result_id": feature_result_id}
                )
                
    except Exception as e:
        logger.error(
            f"Error in notification handler",
            exc_info=True,
            extra={
                "feature_result_id": feature_result_id,
                "error": str(e)
            }
        )
    finally:
        collected = gc.collect()
        logger.info(f"Garbage collector: collected {collected} objects.")
        

# ========================= Telegram Webhook =========================
@csrf_exempt
@handle_notification_error
def telegram_webhook(request):
    """
    Entry-point called by Telegram when a new update is available (webhook).
    
    This view performs minimal validation and handles Telegram updates
    following best practices:
    - Verify the optional secret token header when configured
    - Always return HTTP 200 as fast as possible (< 1s)
    - Execute any long-running logic asynchronously
    """
    if request.method != "POST":
        raise ValidationError("Invalid method", details={"method": request.method})

    # Validate secret token (MANDATORY for security)
    expected_secret = ConfigurationManager.get_configuration("COMETA_TELEGRAM_WEBHOOK_SECRET", "")
    if not expected_secret:
        logger.error("COMETA_TELEGRAM_WEBHOOK_SECRET not configured - webhook security disabled!")
        raise ConfigurationError("Webhook secret token must be configured for security")
    
    # Validate secret token format (1-256 chars, A-Z, a-z, 0-9, _, -)
    if not re.match(r'^[A-Za-z0-9_-]{1,256}$', expected_secret):
        logger.error("Invalid webhook secret format in configuration")
        raise ConfigurationError("Webhook secret must be 1-256 characters using only A-Z, a-z, 0-9, _, -")
    
    # IP Whitelisting for Telegram servers (2025 official ranges)
    client_ip = request.META.get('HTTP_X_FORWARDED_FOR', request.META.get('REMOTE_ADDR', 'unknown'))
    if client_ip != 'unknown' and ',' in client_ip:
        client_ip = client_ip.split(',')[0].strip()
    
    # Telegram's official IP ranges (as of 2025)
    telegram_ip_ranges = [
        ipaddress.ip_network('149.154.160.0/20'),
        ipaddress.ip_network('91.108.4.0/22'),
    ]
    
    if client_ip != 'unknown':
        try:
            client_ip_obj = ipaddress.ip_address(client_ip)
            ip_allowed = any(client_ip_obj in network for network in telegram_ip_ranges)
            if not ip_allowed:
                logger.warning(
                    f"Rejected webhook from unauthorized IP: {client_ip}",
                    extra={"ip": client_ip, "user_agent": request.META.get('HTTP_USER_AGENT', '')}
                )
                raise AuthenticationError("Unauthorized IP address")
        except ValueError:
            logger.warning(f"Invalid IP address format: {client_ip}")
            raise AuthenticationError("Invalid IP address")
    
    received_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    
    # Use timing-attack resistant comparison
    if not hmac.compare_digest(received_secret.strip(), expected_secret.strip()):
        
        logger.warning(
            "Rejected Telegram webhook call due to invalid secret token",
            extra={
                "ip": client_ip,
                "user_agent": request.META.get('HTTP_USER_AGENT', ''),
                "received_secret_length": len(received_secret) if received_secret else 0
            }
        )
        
        # Rate limiting for failed attempts
        from django.core.cache import cache
        rate_key = f"webhook_fail_{client_ip}"
        failures = cache.get(rate_key, 0)
        if failures >= 5:  # Max 5 failures per hour
            logger.error(f"Webhook rate limit exceeded for IP {client_ip}")
            raise AuthenticationError("Rate limit exceeded")
        cache.set(rate_key, failures + 1, 3600)  # 1 hour timeout
        
        raise AuthenticationError("Invalid webhook secret")

    # Periodic cleanup of expired tokens (run occasionally)
    _cleanup_expired_tokens()
    
    # Parse the incoming update JSON
    try:
        update = json.loads(request.body.decode("utf-8"))
    except ValueError:
        logger.warning("Telegram webhook received invalid JSON payload")
        return JsonResponse({"success": False, "error": "Invalid JSON"}, status=400)

    # logger.debug(f"Telegram webhook update received: {update}")  # Commented for production

    # Handle callback queries (button presses)
    callback_query = update.get("callback_query")
    if callback_query:
        chat_id = callback_query.get("from", {}).get("id")
        data = callback_query.get("data", "")
        bot_token = ConfigurationManager.get_configuration("COMETA_TELEGRAM_BOT_TOKEN", None)
        
        if bot_token and chat_id:
            if data == "subscribe_notifications":
                reply_text = (
                    "To subscribe to notifications:\n\n"
                    "1. Log in to Cometa web interface\n"
                    "2. Navigate to your feature settings\n"
                    "3. Click 'Subscribe Notifications' button\n"
                    "4. I'll automatically link your Telegram account\n\n"
                    f"Your Chat ID: `{chat_id}`\n"
                    "Use this ID in the web interface if needed."
                )
                
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                payload = {
                    "chat_id": chat_id,
                    "text": reply_text,
                    "parse_mode": "Markdown",
                }
                try:
                    requests.post(url, json=payload, timeout=5)
                except Exception as exc:
                    logger.warning(f"Failed to send Telegram reply: {exc}")
                    
            elif data.startswith("dept_"):
                # Handle department selection - show features in that department
                department_id = int(data.replace("dept_", ""))
                try:
                    # Get user link
                    user_link = TelegramUserLink.objects.get(chat_id=str(chat_id), is_active=True, is_verified=True)
                    logger.info(f"Department selection - Chat ID: {chat_id}, User ID: {user_link.user_id}, Department: {department_id}")
                    
                    # Get unsubscribed features using manager
                    from .managers import TelegramSubscriptionManager
                    department_features = TelegramSubscriptionManager.get_user_unsubscribed_features(
                        user_link.user_id, department_id
                    )
                    logger.info(f"Found {len(department_features)} unsubscribed features for user {user_link.user_id}")
                    
                    if department_features:
                        # Get department name
                        from backend.models import Department
                        department = Department.objects.get(department_id=department_id)
                        
                        reply_text = (
                            f"*Features in {escape_telegram_markdown(department.department_name)}*\n\n"
                            f"Select a feature to subscribe to notifications:\n"
                            f"You'll receive alerts when these features run."
                        )
                        
                        # Create inline keyboard buttons for features
                        keyboard = []
                        logger.info(f"Creating buttons for {len(department_features)} features")
                        for feature in department_features:  # Show all features
                            button_text = f"{feature['feature_id']} - {feature['feature_name']}"
                            callback_data = f"sub_feature_{feature['feature_id']}"
                            keyboard.append([{"text": button_text, "callback_data": callback_data}])
                            logger.debug(f"Added button: {button_text}")
                        
                        # Add navigation buttons
                        keyboard.append([
                            {"text": "Back to Departments", "callback_data": "back_to_departments"},
                            {"text": "Cancel", "callback_data": "cancel"}
                        ])
                        
                        reply_markup = {"inline_keyboard": keyboard}
                    else:
                        reply_text = (
                            f"*No Features Found*\n\n"
                            f"No features found in this department or you don't have access to them."
                        )
                        
                        # Add navigation buttons
                        keyboard = [[
                            {"text": "Back to Departments", "callback_data": "back_to_departments"},
                            {"text": "Cancel", "callback_data": "cancel"}
                        ]]
                        reply_markup = {"inline_keyboard": keyboard}
                    
                except TelegramUserLink.DoesNotExist:
                    reply_text = (
                        "*Account Not Linked*\n\n"
                        "Your Telegram account is not linked to a Cometa user.\n"
                        "Please use `/auth` to link your account first."
                    )
                except Exception as e:
                    logger.error(f"Error in department selection callback: {str(e)}")
                    reply_text = (
                        "*Error Loading Features*\n\n"
                        "An error occurred while loading features. Please try again later."
                    )
                
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                payload = {
                    "chat_id": chat_id,
                    "text": reply_text,
                    "parse_mode": "Markdown",
                }
                if 'reply_markup' in locals():
                    payload["reply_markup"] = reply_markup
                    logger.info(f"Sending message with {len(reply_markup.get('inline_keyboard', [])) - 1} feature buttons + navigation")
                
                try:
                    response = requests.post(url, json=payload, timeout=5)
                    if not response.ok:
                        logger.error(f"Telegram API error: {response.status_code} - {response.text}")
                    else:
                        logger.info("Successfully sent department features message")
                except Exception as exc:
                    logger.warning(f"Failed to send Telegram reply: {exc}")
                    
            elif data.startswith("sub_feature_"):
                # Handle feature subscription button click
                feature_id = data.replace("sub_feature_", "")
                try:
                    # Use centralized OAuth validation
                    from .telegram_auth import TelegramAuthenticationHandler, AuthenticationError
                    user_link, oidc_account = TelegramAuthenticationHandler.validate_telegram_user(
                        chat_id=str(chat_id),
                        require_verified=True
                    )
                    
                    # Use atomic transaction for subscription creation
                    with transaction.atomic():
                        # Get feature details with select_for_update to prevent concurrent modifications
                        feature = Feature.objects.select_for_update().get(feature_id=feature_id)
                        
                        # Create subscription
                        subscription, created = TelegramSubscription.objects.get_or_create(
                            user_id=user_link.user_id,
                            chat_id=str(chat_id),
                            feature_id=feature_id,
                            defaults={
                                'department_id': feature.department_id,
                                'environment_id': feature.environment_id,
                                'notification_types': ['on_failure', 'on_success'],
                                'is_active': True
                            }
                        )
                    
                    if created:
                        reply_text = (
                            f"✅ *Subscription Created*\n\n"
                            f"You're now subscribed to notifications for:\n"
                            f"**{escape_telegram_markdown(feature.feature_name)}** (ID: {feature_id})\n\n"
                            f"You'll receive alerts when this feature runs."
                        )
                    else:
                        # Should only happen if already subscribed and active
                        reply_text = (
                            f"*Already Subscribed*\n\n"
                            f"You're already subscribed to notifications for:\n"
                            f"**{escape_telegram_markdown(feature.feature_name)}** (ID: {feature_id})"
                        )
                    
                    # Update last interaction
                    user_link.last_interaction = datetime.now()
                    user_link.save()
                    
                except (AuthenticationError, TelegramUserLink.DoesNotExist) as e:
                    logger.info(f"Authentication failed for feature subscription: {str(e)}")
                    reply_text = (
                        "*Account Not Linked*\n\n"
                        "Your Telegram account is not linked to a Cometa user.\n"
                        "Please use `/auth` to link your account first."
                    )
                except Feature.DoesNotExist:
                    reply_text = (
                        "*Feature Not Found*\n\n"
                        "The selected feature could not be found or you don't have access to it."
                    )
                except Exception as e:
                    logger.error(f"Error in feature subscription callback: {str(e)}")
                    reply_text = (
                        "*Subscription Failed*\n\n"
                        "An error occurred while creating your subscription. Please try again later."
                    )
                
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                payload = {
                    "chat_id": chat_id,
                    "text": reply_text,
                    "parse_mode": "Markdown",
                }
                try:
                    requests.post(url, json=payload, timeout=5)
                except Exception as exc:
                    logger.warning(f"Failed to send Telegram reply: {exc}")
                    
            elif data == "back_to_departments":
                # Handle back to departments navigation
                try:
                    # Use centralized OAuth validation
                    from .telegram_auth import TelegramAuthenticationHandler, AuthenticationError
                    user_link, oidc_account = TelegramAuthenticationHandler.validate_telegram_user(
                        chat_id=str(chat_id),
                        require_verified=True
                    )
                    accessible_departments = get_user_accessible_departments(user_link.user_id)
                    
                    if accessible_departments:
                        reply_text = (
                            "🏢 *Select Department*\n\n"
                            "Choose a department to view its features:\n"
                            "You can subscribe to notifications for features in these departments."
                        )
                        
                        # Create inline keyboard buttons for departments
                        keyboard = []
                        for dept in accessible_departments:
                            button_text = f"{dept['department_id']} - {dept['department_name']}"
                            callback_data = f"dept_{dept['department_id']}"
                            keyboard.append([{"text": button_text, "callback_data": callback_data}])
                        
                        # Add Cancel button
                        keyboard.append([{"text": "Cancel", "callback_data": "cancel"}])
                        
                        reply_markup = {"inline_keyboard": keyboard}
                    else:
                        reply_text = (
                            "*No Departments Available*\n\n"
                            "You don't have access to any departments."
                        )
                        
                except (AuthenticationError, TelegramUserLink.DoesNotExist) as e:
                    logger.info(f"Authentication failed for back_to_departments: {str(e)}")
                    reply_text = (
                        "*Account Not Linked*\n\n"
                        "Your Telegram account is not linked to a Cometa user.\n"
                        "Please use `/auth` to link your account first."
                    )
                
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                payload = {
                    "chat_id": chat_id,
                    "text": reply_text,
                    "parse_mode": "Markdown",
                }
                if 'reply_markup' in locals():
                    payload["reply_markup"] = reply_markup
                try:
                    requests.post(url, json=payload, timeout=5)
                except Exception as exc:
                    logger.warning(f"Failed to send Telegram reply: {exc}")
                    
            elif data == "cancel":
                # Handle cancel action
                reply_text = (
                    "*Cancelled*\n\n"
                    "Operation cancelled. Use `/subscribe` to start over or `/help` for more options."
                )
                
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                payload = {
                    "chat_id": chat_id,
                    "text": reply_text,
                    "parse_mode": "Markdown",
                }
                try:
                    requests.post(url, json=payload, timeout=5)
                except Exception as exc:
                    logger.warning(f"Failed to send Telegram reply: {exc}")
                    
            elif data.startswith("unsub_feature_"):
                # Handle feature unsubscription button click
                feature_id = data.replace("unsub_feature_", "")
                try:
                    # Use centralized OAuth validation
                    from .telegram_auth import TelegramAuthenticationHandler, AuthenticationError
                    user_link, oidc_account = TelegramAuthenticationHandler.validate_telegram_user(
                        chat_id=str(chat_id),
                        require_verified=True
                    )
                    
                    # Get subscription
                    subscription = TelegramSubscription.objects.get(
                        user_id=user_link.user_id,
                        chat_id=str(chat_id),
                        feature_id=feature_id
                    )
                    
                    # Use atomic transaction for unsubscribe
                    with transaction.atomic():
                        # Get feature details for confirmation message
                        feature = Feature.objects.select_for_update().get(feature_id=feature_id)
                        
                        # Delete subscription instead of deactivating
                        subscription.delete()
                    
                    reply_text = (
                        f"✅ *Unsubscribed Successfully*\n\n"
                        f"You will no longer receive notifications for:\n"
                        f"**{escape_telegram_markdown(feature.feature_name)}** (ID: {feature_id})\n\n"
                        f"Use `/subscribe` to re-enable notifications for this feature."
                    )
                    
                except (AuthenticationError, TelegramUserLink.DoesNotExist) as e:
                    logger.info(f"Authentication failed for feature unsubscription: {str(e)}")
                    reply_text = (
                        "*Account Not Linked*\n\n"
                        "Your Telegram account is not linked to a Cometa user.\n"
                        "Please use `/auth` to link your account first."
                    )
                except TelegramSubscription.DoesNotExist:
                    reply_text = (
                        "*Subscription Not Found*\n\n"
                        "This subscription was not found or is already inactive."
                    )
                except Feature.DoesNotExist:
                    reply_text = (
                        "*Feature Not Found*\n\n"
                        "The selected feature could not be found."
                    )
                except Exception as e:
                    logger.error(f"Error in feature unsubscription callback: {str(e)}")
                    reply_text = (
                        "❌ *Unsubscription Failed*\n\n"
                        "An error occurred while unsubscribing. Please try again later."
                    )
                
                url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                payload = {
                    "chat_id": chat_id,
                    "text": reply_text,
                    "parse_mode": "Markdown",
                }
                try:
                    requests.post(url, json=payload, timeout=5)
                except Exception as exc:
                    logger.warning(f"Failed to send Telegram reply: {exc}")

    # Handle regular text messages
    message = update.get("message") or update.get("edited_message")
    if message:
        chat_id = message.get("chat", {}).get("id")
        text = message.get("text", "").strip()
        if chat_id and text:
            bot_token = ConfigurationManager.get_configuration("COMETA_TELEGRAM_BOT_TOKEN", None)
            if bot_token:
                reply_text = None
                lower = text.lower()
                if lower in ["/start", "/help"]:
                    reply_text = (
                        "Hi! I’m *Cometa Bot*.\n\n"
                        "I help you stay updated on your test executions. Here's what I can do:\n\n"
                        "📋 *Available Commands:*\n"
                        "• `/help` - Show this help message\n"
                        "• `/auth` - Link your Cometa account (required first)\n"
                        "• `/status` - Check your authentication status\n"
                        "• `/logout` - Disconnect your Telegram account\n"
                        "• `/subscribe` - Subscribe to test notifications\n"
                        "• `/unsubscribe` - Manage your subscriptions\n"
                        "• `/subscriptions` - View your active subscriptions\n"
                        "• `/run <id>` - Execute a feature by ID\n"
                        "• `/ping` - Check if I'm alive\n"
                        "• `/chatid` - Get your Telegram chat ID\n\n"
                        "*Getting Started:*\n"
                        "1. Use `/auth` to link your Cometa account\n"
                        "2. Use `/subscribe` to choose features to monitor\n"
                        "3. Use `/run <id>` to execute features remotely\n"
                        "4. Receive instant notifications when tests run!\n\n"
                        "*Tips:*\n"
                        "• You must authenticate before subscribing or running features\n"
                        "• You can subscribe to multiple features\n"
                        "• Notifications include test results and logs\n"
                        "• Use `/subscriptions` to see feature IDs for `/run` command"
                    )
                elif lower == "/ping":
                    reply_text = "pong 🏓"
                elif lower == "/chatid":
                    reply_text = f"Your Chat ID: `{chat_id}`"
                elif lower == "/status":
                    # Check authentication status
                    try:
                        user_link = TelegramUserLink.objects.get(chat_id=str(chat_id))
                        if user_link.is_verified and user_link.user_id > 0:
                            # Get user details
                            from backend.models import OIDCAccount
                            try:
                                user = OIDCAccount.objects.get(user_id=user_link.user_id)
                                reply_text = (
                                    "✅ *Authentication Status: Linked*\n\n"
                                    f"*User:* {escape_telegram_markdown(user.name)}\n"
                                    f"*Email:* {user.email}\n"
                                    f"*User ID:* {user_link.user_id}\n"
                                    f"*Chat ID:* {chat_id}\n"
                                    f"*Linked on:* {user_link.created_on.strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"
                                    "You can use `/subscribe` to manage notifications."
                                )
                            except OIDCAccount.DoesNotExist:
                                reply_text = (
                                    "⚠️ *Authentication Status: Partially Linked*\n\n"
                                    f"Your Telegram is linked but the user account was not found.\n"
                                    f"*Chat ID:* {chat_id}\n\n"
                                    "Try `/auth` to re-authenticate."
                                )
                        else:
                            reply_text = (
                                "❌ *Authentication Status: Not Verified*\n\n"
                                f"*Chat ID:* {chat_id}\n"
                                "Your account exists but is not verified.\n\n"
                                "Use `/auth` to complete the authentication process."
                            )
                    except TelegramUserLink.DoesNotExist:
                        reply_text = (
                            "❌ *Authentication Status: Not Linked*\n\n"
                            f"*Chat ID:* {chat_id}\n"
                            "No account linked to this Telegram chat.\n\n"
                            "Use `/auth` to get started."
                        )
                elif lower == "/auth":
                    # Check if user is already authenticated
                    try:
                        existing_link = TelegramUserLink.objects.get(
                            chat_id=str(chat_id),
                            is_verified=True,
                            is_active=True
                        )
                        if existing_link.user_id > 0:
                            # User is already authenticated
                            from backend.models import OIDCAccount
                            try:
                                user = OIDCAccount.objects.get(user_id=existing_link.user_id)
                                reply_text = (
                                    "*Already Authenticated*\n\n"
                                    f"You are already logged in as:\n"
                                    f"*{escape_telegram_markdown(user.name)}*\n"
                                    f"Email: {escape_telegram_markdown(user.email)}\n\n"
                                    "• Use `/subscribe` to manage notifications\n"
                                    "• Use `/status` to see your details\n"
                                    "• Use `/logout` to disconnect your account"
                                )
                            except OIDCAccount.DoesNotExist:
                                # User link exists but user not found - allow re-auth
                                existing_link.is_verified = False
                                existing_link.user_id = 0
                                existing_link.save()
                                # Continue to auth flow below
                                existing_link = None
                        else:
                            # Link exists but not properly verified
                            existing_link = None
                    except TelegramUserLink.DoesNotExist:
                        existing_link = None
                    
                    # Only proceed with auth if not already authenticated
                    if existing_link is None:
                        # Generate authentication token and deep link
                        try:
                            # Get or create the user link first
                            user_link, created = TelegramUserLink.objects.get_or_create(
                                chat_id=str(chat_id),
                                defaults={
                                    'user_id': 0,  # Temporary, will be set during OAuth callback
                                    'is_active': True,
                                    'is_verified': False
                                }
                            )
                            
                            # Check rate limiting based on last_auth_attempt
                            if user_link.last_auth_attempt and user_link.last_auth_attempt >= timezone.now() - timezone.timedelta(minutes=1):
                                # Check how many attempts in the last minute
                                time_since_last = timezone.now() - user_link.last_auth_attempt
                                if time_since_last.total_seconds() < 20:  # Less than 20 seconds since last attempt
                                    reply_text = (
                                        "*Rate Limited*\n\n"
                                        "Please wait a moment before requesting another authentication link.\n"
                                        f"Try again in {20 - int(time_since_last.total_seconds())} seconds."
                                    )
                                    # Send the rate limit message and return early
                                    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                                    payload = {
                                        "chat_id": chat_id,
                                        "text": reply_text,
                                        "parse_mode": "Markdown",
                                    }
                                    requests.post(url, json=payload, timeout=10)
                                    return JsonResponse({"success": True})
                            
                            # Use atomic transaction for token generation
                            with transaction.atomic():
                                # If existing link found, ensure it's reset for new auth
                                if not created:
                                    user_link.user_id = 0
                                    user_link.is_verified = False
                                    user_link.is_active = True
                                    # Clear any old token
                                    user_link.auth_token = None
                                    user_link.auth_token_expires = None
                                
                                # Update last auth attempt time
                                user_link.last_auth_attempt = timezone.now()
                                user_link.save()
                                
                                # Generate new auth token
                                token = user_link.generate_auth_token()
                            
                            if not token:
                                logger.error(f"Failed to generate auth token for chat_id: {chat_id}")
                                reply_text = (
                                    "*Token Generation Failed*\n\n"
                                    "Unable to generate authentication token. Please try again."
                                )
                            else:
                                logger.info(f"Generated auth token for chat_id {chat_id}: {token[:8]}...")
                                
                                # Build authentication URL - environment agnostic
                                # Check if we're in development (ngrok) or production
                                environment = os.getenv('ENVIRONMENT', 'prod')
                                
                                # Use the utility function to get the appropriate domain
                                from backend.utility.ngrok_utils import get_telegram_auth_domain
                                domain = get_telegram_auth_domain(environment)
                                auth_url = f"https://{domain}/auth/telegram/{token}/"
                                
                                # Always use GitLab OAuth
                                oauth_provider = "GitLab"
                                
                                # For development, provide the actual link since localhost might not render
                                if environment == 'dev':
                                    reply_text = (
                                        f"🔐 *{oauth_provider} Authentication*\n\n"
                                        f"Click the link below to authenticate with your {oauth_provider} account:\n\n"
                                        f"`{auth_url}`\n\n"
                                        "This link expires in 5 minutes.\n"
                                        "After authentication, you'll have access to all your features!\n\n"
                                        "Note: You may need to copy and paste this link into your browser."
                                    )
                                else:
                                    reply_text = (
                                        f"🔐 *{oauth_provider} Authentication*\n\n"
                                        f"Click the link below to authenticate with your {oauth_provider} account:\n\n"
                                        f"[Authenticate with {oauth_provider}]({auth_url})\n\n"
                                        "This link expires in 5 minutes.\n"
                                        "After authentication, you'll have access to all your features!"
                                    )
                                
                        except Exception as e:
                            logger.error(f"Error generating auth token: {str(e)}")
                            traceback.print_exc()
                            reply_text = (
                                "*Authentication Service Unavailable*\n\n"
                                "The authentication service is temporarily unavailable.\n"
                                "Please try again later."
                            )
                elif lower == "/subscribe":
                    # Get user's accessible departments and show as buttons
                    try:
                        # Use centralized OAuth validation
                        from .telegram_auth import TelegramAuthenticationHandler, AuthenticationError
                        user_link, oidc_account = TelegramAuthenticationHandler.validate_telegram_user(
                            chat_id=str(chat_id),
                            require_verified=True
                        )
                        
                        accessible_departments = get_user_accessible_departments(user_link.user_id)
                        
                        if accessible_departments:
                            reply_text = (
                                "🏢 *Select Department*\n\n"
                                "Choose a department to view its features:\n"
                                "You can subscribe to notifications for features in these departments."
                            )
                            
                            # Create inline keyboard buttons for departments
                            keyboard = []
                            for dept in accessible_departments:
                                button_text = f"{dept['department_id']} - {dept['department_name']}"
                                callback_data = f"dept_{dept['department_id']}"
                                keyboard.append([{"text": button_text, "callback_data": callback_data}])
                            
                            # Add Cancel button
                            keyboard.append([{"text": "Cancel", "callback_data": "cancel"}])
                            
                            reply_markup = {"inline_keyboard": keyboard}
                        else:
                            reply_text = (
                                "*No Departments Available*\n\n"
                                "You don't have access to any departments or haven't linked your account yet.\n\n"
                                "To get started:\n"
                                "1. Use `/auth` to link your GitLab account\n"
                                "2. Make sure you have access to departments in Cometa\n"
                                "3. Try `/subscribe` again\n\n"
                                f"Your Chat ID: `{chat_id}`"
                            )
                    except (AuthenticationError, TelegramUserLink.DoesNotExist) as e:
                        logger.info(f"Authentication failed for /subscribe: {str(e)}")
                        reply_text = (
                            "*Account Not Linked*\n\n"
                            "You need to authenticate with GitLab first.\n\n"
                            "Steps to get started:\n"
                            "1. Use `/auth` to link your GitLab account\n"
                            "2. Complete the authentication process\n"
                            "3. Use `/subscribe` to manage notifications\n\n"
                            f"Your Chat ID: `{chat_id}`"
                        )
                elif lower == "/unsubscribe":
                    # Handle unsubscribe command - show user's active subscriptions
                    try:
                        # Use centralized OAuth validation
                        from .telegram_auth import TelegramAuthenticationHandler, AuthenticationError
                        user_link, oidc_account = TelegramAuthenticationHandler.validate_telegram_user(
                            chat_id=str(chat_id),
                            require_verified=True
                        )
                        
                        # Get user's active subscriptions
                        subscriptions = TelegramSubscription.objects.filter(
                            user_id=user_link.user_id,
                            chat_id=str(chat_id)
                        ).select_related()
                        
                        if subscriptions:
                            reply_text = (
                                "*Your Active Subscriptions*\n\n"
                                "Select a feature to unsubscribe from notifications:"
                            )
                            
                            # Create inline keyboard buttons for subscriptions
                            keyboard = []
                            for sub in subscriptions[:20]:  # Limit to 20 subscriptions
                                # Get feature details
                                try:
                                    feature = Feature.objects.get(feature_id=sub.feature_id)
                                    button_text = f"{feature.feature_id} - {feature.feature_name}"
                                    callback_data = f"unsub_feature_{feature.feature_id}"
                                    keyboard.append([{"text": button_text, "callback_data": callback_data}])
                                except Feature.DoesNotExist:
                                    # Skip if feature doesn't exist
                                    continue
                            
                            # Add Cancel button
                            keyboard.append([{"text": "Cancel", "callback_data": "cancel"}])
                            
                            reply_markup = {"inline_keyboard": keyboard}
                        else:
                            reply_text = (
                                "*No Active Subscriptions*\n\n"
                                "You don't have any active notification subscriptions.\n\n"
                                "Use `/subscribe` to subscribe to feature notifications."
                            )
                            
                    except (AuthenticationError, TelegramUserLink.DoesNotExist) as e:
                        logger.info(f"Authentication failed for /unsubscribe: {str(e)}")
                        reply_text = (
                            "*Account Not Linked*\n\n"
                            "You need to authenticate first.\n"
                            "Use `/auth` to link your account."
                        )
                    except Exception as e:
                        logger.error(f"Error in unsubscribe command: {str(e)}")
                        reply_text = (
                            "❌ *Error*\n\n"
                            "An error occurred while fetching your subscriptions. Please try again later."
                        )
                elif lower == "/subscriptions":
                    # Handle list subscriptions command
                    try:
                        # Use centralized OAuth validation
                        from .telegram_auth import TelegramAuthenticationHandler, AuthenticationError
                        user_link, oidc_account = TelegramAuthenticationHandler.validate_telegram_user(
                            chat_id=str(chat_id),
                            require_verified=True
                        )
                        
                        # Get user's active subscriptions with optimized query
                        logger.info(f"Fetching subscriptions for user_id: {user_link.user_id}, chat_id: {chat_id}")
                        
                        # Debug: Check all subscriptions for this user
                        all_user_subs = TelegramSubscription.objects.filter(user_id=user_link.user_id)
                        logger.info(f"Total subscriptions for user {user_link.user_id}: {all_user_subs.count()}")
                        for sub in all_user_subs:
                            logger.info(f"  - Feature {sub.feature_id}, chat_id: {sub.chat_id}")
                        
                        subscriptions = TelegramSubscription.objects.filter(
                            user_id=user_link.user_id,
                            chat_id=str(chat_id)
                        ).select_related()
                        
                        logger.info(f"Found {subscriptions.count()} subscriptions for chat_id {chat_id}")
                        
                        # Get all feature details in one query
                        feature_ids = list(subscriptions.values_list('feature_id', flat=True))
                        features_dict = {
                            f.feature_id: f 
                            for f in Feature.objects.filter(feature_id__in=feature_ids).select_related()
                        }
                        
                        if subscriptions:
                            reply_text = (
                                "📋 *Your Active Subscriptions*\n\n"
                            )
                            
                            # Group by department for better organization
                            from collections import defaultdict
                            dept_features = defaultdict(list)
                            
                            for sub in subscriptions:
                                if sub.feature_id in features_dict:
                                    feature = features_dict[sub.feature_id]
                                    dept_features[feature.department_name].append(feature)
                                    continue
                            
                            for dept_name, features in dept_features.items():
                                reply_text += f"*{escape_telegram_markdown(dept_name)}:*\n"
                                for feature in features:
                                    reply_text += f"  • {escape_telegram_markdown(feature.feature_name)} (ID: {feature.feature_id})\n"
                                reply_text += "\n"
                            
                            reply_text += "Use `/unsubscribe` to manage your subscriptions."
                        else:
                            reply_text = (
                                "*No Active Subscriptions*\n\n"
                                "You don't have any active notification subscriptions.\n\n"
                                "Use `/subscribe` to subscribe to feature notifications."
                            )
                            
                    except (AuthenticationError, TelegramUserLink.DoesNotExist) as e:
                        logger.info(f"Authentication failed for /subscriptions: {str(e)}")
                        reply_text = (
                            "*Account Not Linked*\n\n"
                            "You need to authenticate first.\n"
                            "Use `/auth` to link your account."
                        )
                elif lower == "/logout":
                    # Handle logout command
                    try:
                        # Use centralized OAuth validation
                        from .telegram_auth import TelegramAuthenticationHandler, AuthenticationError
                        user_link, oidc_account = TelegramAuthenticationHandler.validate_telegram_user(
                            chat_id=str(chat_id),
                            require_verified=True
                        )
                        
                        with transaction.atomic():
                            # Re-fetch with lock for update
                            user_link = TelegramUserLink.objects.select_for_update().get(
                                chat_id=str(chat_id),
                                is_active=True,
                                is_verified=True
                            )
                            if user_link.user_id > 0:
                                # Use the validated oidc_account
                                user_name = oidc_account.name if oidc_account else "User"
                                
                                # Deactivate all subscriptions for this user
                                from backend.ee.modules.notification.managers import TelegramSubscriptionManager
                                deactivated_count = TelegramSubscriptionManager.deactivate_user_subscriptions(user_link.user_id)
                                logger.info(f"User {user_name} (chat_id: {chat_id}) logged out, deactivated {deactivated_count} subscriptions")
                                
                                # Delete the link
                                user_link.delete()
                                
                                # Also clear any Django sessions that might have this chat_id
                                # Note: This is a simplified cleanup - we could implement more efficient 
                                # session tracking in the future if needed
                                sessions_cleared = 0
                                logger.info(f"Telegram logout completed for user {user_name} (chat_id: {chat_id})")
                            
                                reply_text = (
                                    "✅ *Logged Out Successfully*\n\n"
                                    f"Goodbye *{escape_telegram_markdown(user_name)}*!\n"
                                    "Your Telegram account has been disconnected.\n\n"
                                    "Use `/auth` to log in again whenever you're ready."
                                )
                                
                                logger.info(f"User {user_name} (chat_id: {chat_id}) logged out successfully.")
                            else:
                                reply_text = (
                                    "*Not Logged In*\n\n"
                                    "You are not currently logged in.\n"
                                    "Use `/auth` to connect your account."
                                )
                    except (AuthenticationError, TelegramUserLink.DoesNotExist):
                        reply_text = (
                            "*Not Logged In*\n\n"
                            "You are not currently logged in.\n"
                            "Use `/auth` to connect your account."
                        )
                elif lower.startswith("/run"):
                    # Handle feature execution command: /run <feature_id>
                    try:
                        # Use centralized OAuth validation
                        from .telegram_auth import TelegramAuthenticationHandler, AuthenticationError
                        user_link, oidc_account = TelegramAuthenticationHandler.validate_telegram_user(
                            chat_id=str(chat_id),
                            require_verified=True
                        )
                        
                        # Parse feature ID from command
                        command_parts = lower.split()
                        if len(command_parts) != 2:
                            reply_text = (
                                "❌ *Invalid Syntax*\n\n"
                                "Usage: `/run <feature_id>`\n\n"
                                "Example: `/run 123`\n"
                                "Use `/subscriptions` to see your available features."
                            )
                        else:
                            try:
                                feature_id = safe_int_conversion(command_parts[1], "feature_id", min_value=1)
                                
                                # Rate limiting check
                                from django.core.cache import cache
                                cache_key = f"run_command_rate_limit_{user_link.user_id}_{chat_id}"
                                last_run = cache.get(cache_key)
                                if last_run:
                                    reply_text = (
                                        "⏳ *Rate Limited*\n\n"
                                        "Please wait 30 seconds between feature executions.\n"
                                        "This prevents system overload and ensures fair usage."
                                    )
                                else:
                                    # Validate feature exists and user has access
                                    with transaction.atomic():
                                        try:
                                            feature = Feature.objects.select_for_update().get(
                                                feature_id=feature_id
                                            )
                                            
                                            # Check if user has access to feature's department
                                            user_departments = get_user_accessible_departments(user_link.user_id)
                                            user_dept_ids = [dept['department_id'] for dept in user_departments]
                                            
                                            if feature.department_id not in user_dept_ids:
                                                reply_text = (
                                                    "🚫 *Access Denied*\n\n"
                                                    f"You don't have access to feature ID {feature_id}.\n"
                                                    f"*Feature:* {escape_telegram_markdown(feature.feature_name)}\n"
                                                    f"*Department:* {escape_telegram_markdown(feature.department_name)}\n\n"
                                                    "Contact your administrator for access."
                                                )
                                            else:
                                                # Check if feature is already running using the same API that frontend uses
                                                try:
                                                    from backend.utility.config_handler import get_cometa_socket_url
                                                    socket_response = requests.get(f'{get_cometa_socket_url()}/featureStatus/{feature_id}', timeout=5)
                                                    running_check = socket_response.json().get('running', False) if socket_response.status_code == 200 else False
                                                except Exception as e:
                                                    logger.warning(f"Failed to check feature running status via socket: {e}")
                                                    # Fallback to database check
                                                    running_check = Feature_result.objects.filter(
                                                        feature_id=feature,
                                                        running=True
                                                    ).exists()
                                                
                                                if running_check:
                                                    reply_text = (
                                                        "⚠️ *Feature Already Running*\n\n"
                                                        f"Feature ID {feature_id} is currently executing.\n"
                                                        f"*Feature:* {escape_telegram_markdown(feature.feature_name)}\n\n"
                                                        "Please wait for it to complete before running again."
                                                    )
                                                else:
                                                        # Start feature execution
                                                        try:
                                                            # Set rate limit (30 seconds)
                                                            cache.set(cache_key, timezone.now(), 30)
                                                            
                                                            # Note: We don't create Feature_result here because runFeature creates its own
                                                            # The telegram notification info will be passed through runFeature
                                                            
                                                            # Get user details for audit (already validated)
                                                            user_name = oidc_account.name
                                                            user_email = oidc_account.email
                                                            
                                                            # Log execution attempt
                                                            logger.info(
                                                                f"Feature execution started via Telegram: "
                                                                f"feature_id={feature_id}, "
                                                                f"user={user_name} ({user_email}), "
                                                                f"chat_id={chat_id}"
                                                            )
                                                            
                                                            # Send immediate acknowledgment
                                                            # Check if user has subscription to this feature
                                                            has_subscription = TelegramSubscription.objects.filter(
                                                                user_id=user_link.user_id,
                                                                feature_id=feature_id
                                                            ).exists()
                                                            
                                                            notification_info = (
                                                                "📬 You'll receive a notification when it completes." 
                                                                if has_subscription 
                                                                else "💡 Subscribe to this feature to get completion notifications."
                                                            )
                                                            
                                                            reply_text = (
                                                                "🚀 *Test Execution Started*\n\n"
                                                                f"*Feature:* {escape_telegram_markdown(feature.feature_name)}\n"
                                                                f"*ID:* {feature_id}\n"
                                                                f"*Department:* {escape_telegram_markdown(feature.department_name)}\n"
                                                                f"*Started:* {timezone.now().strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"
                                                                f"⏳ Tests are now running...\n"
                                                                f"{notification_info}"
                                                            )
                                                            
                                                            # Start execution in background thread
                                                            def execute_feature():
                                                                try:
                                                                    # Get user info to create proper mock request
                                                                    from backend.serializers import OIDCAccountLoginSerializer
                                                                    
                                                                    # Use the already validated oidc_account
                                                                    user_data = OIDCAccountLoginSerializer(oidc_account, many=False).data
                                                                    
                                                                    # Create a mock request object for runFeature with complete user session
                                                                    class MockRequest:
                                                                        def __init__(self, user_data, telegram_chat_id):
                                                                            self.session = {'user': user_data}
                                                                            self.META = {
                                                                                'HTTP_X_SERVER': 'telegram-bot',
                                                                                'HTTP_COMETA_ORIGIN': 'TELEGRAM',
                                                                                'HTTP_TELEGRAM_CHAT_ID': str(telegram_chat_id)
                                                                            }
                                                                    
                                                                    mock_request = MockRequest(user_data, chat_id)
                                                                    
                                                                    # Execute the feature using existing runFeature function
                                                                    # This just starts the execution and returns immediately
                                                                    result = runFeature(
                                                                        request=mock_request,
                                                                        feature_id=feature_id
                                                                    )
                                                                    
                                                                    # Check if execution started successfully
                                                                    if not result.get('success', False) if isinstance(result, dict) else True:
                                                                        # Only send error if we couldn't start the execution
                                                                        error_text = (
                                                                            "❌ *Failed to Start Execution*\n\n"
                                                                            f"*Feature:* {escape_telegram_markdown(feature.feature_name)}\n"
                                                                            f"*ID:* {feature_id}\n\n"
                                                                            "Could not start the test execution. Please try again."
                                                                        )
                                                                        error_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                                                                        requests.post(error_url, json={
                                                                            "chat_id": chat_id,
                                                                            "text": error_text,
                                                                            "parse_mode": "Markdown",
                                                                        }, timeout=10)
                                                                    
                                                                    # DO NOT send completion notification here!
                                                                    # The feature is still running. 
                                                                    # Users with subscriptions will get notified when it actually completes.
                                                                    
                                                                except Exception as e:
                                                                    logger.error(f"Feature execution failed: {str(e)}", exc_info=True)
                                                                    
                                                                    # Send error notification
                                                                    error_text = (
                                                                        "❌ *Execution Error*\n\n"
                                                                        f"*Feature:* {escape_telegram_markdown(feature.feature_name)}\n"
                                                                        f"*ID:* {feature_id}\n"
                                                                        f"*Error:* {timezone.now().strftime('%Y-%m-%d %H:%M:%S UTC')}\n\n"
                                                                        "An error occurred during execution. "
                                                                        "Please contact your administrator."
                                                                    )
                                                                    
                                                                    error_url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                                                                    error_payload = {
                                                                        "chat_id": chat_id,
                                                                        "text": error_text,
                                                                        "parse_mode": "Markdown",
                                                                    }
                                                                    requests.post(error_url, json=error_payload, timeout=10)
                                                            
                                                            # Start execution thread
                                                            execution_thread = threading.Thread(target=execute_feature)
                                                            execution_thread.daemon = True
                                                            execution_thread.start()
                                                            
                                                        except Exception as e:
                                                            logger.error(f"Failed to start feature execution: {str(e)}", exc_info=True)
                                                            reply_text = (
                                                                "❌ *Execution Failed*\n\n"
                                                                "Failed to start feature execution.\n"
                                                                "Please try again or contact your administrator."
                                                            )
                                            
                                        except Feature.DoesNotExist:
                                            reply_text = (
                                                "❌ *Feature Not Found*\n\n"
                                                f"Feature ID {feature_id} does not exist.\n\n"
                                                "Use `/subscriptions` to see your available features."
                                            )
                                            
                            except (ValueError, ValidationError):
                                reply_text = (
                                    "❌ *Invalid Feature ID*\n\n"
                                    "Feature ID must be a positive number.\n\n"
                                    "Example: `/run 123`\n"
                                    "Use `/subscriptions` to see your available features."
                                )
                                    
                    except (AuthenticationError, TelegramUserLink.DoesNotExist) as e:
                        logger.info(f"Authentication failed for /run: {str(e)}")
                        reply_text = (
                            "❌ *Account Not Linked*\n\n"
                            "You need to authenticate first.\n"
                            "Use `/auth` to link your account."
                        )
                    except Exception as e:
                        logger.error(f"Error in /run command: {str(e)}", exc_info=True)
                        reply_text = (
                            "❌ *System Error*\n\n"
                            "An error occurred while processing your request.\n"
                            "Please try again later."
                        )

                if reply_text:
                    # Send message with retry logic for reliability
                    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
                    payload = {
                        "chat_id": chat_id,
                        "text": reply_text,
                        "parse_mode": "Markdown",
                    }
                    if 'reply_markup' in locals():
                        payload["reply_markup"] = reply_markup
                    
                    # Try sending with retries
                    max_retries = 3
                    retry_delay = 0.5
                    for attempt in range(max_retries):
                        try:
                            response = requests.post(url, json=payload, timeout=10)
                            if response.status_code == 200:
                                break
                            else:
                                logger.warning(f"Telegram API returned status {response.status_code}: {response.text}")
                                if attempt < max_retries - 1:
                                    time.sleep(retry_delay)
                                    retry_delay *= 2
                        except requests.exceptions.Timeout:
                            logger.warning(f"Telegram message timeout (attempt {attempt + 1}/{max_retries})")
                            if attempt < max_retries - 1:
                                time.sleep(retry_delay)
                                retry_delay *= 2
                        except Exception as exc:
                            logger.error(f"Failed to send Telegram reply (attempt {attempt + 1}/{max_retries}): {exc}")
                            if attempt < max_retries - 1:
                                time.sleep(retry_delay)
                                retry_delay *= 2

    # Always respond with 200 OK so Telegram marks update as processed
    return JsonResponse({"success": True})




# ========================= Telegram Subscription Management =========================
@require_permissions("edit_feature")
def subscribe_telegram_notifications(request):
    """
    API endpoint for Telegram bot to subscribe users to notifications
    Validates user session and department-environment access
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method allowed'})
    
    try:
        # Parse request data
        data = json.loads(request.body.decode('utf-8'))
        chat_id = data.get('chat_id')
        feature_id = data.get('feature_id')
        notification_types = data.get('notification_types', ['on_failure', 'on_success'])
        
        if not chat_id or not feature_id:
            return JsonResponse({'success': False, 'error': 'chat_id and feature_id are required'})
        
        # Validate chat_id format
        chat_id = str(chat_id).strip()
        if not chat_id or len(chat_id) > 50:
            return JsonResponse({'success': False, 'error': 'Invalid chat_id format'})
        
        # Validate feature_id
        try:
            feature_id = int(feature_id)
            if feature_id < 1:
                raise ValueError("Invalid feature_id")
        except (TypeError, ValueError):
            return JsonResponse({'success': False, 'error': 'Invalid feature_id format'})
        
        # Validate notification_types
        valid_notification_types = ['on_failure', 'on_success']
        if not isinstance(notification_types, list):
            return JsonResponse({'success': False, 'error': 'notification_types must be a list'})
        
        for nt in notification_types:
            if nt not in valid_notification_types:
                return JsonResponse({'success': False, 'error': f'Invalid notification type: {nt}'})
        
        # Get user departments for validation
        user_departments = GetUserDepartments(request)
        user_id = request.session['user']['user_id']
        
        # Validate feature access
        try:
            feature = Feature.objects.get(feature_id=feature_id)
        except Feature.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Feature not found'})
        
        if feature.department_id not in user_departments:
            return JsonResponse({'success': False, 'error': 'Access denied to this feature'})
        
        # Create or update subscription
        subscription, created = TelegramSubscription.objects.get_or_create(
            user_id=user_id,
            chat_id=chat_id,
            feature_id=feature_id,
            defaults={
                'department_id': feature.department_id,
                'environment_id': feature.environment_id,
                'notification_types': notification_types,
                'is_active': True
            }
        )
        
        if not created:
            subscription.notification_types = notification_types
            subscription.is_active = True
            subscription.save()
        
        return JsonResponse({
            'success': True, 
            'subscription_id': subscription.id,
            'created': created,
            'message': 'Subscription created successfully' if created else 'Subscription updated successfully'
        })
        
    except Exception as e:
        logger.error(f"Error in subscribe_telegram_notifications: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})


@require_permissions("edit_feature")
def unsubscribe_telegram_notifications(request):
    """
    API endpoint to unsubscribe from Telegram notifications
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method allowed'})
    
    try:
        data = json.loads(request.body.decode('utf-8'))
        chat_id = data.get('chat_id')
        feature_id = data.get('feature_id')
        
        if not chat_id or not feature_id:
            return JsonResponse({'success': False, 'error': 'chat_id and feature_id are required'})
        
        # Validate chat_id format
        chat_id = str(chat_id).strip()
        if not chat_id or len(chat_id) > 50:
            return JsonResponse({'success': False, 'error': 'Invalid chat_id format'})
        
        # Validate feature_id
        try:
            feature_id = int(feature_id)
            if feature_id < 1:
                raise ValueError("Invalid feature_id")
        except (TypeError, ValueError):
            return JsonResponse({'success': False, 'error': 'Invalid feature_id format'})
        
        user_id = request.session['user']['user_id']
        
        # Find and delete subscription
        try:
            subscription = TelegramSubscription.objects.get(
                user_id=user_id,
                chat_id=chat_id,
                feature_id=feature_id
            )
            subscription.delete()
            
            return JsonResponse({
                'success': True,
                'message': 'Unsubscribed successfully'
            })
        except TelegramSubscription.DoesNotExist:
            return JsonResponse({'success': False, 'error': 'Subscription not found'})
        
    except Exception as e:
        logger.error(f"Error in unsubscribe_telegram_notifications: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})


@require_permissions("edit_feature")
def list_telegram_subscriptions(request):
    """
    API endpoint to list user's active Telegram subscriptions
    """
    if request.method != 'GET':
        return JsonResponse({'success': False, 'error': 'Only GET method allowed'})
    
    try:
        user_id = request.session['user']['user_id']
        user_departments = GetUserDepartments(request)
        
        # Get active subscriptions for user's accessible departments
        subscriptions = TelegramSubscription.objects.filter(
            user_id=user_id,
            is_active=True,
            department_id__in=user_departments
        ).select_related()
        
        subscription_list = []
        for sub in subscriptions:
            try:
                feature = Feature.objects.get(feature_id=sub.feature_id)
                subscription_list.append({
                    'id': sub.id,
                    'chat_id': sub.chat_id,
                    'feature_id': sub.feature_id,
                    'feature_name': feature.feature_name,
                    'department_id': sub.department_id,
                    'environment_id': sub.environment_id,
                    'notification_types': sub.notification_types,
                    'created_on': sub.created_on.isoformat(),
                    'last_notification_sent': sub.last_notification_sent.isoformat() if sub.last_notification_sent else None
                })
            except Feature.DoesNotExist:
                continue
        
        return JsonResponse({
            'success': True,
            'subscriptions': subscription_list
        })
        
    except Exception as e:
        logger.error(f"Error in list_telegram_subscriptions: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})


# ========================= Telegram GitLab OAuth Authentication =========================
def generate_auth_token(request):
    """
    Generate authentication token for Telegram bot deep link authentication
    This endpoint is called by the Telegram bot to initiate OAuth flow
    Note: No authentication required as this initiates the auth flow
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method allowed'})
    
    try:
        data = json.loads(request.body.decode('utf-8'))
        chat_id = data.get('chat_id')
        
        if not chat_id:
            return JsonResponse({'success': False, 'error': 'chat_id is required'})
        
        # Validate chat_id format (Telegram chat IDs are numeric strings)
        chat_id = str(chat_id).strip()
        if not chat_id or len(chat_id) > 50:
            return JsonResponse({'success': False, 'error': 'Invalid chat_id format'})
        
        # Rate limiting: Check if user has made too many requests recently
        recent_attempts = TelegramUserLink.objects.filter(
            chat_id=str(chat_id),
            last_auth_attempt__gte=timezone.now() - timezone.timedelta(minutes=1)
        ).count()
        
        if recent_attempts >= 3:
            return JsonResponse({
                'success': False, 
                'error': 'Too many authentication attempts. Please wait before trying again.'
            })
        
        # Get or create user link
        user_link, created = TelegramUserLink.objects.get_or_create(
            chat_id=str(chat_id),
            defaults={
                'user_id': 0,  # Temporary, will be set during OAuth callback
                'is_active': True,
                'is_verified': False
            }
        )
        
        # Generate new auth token
        token = user_link.generate_auth_token()
        user_link.last_auth_attempt = timezone.now()
        user_link.save()
        
        # Build authentication URL
        domain = ConfigurationManager.get_configuration('COMETA_DOMAIN', 'localhost')
        auth_url = f"https://{domain}/auth/telegram/{token}"
        
        return JsonResponse({
            'success': True,
            'auth_token': token,
            'auth_url': auth_url,
            'expires_in': 300  # 5 minutes
        })
        
    except Exception as e:
        logger.error(f"Error in generate_auth_token: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})


def verify_auth_token(request):
    """
    Verify authentication token (used internally by OAuth callback)
    Note: No authentication required as this is part of the auth flow
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method allowed'})
    
    try:
        data = json.loads(request.body.decode('utf-8'))
        token = data.get('token')
        
        if not token:
            return JsonResponse({'success': False, 'error': 'token is required'})
        
        # Validate token format (should be a URL-safe base64 string)
        token = str(token).strip()
        if not token or len(token) > 255:
            return JsonResponse({'success': False, 'error': 'Invalid token format'})
        
        # Find user link by checking hashed tokens
        from django.contrib.auth.hashers import check_password
        
        # Get all links with unexpired tokens
        potential_links = TelegramUserLink.objects.filter(
            auth_token__isnull=False,
            auth_token_expires__gt=timezone.now()
        )
        
        user_link = None
        for link in potential_links:
            if check_password(token, link.auth_token):
                user_link = link
                break
        
        if not user_link:
            return JsonResponse({'success': False, 'error': 'Invalid token'})
        
        if not user_link.is_auth_token_valid():
            return JsonResponse({'success': False, 'error': 'Token expired'})
        
        return JsonResponse({
            'success': True,
            'chat_id': user_link.chat_id,
            'user_id': user_link.user_id,
            'is_verified': user_link.is_verified
        })
        
    except Exception as e:
        logger.error(f"Error in verify_auth_token: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})


# ========================= Telegram User Linking =========================
@require_permissions("edit_feature")
def link_telegram_chat(request):
    """
    API endpoint to link authenticated user's account to their Telegram chat ID
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method allowed'})
    
    try:
        data = json.loads(request.body.decode('utf-8'))
        chat_id = data.get('chat_id')
        username = data.get('username')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        
        if not chat_id:
            return JsonResponse({'success': False, 'error': 'chat_id is required'})
        
        # Validate chat_id format
        chat_id = str(chat_id).strip()
        if not chat_id or len(chat_id) > 50:
            return JsonResponse({'success': False, 'error': 'Invalid chat_id format'})
        
        # Sanitize string inputs (prevent XSS)
        if username:
            username = str(username).strip()[:255]
        if first_name:
            first_name = str(first_name).strip()[:255]
        if last_name:
            last_name = str(last_name).strip()[:255]
        
        user_id = request.session['user']['user_id']
        
        # Create or update user link
        user_link, created = TelegramUserLink.objects.get_or_create(
            user_id=user_id,
            defaults={
                'chat_id': chat_id,
                'username': username,
                'first_name': first_name,
                'last_name': last_name,
                'is_active': True,
                'is_verified': False
            }
        )
        
        if not created:
            # Update existing link
            user_link.chat_id = chat_id
            user_link.username = username
            user_link.first_name = first_name
            user_link.last_name = last_name
            user_link.is_active = True
            user_link.save()
        
        return JsonResponse({
            'success': True,
            'message': 'Telegram account linked successfully' if created else 'Telegram account updated successfully',
            'link_id': user_link.id,
            'created': created
        })
        
    except Exception as e:
        logger.error(f"Error in link_telegram_chat: {str(e)}")
        return JsonResponse({'success': False, 'error': str(e)})


def get_user_accessible_departments(user_id):
    """
    Get departments accessible to a user based on their OIDCAccount
    Optimized with single query using select_related
    """
    try:
        from backend.models import Department, Account_role
        
        # Single optimized query to get departments with user roles
        accessible_departments = Department.objects.filter(
            department_id__in=Account_role.objects.filter(
                user_id=user_id
            ).values_list('department_id', flat=True)
        ).values('department_id', 'department_name')
        
        return list(accessible_departments)
        
    except Exception as e:
        logger.error(f"Error in get_user_accessible_departments: {str(e)}")
        return []


def get_department_features(user_id, department_id):
    """
    Get features accessible to a user within a specific department
    """
    try:
        # Verify user has access to this department with optimized check
        from backend.models import Account_role
        
        logger.info(f"Checking access for user {user_id} to department {department_id}")
        has_access = Account_role.objects.filter(
            user_id=user_id,
            department_id=department_id
        ).exists()
        
        if not has_access:
            logger.warning(f"User {user_id} does not have access to department {department_id}")
            # Let's check what departments this user DOES have access to
            user_depts = Account_role.objects.filter(user_id=user_id).values_list('department_id', flat=True)
            logger.info(f"User {user_id} has access to departments: {list(user_depts)}")
            return []
        
        # Get all features from this department with optimized query
        features = Feature.objects.filter(
            department_id=department_id
        ).values(
            'feature_id',
            'feature_name',
            'department_id',
            'environment_id',
            'environment_name'
        )
        
        features_list = list(features)
        logger.info(f"Found {len(features_list)} features in department {department_id}")
        
        return features_list
        
    except Exception as e:
        logger.error(f"Error in get_department_features: {str(e)}")
        return []


def complete_telegram_auth(request, token):
    """
    Complete Telegram authentication after successful OAuth
    This function is called from the main OAuth callback
    """
    try:
        logger.info(f"Starting Telegram auth completion for token: {token}")
        
        # Use atomic transaction to prevent race conditions
        with transaction.atomic():
            # Use the centralized token verification
            from .telegram_auth import TelegramAuthenticationHandler
            user_link = TelegramAuthenticationHandler.verify_telegram_token(token)
            
            if not user_link:
                logger.error(f"No valid user link found for token: {token}")
                return False, 0
            
            logger.info(f"Found valid user link for chat_id: {user_link.chat_id}")
            
            # Get user info from session
            user_info = request.session.get('user')
            if not user_info:
                logger.error("No user info in session for Telegram auth completion")
                logger.info(f"Session contents: {list(request.session.keys())}")
                return False, 0
            
            # Validate user_id exists and is valid
            user_id = user_info.get('user_id')
            if not user_id or user_id == 0:
                logger.error(f"Invalid user_id in session: {user_id}")
                logger.info(f"User info contents: {user_info}")
                return False, 0
            
            # Lock the row for update to prevent concurrent modifications
            user_link = TelegramUserLink.objects.select_for_update().get(id=user_link.id)
            
            # Update user link with OAuth provider info
            user_link.user_id = user_id
            user_link.gitlab_username = user_info.get('name')  # OAuth username
            user_link.gitlab_email = user_info.get('email')
            user_link.gitlab_name = user_info.get('name')
            user_link.is_verified = True
            user_link.clear_auth_token()  # Clear the temporary token
            user_link.save()
            
            logger.info(f"Updated user link: user_id={user_link.user_id}, is_verified={user_link.is_verified}")
        
        # Reactivate user's subscriptions (outside transaction for performance)
        reactivated_count = 0
        try:
            from backend.ee.modules.notification.managers import TelegramSubscriptionManager
            reactivated_count = TelegramSubscriptionManager.reactivate_user_subscriptions(
                user_id=user_id,
                chat_id=user_link.chat_id
            )
            if reactivated_count > 0:
                logger.info(f"Reactivated {reactivated_count} subscriptions for user {user_id}")
        except Exception as e:
            logger.error(f"Error reactivating subscriptions: {str(e)}")
        
        logger.info(f"Telegram auth completed for user {user_link.user_id}, chat {user_link.chat_id}")
        return True, reactivated_count
        
    except Exception as e:
        logger.error(f"Error completing Telegram auth: {str(e)}")
        logger.exception(e)
        return False, 0


def _cleanup_expired_tokens():
    """Clean up expired tokens (10% probability)."""
    import random
    from django.core.cache import cache
    
    # Run cleanup occasionally
    if random.random() > 0.1:
        return
    
    # Rate limit: max once per 5 minutes
    cache_key = "telegram_token_cleanup_last_run"
    if cache.get(cache_key):
        return
    cache.set(cache_key, True, 300)
    
    try:
        # Clear expired tokens
        expired = TelegramUserLink.objects.filter(
            auth_token__isnull=False,
            auth_token_expires__lt=timezone.now()
        )
        count = expired.count()
        if count > 0:
            for link in expired:
                link.clear_auth_token()
            logger.info(f"Cleaned {count} expired tokens")
        
        # Delete old unverified links (7+ days)
        cutoff = timezone.now() - timedelta(days=7)
        deleted = TelegramUserLink.objects.filter(
            is_verified=False,
            created_on__lt=cutoff
        ).delete()[0]
        
        if deleted > 0:
            logger.info(f"Deleted {deleted} old unverified links")
            
    except Exception as e:
        logger.warning(f"Token cleanup error: {e}")

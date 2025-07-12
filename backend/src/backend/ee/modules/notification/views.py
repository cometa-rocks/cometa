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
import os, requests, traceback
import time
from datetime import datetime, timedelta
import json
import requests
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils import timezone
from backend.models import Feature_result, Feature
from backend.utility.notification_manager import NotificationManger
from backend.utility.configurations import ConfigurationManager
from backend.views import GetUserDepartments
from .models import TelegramSubscription, TelegramUserLink

logger = getLogger()
import threading

from backend.generatePDF import PDFAndEmailManager


def send_notifications(request):

    if request.method != 'GET':
        logger.warning(f"Invalid request method: {request.method}")
        return JsonResponse({'success': False, 'error': 'Only GET method allowed'})
    
    try:
        feature_result_id = request.GET.get('feature_result_id')
        logger.info(f"Received Telegram notification request for feature_result_id: {feature_result_id}")
        
        if not feature_result_id:
            logger.error("Missing feature_result_id parameter")
            return JsonResponse({'success': False, 'error': 'feature_result_id parameter is required'})
        
        # Create a thread to run the clean_up_and_mail function
        notification = threading.Thread(target=notification_handler,args=(request, feature_result_id))
        notification.daemon = True
        notification.start() 
        
        logger.info(f"Notification thread is in progress feature_result_id: {feature_result_id}")
        return JsonResponse({'success': True, 'message': 'Notification thread is in progress'})
           
    except Exception as e:
        logger.error(f"Unexpected error in send_telegram_notification_view: {str(e)}")
        return JsonResponse({'success': False, 'error': f'Unexpected error: {str(e)}'})

    

def notification_handler(request, feature_result_id):

    pdf_email_manager = PDFAndEmailManager()
    # prepares the PDF and send the email
    pdf_email_manager.prepare_the_get(request=request)
    # Get the feature result
    feature_result = Feature_result.objects.get(feature_result_id=feature_result_id)

    notification_manager = NotificationManger("telegram", pdf_email_manager.is_pdf_generated() )
    logger.debug("Created Telegram notification manager")
    
    notification_manager.send_message(feature_result )

    
    
    # pdf_email_manager = PDFAndEmailManager()
    # # prepares the PDF and send the email
    # pdf_email_manager.prepare_the_get(request=request)
    
    # if request.method != 'GET':
    #     logger.warning(f"Invalid request method: {request.method}")
    #     return JsonResponse({'success': False, 'error': 'Only GET method allowed'})
    
    # try:
    #     feature_result_id = request.GET.get('feature_result_id')
    #     logger.info(f"Received Telegram notification request for feature_result_id: {feature_result_id}")
        
    #     if not feature_result_id:
    #         logger.error("Missing feature_result_id parameter")
    #         return JsonResponse({'success': False, 'error': 'feature_result_id parameter is required'})
        
    #     # Get the feature result
    #     try:
    #         feature_result = Feature_result.objects.get(feature_result_id=feature_result_id)
    #         logger.debug(f"Found feature result: {feature_result.feature_name} (ID: {feature_result_id})")
    #     except Feature_result.DoesNotExist:
    #         logger.error(f"Feature result not found for ID: {feature_result_id}")
    #         return JsonResponse({'success': False, 'error': f'Feature result with ID {feature_result_id} not found'})
        
    #     # Create notification manager and send notification
    #     try:
    #         notification_manager = NotificationManger("telegram", pdf_email_manager.is_pdf_generated() )
    #         logger.debug("Created Telegram notification manager")
            
    #         success = notification_manager.send_message(feature_result )
            
    #         if success:
    #             logger.info(f"Telegram notification sent successfully for feature_result_id: {feature_result_id}")
    #             return JsonResponse({'success': True, 'message': 'Telegram notification sent successfully'})
    #         else:
    #             logger.warning(f"Telegram notification failed for feature_result_id: {feature_result_id}")
    #             return JsonResponse({'success': False, 'message': 'Failed to send Telegram notification'})
                
    #     except Exception as e:
    #         logger.error(f"Error in notification manager for feature_result_id {feature_result_id}: {str(e)}")
    #         return JsonResponse({'success': False, 'error': f'Notification manager error: {str(e)}'})
           
    # except Exception as e:
    #     logger.error(f"Unexpected error in send_telegram_notification_view: {str(e)}")
    #     return JsonResponse({'success': False, 'error': f'Unexpected error: {str(e)}'})

    
    
    
# ========================= Telegram Webhook =========================
@csrf_exempt
def telegram_webhook(request):
    """
    Entry-point called by Telegram when a new update is available (webhook).
    This view performs minimal validation, logs the update and optionally
    replies to a few basic commands so that we can verify everything works.

    IMPORTANT:  This keeps the implementation lightweight and self-contained
    (no external dependencies like python-telegram-bot) while still following
    Telegram best-practices:
      • Verify the optional secret token header when configured
      • Always return HTTP 200 as fast as possible (< 1s) so Telegram
        considers the update delivered
      • Execute any long-running logic asynchronously if needed (not done
        here – we keep it minimal)
    """

    if request.method != "POST":
        return JsonResponse({"success": False, "error": "Invalid method"}, status=405)

    # Optional: extra security layer – validate secret token header
    expected_secret = ConfigurationManager.get_configuration("COMETA_TELEGRAM_WEBHOOK_SECRET", "")
    if expected_secret:
        received_secret = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
        if received_secret != expected_secret:
            logger.warning("Rejected Telegram webhook call due to invalid secret token")
            return JsonResponse({"success": False}, status=401)

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
                    "🔔 To subscribe to notifications:\n\n"
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
                    
                    # Get features in this department
                    department_features = get_department_features(user_link.user_id, department_id)
                    
                    if department_features:
                        # Get department name
                        from backend.models import Department
                        department = Department.objects.get(department_id=department_id)
                        
                        reply_text = (
                            f"🔧 *Features in {department.department_name}*\n\n"
                            f"Select a feature to subscribe to notifications:\n"
                            f"You'll receive alerts when these features run."
                        )
                        
                        # Create inline keyboard buttons for features
                        keyboard = []
                        for feature in department_features[:10]:  # Limit to 10 features per page
                            button_text = f"{feature['feature_id']} - {feature['feature_name']}"
                            callback_data = f"sub_feature_{feature['feature_id']}"
                            keyboard.append([{"text": button_text, "callback_data": callback_data}])
                        
                        # Add navigation buttons
                        keyboard.append([
                            {"text": "🔙 Back to Departments", "callback_data": "back_to_departments"},
                            {"text": "❌ Cancel", "callback_data": "cancel"}
                        ])
                        
                        reply_markup = {"inline_keyboard": keyboard}
                    else:
                        reply_text = (
                            f"❌ *No Features Found*\n\n"
                            f"No features found in this department or you don't have access to them."
                        )
                        
                        # Add navigation buttons
                        keyboard = [[
                            {"text": "🔙 Back to Departments", "callback_data": "back_to_departments"},
                            {"text": "❌ Cancel", "callback_data": "cancel"}
                        ]]
                        reply_markup = {"inline_keyboard": keyboard}
                    
                except TelegramUserLink.DoesNotExist:
                    reply_text = (
                        "❌ *Account Not Linked*\n\n"
                        "Your Telegram account is not linked to a Cometa user.\n"
                        "Please use `/auth` to link your account first."
                    )
                except Exception as e:
                    logger.error(f"Error in department selection callback: {str(e)}")
                    reply_text = (
                        "❌ *Error Loading Features*\n\n"
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
                try:
                    requests.post(url, json=payload, timeout=5)
                except Exception as exc:
                    logger.warning(f"Failed to send Telegram reply: {exc}")
                    
            elif data.startswith("sub_feature_"):
                # Handle feature subscription button click
                feature_id = data.replace("sub_feature_", "")
                try:
                    # Get user link
                    user_link = TelegramUserLink.objects.get(chat_id=str(chat_id), is_active=True, is_verified=True)
                    
                    # Get feature details
                    feature = Feature.objects.get(feature_id=feature_id)
                    
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
                            f"**{feature.feature_name}** (ID: {feature_id})\n\n"
                            f"You'll receive alerts when this feature runs."
                        )
                    else:
                        # Reactivate if it was inactive
                        if not subscription.is_active:
                            subscription.is_active = True
                            subscription.save()
                            reply_text = (
                                f"✅ *Subscription Reactivated*\n\n"
                                f"You're now subscribed to notifications for:\n"
                                f"**{feature.feature_name}** (ID: {feature_id})\n\n"
                                f"You'll receive alerts when this feature runs."
                            )
                        else:
                            reply_text = (
                                f"ℹ️ *Already Subscribed*\n\n"
                                f"You're already subscribed to notifications for:\n"
                                f"**{feature.feature_name}** (ID: {feature_id})"
                            )
                    
                    # Update last interaction
                    user_link.last_interaction = datetime.now()
                    user_link.save()
                    
                except TelegramUserLink.DoesNotExist:
                    reply_text = (
                        "❌ *Account Not Linked*\n\n"
                        "Your Telegram account is not linked to a Cometa user.\n"
                        "Please use `/auth` to link your account first."
                    )
                except Feature.DoesNotExist:
                    reply_text = (
                        "❌ *Feature Not Found*\n\n"
                        "The selected feature could not be found or you don't have access to it."
                    )
                except Exception as e:
                    logger.error(f"Error in feature subscription callback: {str(e)}")
                    reply_text = (
                        "❌ *Subscription Failed*\n\n"
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
                    user_link = TelegramUserLink.objects.get(chat_id=str(chat_id), is_active=True, is_verified=True)
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
                        keyboard.append([{"text": "❌ Cancel", "callback_data": "cancel"}])
                        
                        reply_markup = {"inline_keyboard": keyboard}
                    else:
                        reply_text = (
                            "❌ *No Departments Available*\n\n"
                            "You don't have access to any departments."
                        )
                        
                except TelegramUserLink.DoesNotExist:
                    reply_text = (
                        "❌ *Account Not Linked*\n\n"
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
                    "❌ *Cancelled*\n\n"
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
                    # Get user link
                    user_link = TelegramUserLink.objects.get(chat_id=str(chat_id), is_active=True, is_verified=True)
                    
                    # Get subscription
                    subscription = TelegramSubscription.objects.get(
                        user_id=user_link.user_id,
                        chat_id=str(chat_id),
                        feature_id=feature_id,
                        is_active=True
                    )
                    
                    # Get feature details for confirmation message
                    feature = Feature.objects.get(feature_id=feature_id)
                    
                    # Deactivate subscription
                    subscription.is_active = False
                    subscription.save()
                    
                    reply_text = (
                        f"✅ *Unsubscribed Successfully*\n\n"
                        f"You will no longer receive notifications for:\n"
                        f"**{feature.feature_name}** (ID: {feature_id})\n\n"
                        f"Use `/subscribe` to re-enable notifications for this feature."
                    )
                    
                except TelegramUserLink.DoesNotExist:
                    reply_text = (
                        "❌ *Account Not Linked*\n\n"
                        "Your Telegram account is not linked to a Cometa user.\n"
                        "Please use `/auth` to link your account first."
                    )
                except TelegramSubscription.DoesNotExist:
                    reply_text = (
                        "❌ *Subscription Not Found*\n\n"
                        "This subscription was not found or is already inactive."
                    )
                except Feature.DoesNotExist:
                    reply_text = (
                        "❌ *Feature Not Found*\n\n"
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
                        "🤖 Hi! I’m *Cometa Bot*.\n\n"
                        "I help you stay updated on your test executions. Here's what I can do:\n\n"
                        "📋 *Available Commands:*\n"
                        "• `/help` - Show this help message\n"
                        "• `/auth` - Link your Cometa account (required first)\n"
                        "• `/status` - Check your authentication status\n"
                        "• `/logout` - Disconnect your Telegram account\n"
                        "• `/subscribe` - Subscribe to test notifications\n"
                        "• `/unsubscribe` - Manage your subscriptions\n"
                        "• `/list` - View your active subscriptions\n"
                        "• `/ping` - Check if I'm alive\n"
                        "• `/chatid` - Get your Telegram chat ID\n\n"
                        "🚀 *Getting Started:*\n"
                        "1️⃣ Use `/auth` to link your Cometa account\n"
                        "2️⃣ Use `/subscribe` to choose features to monitor\n"
                        "3️⃣ Receive instant notifications when tests run!\n\n"
                        "💡 *Tips:*\n"
                        "• You must authenticate before subscribing\n"
                        "• You can subscribe to multiple features\n"
                        "• Notifications include test results and logs"
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
                                    f"👤 *User:* {user.name}\n"
                                    f"📧 *Email:* {user.email}\n"
                                    f"🆔 *User ID:* {user_link.user_id}\n"
                                    f"💬 *Chat ID:* {chat_id}\n"
                                    f"🕐 *Linked on:* {user_link.created_on.strftime('%Y-%m-%d %H:%M:%S')}\n\n"
                                    "You can use `/subscribe` to manage notifications."
                                )
                            except OIDCAccount.DoesNotExist:
                                reply_text = (
                                    "⚠️ *Authentication Status: Partially Linked*\n\n"
                                    f"Your Telegram is linked but the user account was not found.\n"
                                    f"💬 *Chat ID:* {chat_id}\n\n"
                                    "Try `/auth` to re-authenticate."
                                )
                        else:
                            reply_text = (
                                "❌ *Authentication Status: Not Verified*\n\n"
                                f"💬 *Chat ID:* {chat_id}\n"
                                "Your account exists but is not verified.\n\n"
                                "Use `/auth` to complete the authentication process."
                            )
                    except TelegramUserLink.DoesNotExist:
                        reply_text = (
                            "❌ *Authentication Status: Not Linked*\n\n"
                            f"💬 *Chat ID:* {chat_id}\n"
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
                                    "✅ *Already Authenticated*\n\n"
                                    f"You are already logged in as:\n"
                                    f"👤 *{user.name}*\n"
                                    f"📧 {user.email}\n\n"
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
                                        "⏰ *Rate Limited*\n\n"
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
                                    "❌ *Token Generation Failed*\n\n"
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
                                
                                # Get environment to determine OAuth provider name
                                oauth_provider = "Google" if environment == 'dev' else "GitLab"
                                
                                # For development, provide the actual link since localhost might not render
                                if environment == 'dev':
                                    reply_text = (
                                        f"🔐 *{oauth_provider} Authentication*\n\n"
                                        f"Click the link below to authenticate with your {oauth_provider} account:\n\n"
                                        f"🔗 `{auth_url}`\n\n"
                                        "⏰ This link expires in 5 minutes.\n"
                                        "✅ After authentication, you'll have access to all your features!\n\n"
                                        "Note: You may need to copy and paste this link into your browser."
                                    )
                                else:
                                    reply_text = (
                                        f"🔐 *{oauth_provider} Authentication*\n\n"
                                        f"Click the link below to authenticate with your {oauth_provider} account:\n\n"
                                        f"[🔗 Authenticate with {oauth_provider}]({auth_url})\n\n"
                                        "⏰ This link expires in 5 minutes.\n"
                                        "✅ After authentication, you'll have access to all your features!"
                                    )
                                
                        except Exception as e:
                            logger.error(f"Error generating auth token: {str(e)}")
                            traceback.print_exc()
                            reply_text = (
                                "❌ *Authentication Service Unavailable*\n\n"
                                "The authentication service is temporarily unavailable.\n"
                                "Please try again later."
                            )
                elif lower == "/subscribe":
                    # Get user's accessible departments and show as buttons
                    try:
                        user_link = TelegramUserLink.objects.get(chat_id=str(chat_id), is_active=True, is_verified=True)
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
                            keyboard.append([{"text": "❌ Cancel", "callback_data": "cancel"}])
                            
                            reply_markup = {"inline_keyboard": keyboard}
                        else:
                            reply_text = (
                                "❌ *No Departments Available*\n\n"
                                "You don't have access to any departments or haven't linked your account yet.\n\n"
                                "To get started:\n"
                                "1. Use `/auth` to link your GitLab account\n"
                                "2. Make sure you have access to departments in Cometa\n"
                                "3. Try `/subscribe` again\n\n"
                                f"Your Chat ID: `{chat_id}`"
                            )
                    except TelegramUserLink.DoesNotExist:
                        reply_text = (
                            "🔗 *Account Not Linked*\n\n"
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
                        user_link = TelegramUserLink.objects.get(chat_id=str(chat_id), is_active=True, is_verified=True)
                        
                        # Get user's active subscriptions
                        subscriptions = TelegramSubscription.objects.filter(
                            user_id=user_link.user_id,
                            chat_id=str(chat_id),
                            is_active=True
                        ).select_related()
                        
                        if subscriptions:
                            reply_text = (
                                "📋 *Your Active Subscriptions*\n\n"
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
                            keyboard.append([{"text": "❌ Cancel", "callback_data": "cancel"}])
                            
                            reply_markup = {"inline_keyboard": keyboard}
                        else:
                            reply_text = (
                                "📭 *No Active Subscriptions*\n\n"
                                "You don't have any active notification subscriptions.\n\n"
                                "Use `/subscribe` to subscribe to feature notifications."
                            )
                            
                    except TelegramUserLink.DoesNotExist:
                        reply_text = (
                            "🔗 *Account Not Linked*\n\n"
                            "You need to authenticate first.\n"
                            "Use `/auth` to link your account."
                        )
                    except Exception as e:
                        logger.error(f"Error in unsubscribe command: {str(e)}")
                        reply_text = (
                            "❌ *Error*\n\n"
                            "An error occurred while fetching your subscriptions. Please try again later."
                        )
                elif lower == "/subscriptions" or lower == "/list":
                    # Handle list subscriptions command
                    try:
                        user_link = TelegramUserLink.objects.get(chat_id=str(chat_id), is_active=True, is_verified=True)
                        
                        # Get user's active subscriptions
                        subscriptions = TelegramSubscription.objects.filter(
                            user_id=user_link.user_id,
                            chat_id=str(chat_id),
                            is_active=True
                        )
                        
                        if subscriptions:
                            reply_text = (
                                "📋 *Your Active Subscriptions*\n\n"
                            )
                            
                            # Group by department for better organization
                            from collections import defaultdict
                            dept_features = defaultdict(list)
                            
                            for sub in subscriptions:
                                try:
                                    feature = Feature.objects.get(feature_id=sub.feature_id)
                                    dept_features[feature.department_name].append(feature)
                                except Feature.DoesNotExist:
                                    continue
                            
                            for dept_name, features in dept_features.items():
                                reply_text += f"*{dept_name}:*\n"
                                for feature in features:
                                    reply_text += f"  • {feature.feature_name} (ID: {feature.feature_id})\n"
                                reply_text += "\n"
                            
                            reply_text += "Use `/unsubscribe` to manage your subscriptions."
                        else:
                            reply_text = (
                                "📭 *No Active Subscriptions*\n\n"
                                "You don't have any active notification subscriptions.\n\n"
                                "Use `/subscribe` to subscribe to feature notifications."
                            )
                            
                    except TelegramUserLink.DoesNotExist:
                        reply_text = (
                            "🔗 *Account Not Linked*\n\n"
                            "You need to authenticate first.\n"
                            "Use `/auth` to link your account."
                        )
                elif lower == "/logout":
                    # Handle logout command
                    try:
                        user_link = TelegramUserLink.objects.get(
                            chat_id=str(chat_id),
                            is_active=True,
                            is_verified=True
                        )
                        if user_link.user_id > 0:
                            # Get user details before deletion
                            from backend.models import OIDCAccount
                            user_name = "User"
                            try:
                                user = OIDCAccount.objects.get(user_id=user_link.user_id)
                                user_name = user.name
                            except OIDCAccount.DoesNotExist:
                                pass
                            
                            # Delete the link
                            user_link.delete()
                            
                            # Also clear any Django sessions that might have this chat_id
                            from django.contrib.sessions.models import Session
                            sessions_cleared = 0
                            for session in Session.objects.all():
                                try:
                                    data = session.get_decoded()
                                    if data.get('telegram_chat_id') == str(chat_id):
                                        session.delete()
                                        sessions_cleared += 1
                                except:
                                    # Skip sessions that can't be decoded
                                    pass
                            
                            reply_text = (
                                "👋 *Logged Out Successfully*\n\n"
                                f"Goodbye *{user_name}*!\n"
                                "Your Telegram account has been disconnected.\n\n"
                                "Use `/auth` to log in again whenever you're ready."
                            )
                            
                            logger.info(f"User {user_name} (chat_id: {chat_id}) logged out successfully. Cleared {sessions_cleared} session(s).")
                        else:
                            reply_text = (
                                "❓ *Not Logged In*\n\n"
                                "You are not currently logged in.\n"
                                "Use `/auth` to connect your account."
                            )
                    except TelegramUserLink.DoesNotExist:
                        reply_text = (
                            "❓ *Not Logged In*\n\n"
                            "You are not currently logged in.\n"
                            "Use `/auth` to connect your account."
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


@csrf_exempt
def set_telegram_webhook(request):
    """
    Helper endpoint to register / update the Telegram webhook with the bot API.
    Call it with ?url=<public_url> (GET) or JSON body {"url": "..."} (POST).
    The function will automatically include the optional secret token when
    configured in COMETA_TELEGRAM_WEBHOOK_SECRET.
    """

    bot_token = ConfigurationManager.get_configuration("COMETA_TELEGRAM_BOT_TOKEN", None)
    if not bot_token:
        return JsonResponse({"success": False, "error": "Bot token not configured"}, status=500)

    # Determine the target webhook URL
    webhook_url = None
    if request.method == "POST":
        try:
            body = json.loads(request.body.decode("utf-8"))
            webhook_url = body.get("webhook_url") or body.get("url")
        except Exception:
            pass
    if not webhook_url:
        webhook_url = request.GET.get("webhook_url") or request.GET.get("url")

    if not webhook_url:
        # Fallback: derive from current request host (works with ngrok)
        webhook_url = request.build_absolute_uri("/telegram/webhook/")

    secret_token = ConfigurationManager.get_configuration("COMETA_TELEGRAM_WEBHOOK_SECRET", "")

    payload = {"url": webhook_url}
    if secret_token:
        payload["secret_token"] = secret_token
    
    logger.info(f"Setting Telegram webhook to: {webhook_url}")

    try:
        response = requests.post(
            f"https://api.telegram.org/bot{bot_token}/setWebhook",
            json=payload,
            timeout=10,
        )
        data = response.json()
        success = data.get("ok", False)
    except Exception as exc:
        logger.error(f"Failed to set Telegram webhook: {exc}")
        return JsonResponse({"success": False, "error": str(exc)})

    return JsonResponse({"success": success, "telegram_response": data})


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
        
        user_id = request.session['user']['user_id']
        
        # Find and deactivate subscription
        try:
            subscription = TelegramSubscription.objects.get(
                user_id=user_id,
                chat_id=chat_id,
                feature_id=feature_id
            )
            subscription.is_active = False
            subscription.save()
            
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


def get_telegram_subscriptions_for_feature(feature_result):
    """
    Helper function to get active subscriptions for a feature result
    Used by notification system to send automated notifications
    """
    try:
        feature_id = feature_result.feature.feature_id
        subscriptions = TelegramSubscription.objects.filter(
            feature_id=feature_id,
            is_active=True
        )
        
        chat_ids = []
        for subscription in subscriptions:
            # Check if notification type matches result status
            if feature_result.result_status == 'Success' and 'on_success' in subscription.notification_types:
                chat_ids.append(subscription.chat_id)
            elif feature_result.result_status != 'Success' and 'on_failure' in subscription.notification_types:
                chat_ids.append(subscription.chat_id)
                
            # Update last notification sent timestamp
            subscription.last_notification_sent = datetime.now()
            subscription.save()
        
        return list(set(chat_ids))  # Remove duplicates
        
    except Exception as e:
        logger.error(f"Error in get_telegram_subscriptions_for_feature: {str(e)}")
        return []


# ========================= Telegram GitLab OAuth Authentication =========================
@csrf_exempt
def generate_auth_token(request):
    """
    Generate authentication token for Telegram bot deep link authentication
    This endpoint is called by the Telegram bot to initiate OAuth flow
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method allowed'})
    
    try:
        data = json.loads(request.body.decode('utf-8'))
        chat_id = data.get('chat_id')
        
        if not chat_id:
            return JsonResponse({'success': False, 'error': 'chat_id is required'})
        
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


@csrf_exempt
def verify_auth_token(request):
    """
    Verify authentication token (used internally by OAuth callback)
    """
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Only POST method allowed'})
    
    try:
        data = json.loads(request.body.decode('utf-8'))
        token = data.get('token')
        
        if not token:
            return JsonResponse({'success': False, 'error': 'token is required'})
        
        # Find user link by token
        user_link = TelegramUserLink.objects.filter(auth_token=token).first()
        
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
                'is_verified': True
            }
        )
        
        if not created:
            # Update existing link
            user_link.chat_id = chat_id
            user_link.username = username
            user_link.first_name = first_name
            user_link.last_name = last_name
            user_link.is_active = True
            user_link.is_verified = True
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
    """
    try:
        from backend.models import OIDCAccount, Department, Account_role
        
        # Get OIDCAccount for user
        oidc_account = OIDCAccount.objects.get(user_id=user_id)
        
        # Get departments from Account_role (user-department relationships)
        department_roles = Account_role.objects.filter(user=user_id)
        department_ids = [role.department_id for role in department_roles]
        
        # Get department details
        departments = Department.objects.filter(department_id__in=department_ids)
        
        accessible_departments = []
        for dept in departments:
            accessible_departments.append({
                'department_id': dept.department_id,
                'department_name': dept.department_name
            })
                
        return accessible_departments
        
    except Exception as e:
        logger.error(f"Error in get_user_accessible_departments: {str(e)}")
        return []


def get_department_features(user_id, department_id):
    """
    Get features accessible to a user within a specific department
    """
    try:
        # Verify user has access to this department
        user_departments = get_user_accessible_departments(user_id)
        logger.info(f"User {user_id} has access to departments: {[d['department_id'] for d in user_departments]}")
        
        if not any(dept['department_id'] == department_id for dept in user_departments):
            logger.warning(f"User {user_id} does not have access to department {department_id}")
            return []
        
        # Get all features from this department
        features = Feature.objects.filter(
            department_id=department_id
        )
        
        logger.info(f"Found {features.count()} features in department {department_id}")
        
        accessible_features = []
        for feature in features:
            accessible_features.append({
                'feature_id': feature.feature_id,
                'feature_name': feature.feature_name,
                'department_id': feature.department_id,
                'environment_id': feature.environment_id,
                'environment_name': feature.environment_name
            })
        
        logger.info(f"Returning {len(accessible_features)} accessible features for user {user_id} in department {department_id}")
        return accessible_features
        
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
        
        # Verify the token
        user_link = TelegramUserLink.objects.filter(auth_token=token).first()
        
        if not user_link:
            logger.error(f"No user link found for token: {token}")
            return False
            
        if not user_link.is_auth_token_valid():
            logger.error(f"Invalid or expired auth token: {token}")
            return False
        
        logger.info(f"Found valid user link for chat_id: {user_link.chat_id}")
        
        # Get user info from session
        user_info = request.session.get('user')
        if not user_info:
            logger.error("No user info in session for Telegram auth completion")
            logger.info(f"Session contents: {list(request.session.keys())}")
            return False
        
        # Validate user_id exists and is valid
        user_id = user_info.get('user_id')
        if not user_id or user_id == 0:
            logger.error(f"Invalid user_id in session: {user_id}")
            logger.info(f"User info contents: {user_info}")
            return False
        
        # Update user link with OAuth provider info
        user_link.user_id = user_id
        user_link.gitlab_username = user_info.get('name')  # OAuth username
        user_link.gitlab_email = user_info.get('email')
        user_link.gitlab_name = user_info.get('name')
        user_link.is_verified = True
        user_link.clear_auth_token()  # Clear the temporary token
        user_link.save()
        
        logger.info(f"Telegram auth completed for user {user_link.user_id}, chat {user_link.chat_id}")
        return True
        
    except Exception as e:
        logger.error(f"Error completing Telegram auth: {str(e)}")
        logger.exception(e)
        return False
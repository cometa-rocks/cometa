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
from backend.models import Feature_result
from backend.utility.notification_manager import NotificationManger
from backend.utility.configurations import ConfigurationManager

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

    logger.debug(f"Telegram webhook update received: {update}")

    # Very small demo logic so we can verify replies quickly
    # Only react to basic text commands – extend as needed later
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
                        "Currently I can notify you about test runs."
                    )
                elif lower == "/ping":
                    reply_text = "pong 🏓"

                if reply_text:
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
            webhook_url = body.get("url")
        except Exception:
            pass
    if not webhook_url:
        webhook_url = request.GET.get("url")

    if not webhook_url:
        # Fallback: derive from current request host (works with ngrok)
        webhook_url = request.build_absolute_uri("/telegram/webhook/")

    secret_token = ConfigurationManager.get_configuration("COMETA_TELEGRAM_WEBHOOK_SECRET", "")

    payload = {"url": webhook_url}
    if secret_token:
        payload["secret_token"] = secret_token

    try:
        response = requests.post(
            f"https://api.telegram.org/bot{bot_token}/setWebhook",
            data=payload,
            timeout=10,
        )
        data = response.json()
        success = data.get("ok", False)
    except Exception as exc:
        logger.error(f"Failed to set Telegram webhook: {exc}")
        return JsonResponse({"success": False, "error": str(exc)})

    return JsonResponse({"success": success, "telegram_response": data})
    
    
    
    
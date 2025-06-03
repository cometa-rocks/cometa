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

logger = getLogger()


from backend.generatePDF import PDFAndEmailManager

def send_notifications(request):
    
    pdf_email_manager = PDFAndEmailManager()
    # prepares the PDF and send the email
    pdf_email_manager.prepare_the_get(request=request)
    
    if request.method != 'GET':
        logger.warning(f"Invalid request method: {request.method}")
        return JsonResponse({'success': False, 'error': 'Only GET method allowed'})
    
    try:
        feature_result_id = request.GET.get('feature_result_id')
        logger.info(f"Received Telegram notification request for feature_result_id: {feature_result_id}")
        
        if not feature_result_id:
            logger.error("Missing feature_result_id parameter")
            return JsonResponse({'success': False, 'error': 'feature_result_id parameter is required'})
        
        # Get the feature result
        try:
            feature_result = Feature_result.objects.get(feature_result_id=feature_result_id)
            logger.debug(f"Found feature result: {feature_result.feature_name} (ID: {feature_result_id})")
        except Feature_result.DoesNotExist:
            logger.error(f"Feature result not found for ID: {feature_result_id}")
            return JsonResponse({'success': False, 'error': f'Feature result with ID {feature_result_id} not found'})
        
        # Create notification manager and send notification
        try:
            notification_manager = NotificationManger("telegram", pdf_email_manager.is_pdf_generated() )
            logger.debug("Created Telegram notification manager")
            
            success = notification_manager.send_message(feature_result )
            
            if success:
                logger.info(f"Telegram notification sent successfully for feature_result_id: {feature_result_id}")
                return JsonResponse({'success': True, 'message': 'Telegram notification sent successfully'})
            else:
                logger.warning(f"Telegram notification failed for feature_result_id: {feature_result_id}")
                return JsonResponse({'success': False, 'message': 'Failed to send Telegram notification'})
                
        except Exception as e:
            logger.error(f"Error in notification manager for feature_result_id {feature_result_id}: {str(e)}")
            return JsonResponse({'success': False, 'error': f'Notification manager error: {str(e)}'})
           
    except Exception as e:
        logger.error(f"Unexpected error in send_telegram_notification_view: {str(e)}")
        return JsonResponse({'success': False, 'error': f'Unexpected error: {str(e)}'})

    
    
    
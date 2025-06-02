"""
Telegram notification utility for sending test results
Author: Cometa Development Team
Version: 1.0.0
"""

import requests
import json
import logging
from datetime import datetime
from zoneinfo import ZoneInfo
import pytz
import os
import tempfile
from utility.configurations import ConfigurationManager
from utility.functions import *

# Get logger
# logger = logging.getLogger("cometa_telegram_notifications") # Comment out module-level logger

def send_telegram_notification(feature_result_data, department_chat_ids, feature_result_id=None):
    logger = logging.getLogger("cometa_telegram_notifications_send")
    """
    Send a Telegram notification with test results to department chat IDs
    Optionally includes PDF report as attachment
    
    Args:
        feature_result_data (dict): The feature result data containing test information
        department_chat_ids (str): Comma-separated string of chat IDs for the department
        feature_result_id (str, optional): Feature result ID for PDF generation
    
    Returns:
        bool: True if all notifications sent successfully, False otherwise
    """
    
    # Check if Telegram is enabled globally
    telegram_enabled = ConfigurationManager.get_configuration('COMETA_TELEGRAM_ENABLED', 'False')
    if telegram_enabled.lower() != 'true':
        logger.debug("Telegram notifications are globally disabled")
        return False
    
    # Get bot token
    bot_token = ConfigurationManager.get_configuration('COMETA_TELEGRAM_BOT_TOKEN', '')
    if not bot_token:
        logger.warning("Telegram bot token is not configured")
        return False
    
    # Parse chat IDs
    if not department_chat_ids or not department_chat_ids.strip():
        logger.warning("No Telegram chat IDs configured for this department")
        return False
    
    chat_ids = [chat_id.strip() for chat_id in department_chat_ids.split(',') if chat_id.strip()]
    if not chat_ids:
        logger.warning("No valid Telegram chat IDs found")
        return False
    
    # Try to get PDF report if feature_result_id is provided
    pdf_file_path = None
    if feature_result_id:
        try:
            pdf_file_path = get_pdf_report(feature_result_id, logger)
        except Exception as e:
            logger.warning(f"Failed to generate/get PDF report: {str(e)}")
            pdf_file_path = None
    
    # Build message
    message = build_telegram_message(feature_result_data)
    
    # Send to all chat IDs
    success_count = 0
    for chat_id in chat_ids:
        if pdf_file_path and os.path.exists(pdf_file_path):
            # Send as document with PDF attachment
            if send_document_to_chat(bot_token, chat_id, message, pdf_file_path):
                success_count += 1
            else:
                logger.error(f"Failed to send Telegram document to chat ID: {chat_id}")
        else:
            # Send as regular message without attachment
            if send_message_to_chat(bot_token, chat_id, message):
                success_count += 1
            else:
                logger.error(f"Failed to send Telegram message to chat ID: {chat_id}")
    
    # Clean up temporary PDF file if created
    if pdf_file_path and os.path.exists(pdf_file_path) and '/tmp/' in pdf_file_path:
        try:
            os.remove(pdf_file_path)
            logger.debug(f"Cleaned up temporary PDF file: {pdf_file_path}")
        except Exception as e:
            logger.warning(f"Failed to clean up temporary PDF file: {str(e)}")
    
    logger.info(f"Telegram notifications sent to {success_count}/{len(chat_ids)} chat IDs")
    return success_count == len(chat_ids)

def get_pdf_report(feature_result_id, logger):
    """
    Get the PDF report for a feature result
    
    Args:
        feature_result_id (str): The feature result ID
        logger: Logger instance
    
    Returns:
        str: Path to the PDF file, or None if failed
    """
    try:
        # Request PDF generation/retrieval from the backend
        pdf_url = f'{get_cometa_backend_url()}/pdf/?feature_result_id={feature_result_id}&download=true'
        headers = {'Host': 'cometa.local'}
        
        logger.debug(f"Requesting PDF from: {pdf_url}")
        response = requests.get(pdf_url, headers=headers, timeout=60)
        
        if response.status_code == 200:
            # Create a temporary file to store the PDF
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf', prefix=f'cometa_report_{feature_result_id}_') as temp_file:
                temp_file.write(response.content)
                pdf_file_path = temp_file.name
            
            logger.debug(f"PDF report saved to: {pdf_file_path}")
            return pdf_file_path
        else:
            logger.error(f"Failed to get PDF report. Status code: {response.status_code}")
            return None
            
    except Exception as e:
        logger.error(f"Error getting PDF report: {str(e)}")
        return None

def build_telegram_message(feature_result_data):
    logger = logging.getLogger("cometa_telegram_notifications_build")
    """
    Build a formatted Telegram message from feature result data
    
    Args:
        feature_result_data (dict): The feature result data
    
    Returns:
        str: Formatted message for Telegram
    """
    
    # Extract key information
    feature_name = feature_result_data.get('feature_name', 'Unknown Feature')
    app_name = feature_result_data.get('app_name', 'Unknown App')
    environment_name = feature_result_data.get('environment_name', 'Unknown Environment')
    department_name = feature_result_data.get('department_name', 'Unknown Department')
    
    total = feature_result_data.get('total', 0)
    ok = feature_result_data.get('ok', 0)
    fails = feature_result_data.get('fails', 0)
    skipped = feature_result_data.get('skipped', 0)
    success = feature_result_data.get('success', False)
    execution_time = feature_result_data.get('execution_time', 0)
    pixel_diff = feature_result_data.get('pixel_diff', 0)
    result_date = feature_result_data.get('result_date', None)
    
    # Format execution time
    if execution_time > 0:
        execution_time_seconds = execution_time / 1000
        time_str = f"{execution_time_seconds:.2f}s"
    else:
        time_str = "N/A"
    
    # Format date and time in multiple timezones (same as email)
    date_time_str = ""
    if result_date:
        try:
            # Parse the datetime string - assuming it's in UTC format
            if isinstance(result_date, str):
                # Try to parse ISO format datetime
                dt = datetime.fromisoformat(result_date.replace('Z', '+00:00'))
            else:
                dt = result_date
            
            # Ensure datetime has UTC timezone info
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=ZoneInfo('UTC'))
            
            # Format in different timezones (matching email format)
            utc_date = dt.astimezone(pytz.timezone('UTC')).strftime('%Y-%m-%d %H:%M:%S %Z')
            cest_date = dt.astimezone(pytz.timezone('Europe/Berlin')).strftime('%Y-%m-%d %H:%M:%S %Z')
            ist_date = dt.astimezone(pytz.timezone('Asia/Kolkata')).strftime('%Y-%m-%d %H:%M:%S %Z')
            
            date_time_str = f"""📅 <b>Date & Time:</b>
{utc_date}
{cest_date}
{ist_date}

"""
        except Exception as e:
            logger.warning(f"Error formatting datetime: {str(e)}")
            date_time_str = ""
    
    # Choose emoji based on result
    status_emoji = "✅" if success else "❌"
    
    # Build message with date/time and pixel difference
    message = f"""{status_emoji} <b>Test Execution Complete</b>

🏢 <b>Department:</b> {department_name}
📱 <b>Application:</b> {app_name}
🌍 <b>Environment:</b> {environment_name}
🧪 <b>Feature:</b> {feature_name}

{date_time_str}📊 <b>Results:</b>
• Total Steps: {total}
• Passed: {ok} ✅
• Failed: {fails} ❌
• Skipped: {skipped} ⏭️

🖼️ <b>Pixel Difference:</b> {pixel_diff}
⏱️ <b>Execution Time:</b> {time_str}
🎯 <b>Overall Status:</b> {"PASSED" if success else "FAILED"}"""

    return message

def send_document_to_chat(bot_token, chat_id, caption, document_path):
    logger = logging.getLogger("cometa_telegram_notifications_document")
    """
    Send a document (PDF) to a specific Telegram chat with caption
    
    Args:
        bot_token (str): Telegram bot token
        chat_id (str): Telegram chat ID
        caption (str): Caption/message to send with the document
        document_path (str): Path to the document file
    
    Returns:
        bool: True if document sent successfully, False otherwise
    """
    
    url = f"https://api.telegram.org/bot{bot_token}/sendDocument"
    
    try:
        with open(document_path, 'rb') as document:
            # Extract filename from path for better presentation
            filename = os.path.basename(document_path)
            if filename.startswith('cometa_report_'):
                # Create a more user-friendly filename
                filename = f"Test_Report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
            
            files = {
                'document': (filename, document, 'application/pdf')
            }
            
            data = {
                'chat_id': chat_id,
                'caption': caption,
                'parse_mode': 'HTML'
            }
            
            response = requests.post(url, data=data, files=files, timeout=30)
            response.raise_for_status()
            
            result = response.json()
            if result.get('ok'):
                logger.debug(f"Telegram document sent successfully to chat ID: {chat_id}")
                return True
            else:
                logger.error(f"Telegram API error for document to chat ID {chat_id}: {result.get('description', 'Unknown error')}")
                return False
                
    except FileNotFoundError:
        logger.error(f"Document file not found: {document_path}")
        return False
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error sending Telegram document to chat ID {chat_id}: {str(e)}")
        return False
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error for Telegram document response (chat ID {chat_id}): {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending Telegram document to chat ID {chat_id}: {str(e)}")
        return False

def send_message_to_chat(bot_token, chat_id, message):
    logger = logging.getLogger("cometa_telegram_notifications_chat") # Local logger
    """
    Send a message to a specific Telegram chat
    
    Args:
        bot_token (str): Telegram bot token
        chat_id (str): Telegram chat ID
        message (str): Message to send
    
    Returns:
        bool: True if message sent successfully, False otherwise
    """
    
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    
    payload = {
        'chat_id': chat_id,
        'text': message,
        'parse_mode': 'HTML'
    }
    
    try:
        response = requests.post(url, data=payload, timeout=10)
        response.raise_for_status()
        
        result = response.json()
        if result.get('ok'):
            logger.debug(f"Telegram message sent successfully to chat ID: {chat_id}")
            return True
        else:
            logger.error(f"Telegram API error for chat ID {chat_id}: {result.get('description', 'Unknown error')}")
            return False
            
    except requests.exceptions.RequestException as e:
        logger.error(f"Request error sending Telegram message to chat ID {chat_id}: {str(e)}")
        return False
    except json.JSONDecodeError as e:
        logger.error(f"JSON decode error for Telegram response (chat ID {chat_id}): {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Unexpected error sending Telegram message to chat ID {chat_id}: {str(e)}")
        return False 
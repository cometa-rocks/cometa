import requests
import json
import logging
import os
import tempfile
from datetime import datetime
from zoneinfo import ZoneInfo
import pytz
from django.conf import settings
from backend.utility.config_handler import get_cometa_backend_url
from .configurations import ConfigurationManager
from backend.models import Department
from backend.models import FeatureTelegramOptions

# TODO: Implement Discord notification manager
# class DiscordNotificationManger:
#     def send_message(self, feature_result):
#         pass

# TODO: Implement WhatsApp notification manager  
# class WhatsappNotificationManger:
#     def send_message(self, feature_result):
#         pass

# TODO: Implement Teams notification manager
# class TeamsNotificationManger:
#     def send_message(self, feature_result):
#         pass

# TODO: Implement Email notification manager
# class EmailNotificationManger:
#     def send_message(self, feature_result):
#         pass

class TelegramNotificationManger:
    
    def __init__(self):
        self.logger = logging.getLogger("TelegramNotificationManager")
    
    def send_message(self, feature_result):
        """
        Send Telegram notification for a feature result
        
        Args:
            feature_result: FeatureResult model instance
        
        Returns:
            bool: True if notification sent successfully, False otherwise
        """
        try:
            self.logger.info(f"Starting Telegram notification process for feature_result_id: {feature_result.feature_result_id}")
            
            # Check if Telegram notifications are enabled and get bot token
            telegram_enabled = ConfigurationManager.get_configuration('COMETA_TELEGRAM_ENABLED', False)
            bot_token = ConfigurationManager.get_configuration('COMETA_TELEGRAM_BOT_TOKEN', None)
            
            if not telegram_enabled or not bot_token:
                self.logger.warning(f"Telegram notifications disabled or bot token not configured. Enabled: {telegram_enabled}, Token: {'***' if bot_token else 'Not set'}")
                return False
            
            # Check if feature has Telegram notifications enabled
            feature_telegram_enabled = getattr(feature_result.feature_id, 'send_telegram_notification', False)
            self.logger.debug(f"Feature Telegram enabled setting: {feature_telegram_enabled}")
            if not feature_telegram_enabled:
                self.logger.debug(f"Telegram notifications disabled for feature {feature_result.feature_id.feature_id}")
                return False
            
            # Get or create telegram options for this feature
            telegram_options, created = FeatureTelegramOptions.objects.get_or_create(
                feature=feature_result.feature_id,
                defaults={
                    'include_department': False,
                    'include_application': False,
                    'include_environment': False,
                    'include_feature_name': False,
                    'include_datetime': False,
                    'include_execution_time': False,
                    'include_browser_timezone': False,
                    'include_browser': False,
                    'include_overall_status': False,
                    'include_step_results': False,
                    'include_pixel_diff': False,
                    'attach_pdf_report': False,
                    'attach_screenshots': False,
                    'custom_message': '',
                    'send_on_error': False,
                    'check_maximum_notification_on_error_telegram': False,
                    'maximum_notification_on_error_telegram': 3,
                    'number_notification_sent_telegram': 0
                }
            )
            
            # Check maximum notification logic (similar to email implementation)
            should_send_notification = True
            
            if telegram_options.check_maximum_notification_on_error_telegram:
                self.logger.debug("Checking for maximum Telegram notifications on error")
                
                # Check if current feature_result is successful
                if feature_result.success and not telegram_options.send_on_error:
                    # Test passed and not configured for error-only, send notification and reset counter
                    should_send_notification = True
                    telegram_options.number_notification_sent_telegram = 0
                    
                elif feature_result.success:
                    # Test passed but configured for error-only, don't send and reset counter
                    should_send_notification = False
                    telegram_options.number_notification_sent_telegram = 0
                    
                # Test failed, check if we can still send notifications
                elif telegram_options.number_notification_sent_telegram < telegram_options.maximum_notification_on_error_telegram:
                    telegram_options.number_notification_sent_telegram = telegram_options.number_notification_sent_telegram + 1
                    should_send_notification = True
                    
                elif telegram_options.number_notification_sent_telegram >= telegram_options.maximum_notification_on_error_telegram:
                    should_send_notification = False
            else:
                # Maximum notification check is disabled, reset counter
                telegram_options.number_notification_sent_telegram = 0
            
            # Save telegram options to persist counter changes
            telegram_options.save()
            
            if not should_send_notification:
                self.logger.info(f"Skipping Telegram notification due to maximum notification limit or configuration")
                return True  # Return True because this is expected behavior, not an error
            
            # Get department chat IDs - need to fetch Department object manually since Feature doesn't have FK
            try:
                department = Department.objects.get(department_id=feature_result.feature_id.department_id)
                department_settings = department.settings or {}
                department_chat_ids = department_settings.get('telegram_chat_ids', '')
                self.logger.debug(f"Department chat IDs: {department_chat_ids}")
            except Department.DoesNotExist:
                self.logger.warning(f"Department {feature_result.feature_id.department_id} not found")
                return False
            
            if not department_chat_ids or not department_chat_ids.strip():
                self.logger.warning(f"No Telegram chat IDs configured for department {feature_result.department_name}")
                return False
            
            # Parse chat IDs
            chat_ids = [chat_id.strip() for chat_id in department_chat_ids.split(',') if chat_id.strip()]
            if not chat_ids:
                self.logger.warning("No valid Telegram chat IDs found")
                return False
            
            self.logger.info(f"Found {len(chat_ids)} chat IDs to send notifications to")
            
            # Build message
            message = self._build_message(feature_result, telegram_options)
            self.logger.debug("Message built successfully")
            
            # Check if message should be sent (could be None if send_on_error is true and test passed)
            if message is None:
                self.logger.info("Message was None, skipping notification")
                return True
            
            # Try to get PDF report if feature has PDF attachment enabled
            pdf_file_path = None
            screenshot_files = []
            try:
                # Check PDF attachment setting from the already fetched telegram_options
                if telegram_options.attach_pdf_report:
                    pdf_file_path = self._get_pdf_report(feature_result.feature_result_id)
                    if pdf_file_path:
                        self.logger.debug(f"PDF report obtained: {pdf_file_path}")
                    else:
                        self.logger.debug("No PDF report obtained, will send text-only message")
                else:
                    self.logger.debug("PDF attachment disabled in telegram options")
                
                # Try to get screenshots if feature has screenshot attachment enabled
                if telegram_options.attach_screenshots:
                    screenshot_files = self._get_screenshots(feature_result.feature_result_id)
                    if screenshot_files:
                        self.logger.debug(f"Screenshots obtained: {len(screenshot_files)} files")
                    else:
                        self.logger.debug("No screenshots obtained")
                else:
                    self.logger.debug("Screenshot attachment disabled in telegram options")
            except Exception as e:
                self.logger.warning(f"Failed to generate/get PDF report or screenshots: {str(e)}")
            
            # Send to all chat IDs
            success_count = 0
            for chat_id in chat_ids:
                self.logger.debug(f"Sending notification to chat ID: {chat_id}")
                
                # Determine what to send based on available attachments
                has_pdf = pdf_file_path and os.path.exists(pdf_file_path)
                has_screenshots = len(screenshot_files) > 0
                
                if has_pdf and has_screenshots:
                    # Send PDF first, then screenshots as media group
                    pdf_success = self._send_document_to_chat(bot_token, chat_id, message, pdf_file_path)
                    screenshot_success = self._send_screenshots_as_media_group(bot_token, chat_id, screenshot_files)
                    if pdf_success and screenshot_success:
                        success_count += 1
                        self.logger.debug(f"Successfully sent PDF and screenshots to chat ID: {chat_id}")
                    else:
                        self.logger.error(f"Failed to send PDF and/or screenshots to chat ID: {chat_id}")
                elif has_pdf:
                    # Send PDF only
                    if self._send_document_to_chat(bot_token, chat_id, message, pdf_file_path):
                        success_count += 1
                        self.logger.debug(f"Successfully sent PDF to chat ID: {chat_id}")
                    else:
                        self.logger.error(f"Failed to send PDF to chat ID: {chat_id}")
                elif has_screenshots:
                    # Send screenshots as media group with caption
                    if self._send_screenshots_as_media_group(bot_token, chat_id, screenshot_files, message):
                        success_count += 1
                        self.logger.debug(f"Successfully sent screenshots to chat ID: {chat_id}")
                    else:
                        self.logger.error(f"Failed to send screenshots to chat ID: {chat_id}")
                else:
                    # Send text-only message
                    if self._send_message_to_chat(bot_token, chat_id, message):
                        success_count += 1
                        self.logger.debug(f"Successfully sent message to chat ID: {chat_id}")
                    else:
                        self.logger.error(f"Failed to send message to chat ID: {chat_id}")
            
            # Clean up temporary files
            if pdf_file_path and os.path.exists(pdf_file_path) and '/tmp/' in pdf_file_path:
                try:
                    os.remove(pdf_file_path)
                    self.logger.debug(f"Cleaned up temporary PDF file: {pdf_file_path}")
                except Exception as e:
                    self.logger.warning(f"Failed to clean up temporary PDF file: {str(e)}")
            
            for screenshot_file in screenshot_files:
                if os.path.exists(screenshot_file['path']) and '/tmp/' in screenshot_file['path']:
                    try:
                        os.remove(screenshot_file['path'])
                        self.logger.debug(f"Cleaned up temporary screenshot file: {screenshot_file['path']}")
                    except Exception as e:
                        self.logger.warning(f"Failed to clean up temporary screenshot file: {str(e)}")
            
            final_success = success_count == len(chat_ids)
            self.logger.info(f"Telegram notification process completed. Success: {final_success} ({success_count}/{len(chat_ids)} sent)")
            return final_success
            
        except Exception as e:
            self.logger.error(f"Error sending Telegram notification: {str(e)}")
            return False
    
    def _build_message(self, feature_result, telegram_options):
        """
        Build a formatted Telegram message from feature result data based on user configuration
        
        Args:
            feature_result: FeatureResult model instance
            telegram_options: FeatureTelegramOptions model instance
        
        Returns:
            str: Formatted message for Telegram
        """
        try:
            self.logger.debug(f"Using telegram options for feature {feature_result.feature_id.feature_id}")
            
            # Check if we should send notification based on error setting
            if telegram_options.send_on_error and feature_result.success:
                self.logger.debug("Telegram configured for error-only and test passed, skipping notification")
                return None
            
            # Build the message with proper formatting
            message_parts = []
            
            # Add custom message if provided
            if telegram_options.custom_message and telegram_options.custom_message.strip():
                message_parts.append(f"Custom Message:\n{telegram_options.custom_message.strip()}")
                message_parts.append("")  # Add blank line after custom message
            
            # Status line with emoji
            status_emoji = "✅" if feature_result.success else "❌"
            message_parts.append(f"{status_emoji} Test Execution Complete")
            message_parts.append("")  # Add blank line after status
            
            # Basic Information section
            basic_info_parts = []
            if telegram_options.include_department:
                basic_info_parts.append(f"🏢 Department: {feature_result.department_name}")
            if telegram_options.include_application:
                basic_info_parts.append(f"📱 Application: {feature_result.app_name}")
            if telegram_options.include_environment:
                basic_info_parts.append(f"🌍 Environment: {feature_result.environment_name}")
            if telegram_options.include_feature_name:
                basic_info_parts.append(f"🧪 Feature: {feature_result.feature_name}")
            
            if basic_info_parts:
                message_parts.extend(basic_info_parts)
                message_parts.append("")  # Add blank line after basic info
            
            # Date & Time section
            if telegram_options.include_datetime:
                message_parts.append("📅 Date & Time:")
                
                # Format datetime in multiple timezones for better readability
                utc_time = feature_result.result_date
                if isinstance(utc_time, str):
                    utc_time = datetime.fromisoformat(utc_time.replace('Z', '+00:00'))
                
                # Format in UTC
                utc_formatted = utc_time.strftime("%Y-%m-%d %H:%M:%S UTC")
                message_parts.append(utc_formatted)
                
                # Add CEST (Central European Summer Time)
                cest_tz = ZoneInfo("Europe/Berlin")
                cest_time = utc_time.astimezone(cest_tz)
                cest_formatted = cest_time.strftime("%Y-%m-%d %H:%M:%S CEST")
                message_parts.append(cest_formatted)
                
                # Add IST (India Standard Time)
                ist_tz = ZoneInfo("Asia/Kolkata")
                ist_time = utc_time.astimezone(ist_tz)
                ist_formatted = ist_time.strftime("%Y-%m-%d %H:%M:%S IST")
                message_parts.append(ist_formatted)
                
                message_parts.append("")  # Add blank line after datetime
            
            # Browser information section
            if telegram_options.include_browser_timezone or telegram_options.include_browser:
                message_parts.append("🌐 Browser Details:")
                
                if telegram_options.include_browser:
                    # Extract browser information from feature_result.browser
                    browser_info = feature_result.browser
                    browser_name = browser_info.get('browser', 'Unknown Browser') if browser_info else 'Unknown Browser'
                    browser_version = browser_info.get('browser_version', 'Unknown Version') if browser_info else 'Unknown Version'
                    os_name = browser_info.get('os', 'Unknown OS') if browser_info else 'Unknown OS'
                    os_version = browser_info.get('os_version', '') if browser_info else ''
                    
                    # Format browser display name (e.g., "Chrome 136", "Edge 135")
                    browser_display = f"{browser_name} {browser_version}"
                    if os_name != 'Unknown OS':
                        if os_version:
                            browser_display += f" on {os_name} {os_version}"
                        else:
                            browser_display += f" on {os_name}"
                    
                    message_parts.append(f"• Browser: {browser_display}")
                
                if telegram_options.include_browser_timezone:
                    # Extract timezone information from feature_result.browser
                    browser_info = feature_result.browser
                    browser_timezone = browser_info.get('selectedTimeZone', 'UTC') if browser_info else 'UTC'
                    message_parts.append(f"• Timezone: {browser_timezone}")
                
                message_parts.append("")  # Add blank line after browser details
            
            # Test Results section
            if telegram_options.include_step_results or telegram_options.include_overall_status:
                if telegram_options.include_step_results:
                    message_parts.append("📊 Results:")
                    message_parts.append(f"• Total Steps: {self._format_number(feature_result.total)}")
                    message_parts.append(f"• Passed: {self._format_number(feature_result.ok)} ✅")
                    message_parts.append(f"• Failed: {self._format_number(feature_result.fails)} ❌")
                    message_parts.append(f"• Skipped: {self._format_number(feature_result.skipped)} ⏭️")
                    message_parts.append("")  # Add blank line after results
            
            # Final details section (pixel diff, execution time, overall status)
            final_details = []
            if telegram_options.include_pixel_diff:
                pixel_diff_formatted = self._format_number(feature_result.pixel_diff) if feature_result.pixel_diff else "0"
                final_details.append(f"🖼️ Pixel Difference: {pixel_diff_formatted}")
            
            if telegram_options.include_execution_time:
                execution_time_str = f"{feature_result.execution_time}s" if feature_result.execution_time else "N/A"
                final_details.append(f"⏱️ Execution Time: {execution_time_str}")
            
            if telegram_options.include_overall_status:
                overall_status = "PASSED" if feature_result.success else "FAILED"
                final_details.append(f"🎯 Overall Status: {overall_status}")
            
            if final_details:
                message_parts.extend(final_details)
            
            # Join all parts with newlines
            message = "\n".join(message_parts)
            return message
            
        except Exception as e:
            self.logger.error(f"Error building Telegram message: {str(e)}")
            # Fallback to basic message
            status_emoji = "✅" if feature_result.success else "❌"
            return f"{status_emoji} <b>Test Execution Complete</b>\n\n🧪 <b>Feature:</b> {feature_result.feature_name}\n🎯 <b>Status:</b> {'PASSED' if feature_result.success else 'FAILED'}"

    def _get_pdf_report(self, feature_result_id):
        """
        Get the PDF report for a feature result
        
        Args:
            feature_result_id (int): The feature result ID
        
        Returns:
            str: Path to the PDF file, or None if failed
        """
        try:
            # Request PDF generation/retrieval from the backend
            pdf_url = f'{get_cometa_backend_url()}/pdf/?feature_result_id={feature_result_id}&download=true'
            headers = {'Host': 'cometa.local'}
            
            self.logger.debug(f"Requesting PDF from: {pdf_url}")
            response = requests.get(pdf_url, headers=headers, timeout=60)
            
            if response.status_code == 200:
                # Create a temporary file to store the PDF
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf', prefix=f'cometa_report_{feature_result_id}_') as temp_file:
                    temp_file.write(response.content)
                    pdf_file_path = temp_file.name
                
                self.logger.debug(f"PDF report saved to: {pdf_file_path}")
                return pdf_file_path
            else:
                self.logger.error(f"Failed to get PDF report. Status code: {response.status_code}")
                return None
                
        except Exception as e:
            self.logger.error(f"Error getting PDF report: {str(e)}")
            return None

    def _get_screenshots(self, feature_result_id):
        """
        Get screenshots from step results for a feature result
        
        Args:
            feature_result_id (int): The feature result ID
        
        Returns:
            list: List of screenshot file dictionaries with 'path' and 'caption' keys, or empty list if failed
        """
        try:
            from backend.models import Step_result
            
            # Get all step results with screenshots for this feature result
            step_results = Step_result.objects.filter(
                feature_result_id=feature_result_id
            ).exclude(
                screenshot_current__exact=''
            ).order_by('step_result_id')
            
            self.logger.debug(f"Found {step_results.count()} step results with screenshots")
            
            screenshots = []
            screenshot_count = 0
            max_screenshots = 10  # Telegram media group limit
            
            for step_result in step_results:
                if screenshot_count >= max_screenshots:
                    self.logger.debug(f"Reached maximum screenshot limit of {max_screenshots}")
                    break
                
                # Process current screenshot (main screenshot)
                if step_result.screenshot_current:
                    screenshot_path = os.path.join(settings.SCREENSHOTS_ROOT, step_result.screenshot_current)
                    if os.path.exists(screenshot_path):
                        screenshots.append({
                            'path': screenshot_path,
                            'caption': f"Step {step_result.step_execution_sequence}: {step_result.step_name[:50]}..." if len(step_result.step_name) > 50 else f"Step {step_result.step_execution_sequence}: {step_result.step_name}",
                            'type': 'current'
                        })
                        screenshot_count += 1
                        self.logger.debug(f"Added current screenshot: {screenshot_path}")
                    else:
                        self.logger.warning(f"Screenshot file not found: {screenshot_path}")
                
                # Break if we've reached the limit
                if screenshot_count >= max_screenshots:
                    break
                
                # Optionally include style screenshots (template/expected images)
                if step_result.screenshot_style and screenshot_count < max_screenshots:
                    style_path = os.path.join(settings.SCREENSHOTS_ROOT, step_result.screenshot_style)
                    if os.path.exists(style_path):
                        screenshots.append({
                            'path': style_path,
                            'caption': f"Expected (Step {step_result.step_execution_sequence})",
                            'type': 'style'
                        })
                        screenshot_count += 1
                        self.logger.debug(f"Added style screenshot: {style_path}")
                
                # Optionally include difference screenshots if there were visual differences
                if step_result.screenshot_difference and screenshot_count < max_screenshots and step_result.pixel_diff > 0:
                    diff_path = os.path.join(settings.SCREENSHOTS_ROOT, step_result.screenshot_difference)
                    if os.path.exists(diff_path):
                        screenshots.append({
                            'path': diff_path,
                            'caption': f"Difference (Step {step_result.step_execution_sequence}) - {step_result.pixel_diff} pixels",
                            'type': 'difference'
                        })
                        screenshot_count += 1
                        self.logger.debug(f"Added difference screenshot: {diff_path}")
            
            self.logger.info(f"Retrieved {len(screenshots)} screenshots for feature_result_id: {feature_result_id}")
            return screenshots
            
        except Exception as e:
            self.logger.error(f"Error getting screenshots: {str(e)}")
            return []

    def _format_number(self, number):
        """
        Format a number with comma separators for better readability
        
        Args:
            number: The number to format (int, float, or string)
        
        Returns:
            str: Formatted number with comma separators
        """
        try:
            if number is None:
                return "0"
            
            # Convert to int if it's a float with no decimal part
            if isinstance(number, float) and number.is_integer():
                number = int(number)
            
            # Format with comma separators
            return f"{number:,}"
        except (ValueError, TypeError):
            # Fallback to string representation if formatting fails
            return str(number) if number is not None else "0"

    def _send_document_to_chat(self, bot_token, chat_id, caption, document_path):
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
                    self.logger.debug(f"Telegram document sent successfully to chat ID: {chat_id}")
                    return True
                else:
                    self.logger.error(f"Telegram API error for document to chat ID {chat_id}: {result.get('description', 'Unknown error')}")
                    return False
                    
        except FileNotFoundError:
            self.logger.error(f"Document file not found: {document_path}")
            return False
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Request error sending Telegram document to chat ID {chat_id}: {str(e)}")
            return False
        except json.JSONDecodeError as e:
            self.logger.error(f"JSON decode error for Telegram document response (chat ID {chat_id}): {str(e)}")
            return False
        except Exception as e:
            self.logger.error(f"Unexpected error sending Telegram document to chat ID {chat_id}: {str(e)}")
            return False

    def _send_message_to_chat(self, bot_token, chat_id, message):
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
                self.logger.debug(f"Telegram message sent successfully to chat ID: {chat_id}")
                return True
            else:
                self.logger.error(f"Telegram API error for chat ID {chat_id}: {result.get('description', 'Unknown error')}")
                return False
                
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Request error sending Telegram message to chat ID {chat_id}: {str(e)}")
            return False
        except json.JSONDecodeError as e:
            self.logger.error(f"JSON decode error for Telegram response (chat ID {chat_id}): {str(e)}")
            return False
        except Exception as e:
            self.logger.error(f"Unexpected error sending Telegram message to chat ID {chat_id}: {str(e)}")
            return False

    def _send_screenshots_as_media_group(self, bot_token, chat_id, screenshots, caption=None):
        """
        Send multiple screenshots as a media group to a specific Telegram chat
        
        Args:
            bot_token (str): Telegram bot token
            chat_id (str): Telegram chat ID
            screenshots (list): List of screenshot dictionaries with 'path' and 'caption' keys
            caption (str): Optional caption for the media group
        
        Returns:
            bool: True if screenshots sent successfully, False otherwise
        """
        url = f"https://api.telegram.org/bot{bot_token}/sendMediaGroup"
        
        try:
            if not screenshots:
                self.logger.warning("No screenshots provided to send")
                return False
            
            # Limit to 10 photos (Telegram's limit for media groups)
            screenshots = screenshots[:10]
            
            media_group = []
            files = {}
            
            for i, screenshot in enumerate(screenshots):
                if not os.path.exists(screenshot['path']):
                    self.logger.warning(f"Screenshot file not found: {screenshot['path']}")
                    continue
                
                # Create a unique attachment name for each photo
                attach_name = f"photo{i}"
                files[attach_name] = open(screenshot['path'], 'rb')
                
                # Add to media group
                media_item = {
                    'type': 'photo',
                    'media': f'attach://{attach_name}'
                }
                
                # Add caption to first photo if provided, or use screenshot's own caption
                if i == 0 and caption:
                    media_item['caption'] = caption
                    media_item['parse_mode'] = 'HTML'
                elif not caption:
                    media_item['caption'] = screenshot['caption']
                
                media_group.append(media_item)
            
            if not media_group:
                self.logger.warning("No valid screenshots found to send")
                return False
            
            data = {
                'chat_id': chat_id,
                'media': json.dumps(media_group)
            }
            
            self.logger.debug(f"Sending {len(media_group)} screenshots to chat ID: {chat_id}")
            response = requests.post(url, data=data, files=files, timeout=60)
            
            # Close all file handles
            for file_handle in files.values():
                file_handle.close()
            
            response.raise_for_status()
            
            result = response.json()
            if result.get('ok'):
                self.logger.debug(f"Telegram screenshots sent successfully to chat ID: {chat_id}")
                return True
            else:
                self.logger.error(f"Telegram API error for screenshots to chat ID {chat_id}: {result.get('description', 'Unknown error')}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error sending screenshots to chat ID {chat_id}: {str(e)}")
            # Ensure file handles are closed in case of error
            try:
                for file_handle in files.values():
                    file_handle.close()
            except:
                pass
            return False


class NotificationManger:
    """
    Factory class for creating notification manager instances
    Currently only Telegram is implemented
    """

    def __init__(self, notification_provider) -> None:
        self.notification_provider = notification_provider

        if notification_provider == "telegram":
            self.notification_manger = TelegramNotificationManger()
        elif notification_provider == "discord":
            # TODO: Implement Discord notification manager
            raise NotImplementedError("Discord notifications not implemented yet")
        elif notification_provider == "whatsapp":
            # TODO: Implement WhatsApp notification manager
            raise NotImplementedError("WhatsApp notifications not implemented yet")
        elif notification_provider == "teams":
            # TODO: Implement Teams notification manager
            raise NotImplementedError("Teams notifications not implemented yet")
        elif notification_provider == "email":
            # TODO: Implement Email notification manager
            raise NotImplementedError("Email notifications not implemented yet")
        else:
            raise ValueError(f"Unsupported notification provider: {notification_provider}")

    def send_message(self, feature_result):
        """
        Send notification message using the configured provider
        
        Args:
            feature_result: FeatureResult model instance
        
        Returns:
            bool: True if notification sent successfully, False otherwise
        """
        return self.notification_manger.send_message(feature_result)


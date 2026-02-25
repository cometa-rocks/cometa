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
from .variable_replacement import replace_feature_variables
from backend.models import Department
from backend.ee.modules.notification.models import FeatureTelegramOptions
from backend.models import Feature_result
from backend.utility.configurations import ConfigurationManager

from backend.utility.functions import getLogger

logger = getLogger()


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
    
    def __init__(self, pdf_generated):
        self.pdf_generated = pdf_generated
        self.feature_result:Feature_result = None
        
    def send_message(self, feature_result:Feature_result):
        """
        Send Telegram notification for a feature result
        
        Args:
            feature_result: FeatureResult model instance
        
        Returns:
            bool: True if notification sent successfully, False otherwise
        """
        self.feature_result = feature_result
        try:
            logger.info(f"Starting Telegram notification process for feature_result_id: {feature_result.feature_result_id}")
            
            # Check if Telegram notifications are enabled and get bot token
            telegram_enabled = ConfigurationManager.get_configuration('COMETA_TELEGRAM_ENABLED', False)
            global_bot_token = ConfigurationManager.get_configuration('COMETA_TELEGRAM_BOT_TOKEN', None)
            
            if not telegram_enabled:
                logger.warning(f"Telegram notifications globally disabled")
                return False
            
            # Check if there are any subscriptions for this feature
            from backend.ee.modules.notification.models import TelegramSubscription
            from backend.ee.modules.notification.managers import TelegramSubscriptionManager
            
            # Get active subscriptions and validate them
            subscriptions = TelegramSubscription.objects.filter(
                feature_id=feature_result.feature_id.feature_id,
                is_active=True
            )
            
            logger.info(f"Found {subscriptions.count()} active subscriptions for feature {feature_result.feature_id.feature_id}")
            
            # Validate each subscription before sending
            valid_subscriptions = []
            for subscription in subscriptions:
                if TelegramSubscriptionManager.validate_subscription(
                    subscription.user_id, 
                    subscription.feature_id
                ):
                    valid_subscriptions.append(subscription)
                    logger.debug(f"Subscription {subscription.id} is valid for user {subscription.user_id}")
                else:
                    # Deactivate invalid subscription
                    subscription.is_active = False
                    subscription.save()
                    logger.info(f"Deactivated invalid subscription {subscription.id}")
            
            subscriptions = valid_subscriptions
            logger.info(f"After validation: {len(subscriptions)} valid subscriptions")

            # Check if a custom notification payload was attached to the feature_result
            custom_payload = getattr(feature_result, 'custom_notification', None)
            
            # Check if this was executed from Telegram by looking for telegram notification data
            is_telegram_execution = False
            telegram_chat_id = None
            telegram_user_id = None
            
            # Check if feature_result has telegram notification data
            # This would be passed from runFeature through environment.py
            logger.debug(f"Checking for telegram_notification attribute on feature_result")
            logger.debug(f"Has telegram_notification attribute: {hasattr(feature_result, 'telegram_notification')}")
            if hasattr(feature_result, 'telegram_notification'):
                logger.debug(f"telegram_notification value: {getattr(feature_result, 'telegram_notification', None)}")
            
            if hasattr(feature_result, 'telegram_notification') and feature_result.telegram_notification:
                telegram_data = feature_result.telegram_notification
                if isinstance(telegram_data, dict):
                    telegram_chat_id = telegram_data.get('telegram_chat_id')
                    telegram_user_id = telegram_data.get('telegram_user_id')
                    if telegram_chat_id:
                        is_telegram_execution = True
                        logger.info(f"Found telegram execution for feature {feature_result.feature_id.feature_id}, user {telegram_user_id}, chat_id: {telegram_chat_id}")
            
            if not subscriptions and not is_telegram_execution and not custom_payload:
                # Fall back to old method - check if feature has Telegram notifications enabled
                feature_telegram_enabled = getattr(feature_result.feature_id, 'send_telegram_notification', False)
                logger.debug(f"No subscriptions found. Feature Telegram enabled setting: {feature_telegram_enabled}")
                if not feature_telegram_enabled:
                    logger.debug(f"Telegram notifications disabled for feature {feature_result.feature_id.feature_id}")
                    return False
            
            # Get telegram options for this feature (do NOT create with all False defaults)
            telegram_options = self._get_telegram_options(feature_result.feature_id.feature_id)
            
            # Check maximum notification logic (similar to email implementation)
            should_send_notification = True
            if not custom_payload:
                if telegram_options and telegram_options.check_maximum_notification_on_error_telegram:
                    logger.debug("Checking for maximum Telegram notifications on error")
                    
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
                elif telegram_options:
                    # Maximum notification check is disabled, reset counter
                    telegram_options.number_notification_sent_telegram = 0
                
                # Save telegram options to persist counter changes (if they exist)
                if telegram_options:
                    telegram_options.save()
                
                if not should_send_notification:
                    logger.info(f"Skipping Telegram notification due to maximum notification limit or configuration")
                    return True  # Return True because this is expected behavior, not an error
            
            # Check if custom Telegram settings are provided (from custom notification step)
            custom_bot_token = custom_payload.get('custom_bot_token') if custom_payload else None
            custom_chat_id = custom_payload.get('custom_chat_id') if custom_payload else None
            custom_thread_id = custom_payload.get('custom_thread_id') if custom_payload else None
            
            # Determine bot token and chat IDs based on custom settings, then override settings, then global
            if custom_bot_token or custom_chat_id:
                logger.debug("Using custom Telegram settings from notification step")
                
                # Use custom bot token if provided, otherwise fall back to global
                bot_token = custom_bot_token.strip() if custom_bot_token else global_bot_token
                if not bot_token:
                    logger.warning("No bot token available (neither custom nor global)")
                    return False
                
                # Use custom chat ID if provided
                if not custom_chat_id:
                    logger.warning("Custom Telegram settings provided but no custom chat ID specified")
                    return False
                
                # Parse custom chat ID (can be single or comma-separated)
                chat_ids = [chat_id.strip() for chat_id in str(custom_chat_id).split(',') if str(chat_id).strip()]
                if not chat_ids:
                    logger.warning("No valid custom Telegram chat IDs found")
                    return False
                
                logger.debug(f"Using custom chat IDs: {chat_ids}")
                
                # Use custom thread ID if provided
                message_thread_id = int(custom_thread_id) if custom_thread_id else None
                logger.debug(f"Custom message thread ID: {message_thread_id}")
                
            elif telegram_options and telegram_options.override_telegram_settings:
                logger.debug("Using override Telegram settings for this feature")
                
                # Use override bot token if provided, otherwise fall back to global
                bot_token = telegram_options.override_bot_token.strip() if telegram_options.override_bot_token else global_bot_token
                if not bot_token:
                    logger.warning("No bot token available (neither override nor global)")
                    return False
                
                # Use override chat IDs if provided
                override_chat_ids = telegram_options.override_chat_ids.strip() if telegram_options.override_chat_ids else ''
                if not override_chat_ids:
                    logger.warning("Override Telegram settings enabled but no override chat IDs provided")
                    return False
                
                # Parse override chat IDs
                chat_ids = [chat_id.strip() for chat_id in override_chat_ids.split(',') if chat_id.strip()]
                if not chat_ids:
                    logger.warning("No valid override Telegram chat IDs found")
                    return False
                
                logger.debug(f"Using override chat IDs: {chat_ids}")
                
                # Store thread ID for later use (can be None)
                message_thread_id = telegram_options.override_message_thread_id
                logger.debug(f"Message thread ID: {message_thread_id}")
                
            else:
                logger.debug("Using global Telegram settings")
                
                # Use global bot token
                bot_token = global_bot_token
                if not bot_token:
                    logger.warning("Global bot token not configured")
                    return False
                
                # Get chat IDs from subscriptions or telegram execution
                if is_telegram_execution and telegram_chat_id:
                    # For telegram executions, always send to the chat that initiated it
                    logger.info(f"Using Telegram execution chat_id: {telegram_chat_id}")
                    chat_ids = [telegram_chat_id]
                elif subscriptions:
                    # Filter subscriptions based on notification type and result
                    if feature_result.success:
                        # For successful tests, only get subscriptions that include 'on_success'
                        filtered_subscriptions = [
                            sub for sub in subscriptions 
                            if 'on_success' in sub.notification_types
                        ]
                    else:
                        # For failed tests, only get subscriptions that include 'on_failure'
                        filtered_subscriptions = [
                            sub for sub in subscriptions 
                            if 'on_failure' in sub.notification_types
                        ]
                    
                    # Use subscription-based chat IDs
                    logger.debug("Using subscription-based chat IDs with notification type filtering")
                    chat_ids = [sub.chat_id for sub in filtered_subscriptions]
                    logger.debug(f"Found {len(chat_ids)} subscribed chat IDs after filtering: {chat_ids}")
                else:
                    # Fall back to department chat IDs (old method)
                    logger.debug("No subscriptions found, falling back to department chat IDs")
                    try:
                        department = Department.objects.get(department_id=feature_result.feature_id.department_id)
                        department_settings = department.settings or {}
                        department_chat_ids = department_settings.get('telegram_chat_ids', '')
                        logger.debug(f"Department chat IDs: {department_chat_ids}")
                    except Department.DoesNotExist:
                        logger.warning(f"Department {feature_result.feature_id.department_id} not found")
                        return False
                    
                    if not department_chat_ids or not department_chat_ids.strip():
                        logger.warning(f"No Telegram chat IDs configured for department {feature_result.department_name}")
                        return False
                    
                    # Parse chat IDs
                    chat_ids = [chat_id.strip() for chat_id in department_chat_ids.split(',') if chat_id.strip()]
                    if not chat_ids:
                        logger.warning("No valid Telegram chat IDs found")
                        return False
                
                # No thread ID for department-level chats
                message_thread_id = None
            
            logger.info(f"Found {len(chat_ids)} chat IDs to send notifications to")
            
            # Build message based on feature telegram settings and options
            feature_telegram_enabled = getattr(feature_result.feature_id, 'send_telegram_notification', False)
            parse_mode = 'Markdown'
            include_pdf = False
            include_screenshots = False
            
            if custom_payload:
                message = custom_payload.get('message', '')
                parse_mode = custom_payload.get('parse_mode', None)
                include_pdf = custom_payload.get('attach_pdf', False)
                include_screenshots = custom_payload.get('attach_screenshots', False)
                logger.debug("Using custom notification payload for Telegram message")
            else:
                if telegram_options and feature_telegram_enabled:
                    # Feature has telegram enabled AND has options - use configured message
                    logger.debug("Feature has telegram enabled, building message using FeatureTelegramOptions configuration")
                    message = self._build_message(feature_result, telegram_options)
                else:
                    # Either no options exist OR telegram is disabled for the feature - use default message
                    logger.debug(f"Using default message (telegram_enabled={feature_telegram_enabled}, has_options={telegram_options is not None})")
                    message = self._build_subscription_default_message(feature_result)
                include_pdf = telegram_options.attach_pdf_report if telegram_options else False
                include_screenshots = telegram_options.attach_screenshots if telegram_options else False
                logger.debug("Message built successfully")
            
            logger.debug("Message prepared for Telegram notification")
            
            # Check if message should be sent (could be None if send_on_error is true and test passed)
            if message is None:
                logger.info("Message was None, skipping notification")
                return True
            
            # Try to get PDF report if feature has PDF attachment enabled
            pdf_file_path = None
            screenshot_files = []
            try:
                # Check PDF attachment setting from the already fetched telegram_options
                if include_pdf:
                    pdf_file_path = self._get_pdf_report()
                    if pdf_file_path:
                        logger.debug(f"PDF report obtained: {pdf_file_path}")
                    else:
                        logger.debug("No PDF report obtained, will send text-only message")
                else:
                    logger.debug("PDF attachment disabled in telegram options")
                
                # Try to get screenshots if feature has screenshot attachment enabled
                if include_screenshots:
                    screenshot_files = self._get_screenshots(feature_result.feature_result_id)
                    if screenshot_files:
                        logger.debug(f"Screenshots obtained: {len(screenshot_files)} files")
                    else:
                        logger.debug("No screenshots obtained")
                else:
                    logger.debug("Screenshot attachment disabled in telegram options")
            except Exception as e:
                logger.warning(f"Failed to generate/get PDF report or screenshots: {str(e)}")
            
            # Send to all chat IDs
            success_count = 0
            for chat_id in chat_ids:
                logger.debug(f"Sending notification to chat ID: {chat_id}")
                
                # Determine what to send based on available attachments
                has_pdf = pdf_file_path and os.path.exists(pdf_file_path)
                has_screenshots = len(screenshot_files) > 0
                
                if has_pdf and has_screenshots:
                    # Send message first, then PDF with simple caption, then screenshots
                    message_success = self._send_message_to_chat(bot_token, chat_id, message, message_thread_id, parse_mode=parse_mode)
                    pdf_caption = f"📄 Test Report - {feature_result.feature_name}"
                    pdf_success = self._send_document_to_chat(bot_token, chat_id, pdf_caption, pdf_file_path, message_thread_id)
                    screenshot_success = self._send_screenshots_as_media_group(bot_token, chat_id, screenshot_files, "📸 Test Screenshots", message_thread_id)
                    if message_success and pdf_success and screenshot_success:
                        success_count += 1
                        logger.debug(f"Successfully sent message, PDF and screenshots to chat ID: {chat_id}")
                    else:
                        logger.error(f"Failed to send some components to chat ID: {chat_id}")
                elif has_pdf:
                    # Send message first, then PDF with simple caption
                    message_success = self._send_message_to_chat(bot_token, chat_id, message, message_thread_id, parse_mode=parse_mode)
                    pdf_caption = f"📄 Test Report - {feature_result.feature_name}"
                    pdf_success = self._send_document_to_chat(bot_token, chat_id, pdf_caption, pdf_file_path, message_thread_id)
                    if message_success and pdf_success:
                        success_count += 1
                        logger.debug(f"Successfully sent message and PDF to chat ID: {chat_id}")
                    else:
                        logger.error(f"Failed to send message and/or PDF to chat ID: {chat_id}")
                elif has_screenshots:
                    # Send screenshots as media group with truncated caption
                    # Truncate message to fit Telegram's 1024 character caption limit
                    caption = message[:1000] + "..." if len(message) > 1000 else message
                    if self._send_screenshots_as_media_group(bot_token, chat_id, screenshot_files, caption, message_thread_id):
                        success_count += 1
                        logger.debug(f"Successfully sent screenshots to chat ID: {chat_id}")
                    else:
                        logger.error(f"Failed to send screenshots to chat ID: {chat_id}")
                else:
                    # Send text-only message
                    if self._send_message_to_chat(bot_token, chat_id, message, message_thread_id, parse_mode=parse_mode):
                        success_count += 1
                        logger.debug(f"Successfully sent message to chat ID: {chat_id}")
                    else:
                        logger.error(f"Failed to send message to chat ID: {chat_id}")
            
            # Clean up temporary files
            if pdf_file_path and os.path.exists(pdf_file_path) and '/tmp/' in pdf_file_path:
                try:
                    os.remove(pdf_file_path)
                    logger.debug(f"Cleaned up temporary PDF file: {pdf_file_path}")
                except Exception as e:
                    logger.warning(f"Failed to clean up temporary PDF file: {str(e)}")
            
            for screenshot_file in screenshot_files:
                if os.path.exists(screenshot_file['path']) and '/tmp/' in screenshot_file['path']:
                    try:
                        os.remove(screenshot_file['path'])
                        logger.debug(f"Cleaned up temporary screenshot file: {screenshot_file['path']}")
                    except Exception as e:
                        logger.warning(f"Failed to clean up temporary screenshot file: {str(e)}")
            
            final_success = success_count == len(chat_ids)
            logger.info(f"Telegram notification process completed. Success: {final_success} ({success_count}/{len(chat_ids)} sent)")
            return final_success
            
        except Exception as e:
            logger.error(f"Error sending Telegram notification: {str(e)}")
            return False
    
    def _get_telegram_options(self, feature_id):
        """
        Get telegram options for a feature without creating defaults
        
        Args:
            feature_id: The feature ID
            
        Returns:
            FeatureTelegramOptions instance or None if not found
        """
        try:
            return FeatureTelegramOptions.objects.get(feature_id=feature_id)
        except FeatureTelegramOptions.DoesNotExist:
            logger.debug(f"No FeatureTelegramOptions found for feature {feature_id}")
            return None
    
    def _extract_common_feature_data(self, feature_result):
        """
        Extract commonly used data to avoid repetition across message builders
        
        Args:
            feature_result: The feature result object
            
        Returns:
            dict: Common data used in message building
        """
        # Status information
        data = {
            'status_emoji': "✅" if feature_result.success else "❌",
            'status_text': "PASSED" if feature_result.success else "FAILED",
            'success': feature_result.success
        }
        
        # Feature URL
        DOMAIN = ConfigurationManager.get_configuration('COMETA_DOMAIN', '')
        if DOMAIN:
            data['feature_url'] = f"https://{DOMAIN}/#/{feature_result.department_name}/{feature_result.app_name}/{feature_result.feature_id.feature_id}"
        else:
            data['feature_url'] = None
        
        # Browser information
        data['browser_info'] = None
        if hasattr(feature_result, 'browser') and feature_result.browser:
            browser_info = feature_result.browser
            if isinstance(browser_info, dict):
                data['browser_info'] = {
                    'name': browser_info.get('browser', 'Unknown'),
                    'version': browser_info.get('browser_version', 'Unknown'),
                    'os': browser_info.get('os', 'Unknown OS'),
                    'os_version': browser_info.get('os_version', ''),
                    'timezone': browser_info.get('selectedTimeZone', 'UTC')
                }
        
        return data
    
    def _build_telegram_execution_message(self, feature_result):
        """
        Build a simple completion message for features executed from Telegram
        Note: Consider using _build_subscription_default_message() instead for consistency
        """
        try:
            # Extract common data
            common_data = self._extract_common_feature_data(feature_result)
            status_text = "Completed Successfully" if common_data['success'] else "Failed"
            
            message_parts = [
                f"{common_data['status_emoji']} *Test Run {status_text}*",
                "",
                f"*Feature:* {feature_result.feature_name}",
                f"*ID:* {feature_result.feature_id.feature_id}",
                f"*Result ID:* {feature_result.feature_result_id}",
                f"*Finished at:* {feature_result.end_date.strftime('%Y-%m-%d %H:%M:%S UTC') if feature_result.end_date else 'Unknown'}",
                "",
                f"*Test Results:*",
                f"• Total: {feature_result.total}",
                f"• Passed: {feature_result.ok} ✅",
                f"• Failed: {feature_result.fails} ❌",
                f"• Skipped: {feature_result.skipped} ⏭️",
            ]
            
            # Add browser information
            if common_data['browser_info']:
                browser_display = f"{common_data['browser_info']['name']} {common_data['browser_info']['version']}"
                message_parts.append(f"• Browser: {browser_display}")
            
            # Add execution time if available
            if feature_result.execution_time:
                message_parts.append(f"• Duration: {feature_result.execution_time} seconds")
            
            # Add link to view full results
            if common_data['feature_url']:
                message_parts.extend(["", f"🔗 [View Detailed Results]({common_data['feature_url']})"])
            
            return "\n".join(message_parts)
            
        except Exception as e:
            logger.error(f"Error building telegram execution message: {str(e)}")
            # Fallback to very basic message
            common_data = self._extract_common_feature_data(feature_result)
            return f"{common_data['status_emoji']} Test Complete: {feature_result.feature_name} - {common_data['status_text']}"
    
    def _build_subscription_default_message(self, feature_result):
        """
        Build a default message for subscription-based notifications
        Provides essential information without requiring customization
        """
        try:
            # Extract common data
            common_data = self._extract_common_feature_data(feature_result)
            
            # Escape special Markdown characters in text fields
            def escape_markdown(text):
                if not text:
                    return ""
                return str(text).replace('*', '\\*').replace('_', '\\_').replace('`', '\\`').replace('[', '\\[').replace(']', '\\]')
            
            message_parts = [
                f"{common_data['status_emoji']} *Test Execution Complete*",
                "",
                f"🧪 *Feature:* {escape_markdown(feature_result.feature_name)} (ID: {feature_result.feature_id.feature_id})",
                f"🏢 *Department:* {escape_markdown(feature_result.department_name)}",
                f"📱 *Application:* {escape_markdown(feature_result.app_name)}",
                f"🌍 *Environment:* {escape_markdown(feature_result.environment_name)}",
            ]
            
            # Add browser information if available
            if common_data['browser_info']:
                browser_display = f"{common_data['browser_info']['name']} {common_data['browser_info']['version']}"
                message_parts.append(f"🌐 *Browser:* {escape_markdown(browser_display)}")
            
            message_parts.extend([
                "",
                f"📊 *Results:*",
                f"• Total Steps: {feature_result.total}",
                f"• Passed: {feature_result.ok}",
                f"• Failed: {feature_result.fails}",
                f"• Skipped: {feature_result.skipped}",
                "",
                f"🎯 *Status:* {common_data['status_text']}",
            ])
            
            # Add failed step details if test failed
            if not feature_result.success and feature_result.fails > 0:
                failed_steps = self._get_failed_steps(feature_result.feature_result_id)
                if failed_steps and len(failed_steps) <= 3:  # Show up to 3 failed steps
                    message_parts.extend(["", "❌ *Failed Steps:*"])
                    for i, step in enumerate(failed_steps[:3], 1):
                        # Escape special Markdown characters in step name
                        step_name = step['name'].replace('*', '\\*').replace('_', '\\_').replace('`', '\\`').replace('[', '\\[').replace(']', '\\]')
                        message_parts.append(f"{i}. Step {step['sequence']}: {step_name}")
            
            # Add link to view full results
            if common_data['feature_url']:
                message_parts.extend(["", f"🔗 [View Full Results]({common_data['feature_url']})"])
            
            return "\n".join(message_parts)
            
        except Exception as e:
            logger.error(f"Error building subscription default message: {str(e)}")
            # Fallback to very basic message
            status_emoji = "✅" if feature_result.success else "❌"
            return f"{status_emoji} Test Complete: {feature_result.feature_name} - {'PASSED' if feature_result.success else 'FAILED'}"
    
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
            logger.debug(f"Using telegram options for feature {feature_result.feature_id.feature_id}")
            
            # Extract common data early
            common_data = self._extract_common_feature_data(feature_result)
            
            # Check if we should send notification based on error setting
            if telegram_options.send_on_error and feature_result.success:
                logger.debug("Telegram configured for error-only and test passed, skipping notification")
                return None
            
            # Check if we should only send custom message (no default template)
            if telegram_options.do_not_use_default_template:
                logger.debug("Using custom message only (default template disabled)")
                if telegram_options.custom_message and telegram_options.custom_message.strip():
                    try:
                        # Replace variables in custom message (use_html_breaks=False for Telegram)
                        processed_custom_message = replace_feature_variables(
                            telegram_options.custom_message.strip(), 
                            feature_result, 
                            use_html_breaks=False
                        )
                        logger.debug("Custom-only message processed with variable replacement")
                        return processed_custom_message
                    except Exception as e:
                        logger.error(f"Error processing custom message variables: {e}")
                        # Fallback to original message without variable replacement
                        return telegram_options.custom_message.strip()
                else:
                    logger.warning("Default template disabled but no custom message provided")
                    return None
            
            # Build the message with proper formatting
            message_parts = []
            
            # Add custom message if provided (with variable replacement)
            if telegram_options.custom_message and telegram_options.custom_message.strip():
                try:
                    # Replace variables in custom message (use_html_breaks=False for Telegram)
                    processed_custom_message = replace_feature_variables(
                        telegram_options.custom_message.strip(), 
                        feature_result, 
                        use_html_breaks=False
                    )
                    message_parts.append(f"📝 Custom Message:\n{processed_custom_message}")
                    message_parts.append("")  # Add blank line after custom message
                    logger.debug("Custom message processed with variable replacement")
                except Exception as e:
                    logger.error(f"Error processing custom message variables: {e}")
                    # Fallback to original message without variable replacement
                    message_parts.append(f"📝 Custom Message:\n{telegram_options.custom_message.strip()}")
                    message_parts.append("")  # Add blank line after custom message
            
            # Status line with emoji
            message_parts.append(f"{common_data['status_emoji']} Test Execution Complete")
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
            
            # Add feature URL (only if enabled)
            if telegram_options.include_feature_url and common_data['feature_url']:
                basic_info_parts.append(f"🔗 Open in Co.meta: {common_data['feature_url']}")
            
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
                
                # Add browser selected timezone
                browser_timezone = common_data['browser_info']['timezone'] if common_data['browser_info'] else 'UTC'
                
                # Only add browser timezone if it's different from UTC
                if browser_timezone != 'UTC':
                    try:
                        browser_tz = ZoneInfo(browser_timezone)
                        browser_time = utc_time.astimezone(browser_tz)
                        browser_formatted = browser_time.strftime(f"%Y-%m-%d %H:%M:%S {browser_timezone}")
                        message_parts.append(browser_formatted)
                    except Exception as e:
                        logger.warning(f"Invalid browser timezone '{browser_timezone}': {e}")
                        # Fallback to showing the timezone name even if we can't format it
                        message_parts.append(f"Browser timezone: {browser_timezone}")
                
                message_parts.append("")  # Add blank line after datetime
            
            # Browser information section
            if telegram_options.include_browser_timezone or telegram_options.include_browser:
                message_parts.append("🌐 Browser Details:")
                
                if telegram_options.include_browser and common_data['browser_info']:
                    # Format browser display name (e.g., "Chrome 136", "Edge 135")
                    browser_display = f"{common_data['browser_info']['name']} {common_data['browser_info']['version']}"
                    if common_data['browser_info']['os'] != 'Unknown OS':
                        if common_data['browser_info']['os_version']:
                            browser_display += f" on {common_data['browser_info']['os']} {common_data['browser_info']['os_version']}"
                        else:
                            browser_display += f" on {common_data['browser_info']['os']}"
                    
                    message_parts.append(f"• Browser: {browser_display}")
                
                if telegram_options.include_browser_timezone and common_data['browser_info']:
                    browser_timezone = common_data['browser_info']['timezone']
                    message_parts.append(f"• Timezone: {browser_timezone}")
                
                message_parts.append("")  # Add blank line after browser details
            
            # Test Results section
            if telegram_options.include_step_results or telegram_options.include_overall_status:
                if telegram_options.include_step_results:
                    message_parts.append("📊 Results:")
                    message_parts.append(f"• Total Steps: {self._format_number(feature_result.total)}")
                    message_parts.append(f"• Passed: {self._format_number(feature_result.ok)}")
                    message_parts.append(f"• Failed: {self._format_number(feature_result.fails)}")
                    message_parts.append(f"• Skipped: {self._format_number(feature_result.skipped)}")
                    message_parts.append("")  # Add blank line after results
            
            # Failed Steps Details section (show when test failed and explicitly enabled)
            if not feature_result.success and telegram_options.include_failed_step_details and feature_result.fails > 0:
                failed_steps = self._get_failed_steps(feature_result.feature_result_id)
                if failed_steps:
                    message_parts.append("❌ Failed Steps:")
                    for i, failed_step in enumerate(failed_steps, 1):
                        step_info = f"{i}. Step {failed_step['sequence']}: {failed_step['name']}"
                        if len(step_info) > 80:  # Truncate long step names
                            step_info = step_info[:77] + "..."
                        message_parts.append(step_info)
                        
                        if failed_step['error']:
                            # Truncate long error messages and clean them up
                            error_msg = failed_step['error'].strip()
                            if len(error_msg) > 200:
                                error_msg = error_msg[:197] + "..."
                            # Remove multiple whitespaces and newlines for cleaner display
                            error_msg = ' '.join(error_msg.split())
                            message_parts.append(f"   💬 {error_msg}")
                        
                        # Add spacing between failed steps (but not after the last one)
                        if i < len(failed_steps):
                            message_parts.append("")
                    
                    message_parts.append("")  # Add blank line after failed steps
            
            # Final details section (pixel diff, execution time, overall status)
            final_details = []
            if telegram_options.include_pixel_diff:
                pixel_diff_formatted = self._format_number(feature_result.pixel_diff) if feature_result.pixel_diff else "0"
                final_details.append(f"🖼️ Pixel Difference: {pixel_diff_formatted}")
            
            if telegram_options.include_execution_time:
                execution_time_str = f"{self._format_number(feature_result.execution_time)}ms" if feature_result.execution_time else "N/A"
                final_details.append(f"⏱️ Execution Time: {execution_time_str}")
            
            if telegram_options.include_overall_status:
                final_details.append(f"🎯 Overall Status: {common_data['status_text']}")
            
            if final_details:
                message_parts.extend(final_details)
            
            # Join all parts with newlines
            message = "\n".join(message_parts)
            return message
            
        except Exception as e:
            logger.error(f"Error building Telegram message: {str(e)}")
            # Fallback to basic message
            common_data = self._extract_common_feature_data(feature_result)
            return f"{common_data['status_emoji']} *Test Execution Complete*\n\n🧪 *Feature:* {feature_result.feature_name}\n🎯 *Status:* {common_data['status_text']}"

    def _get_pdf_report(self):
        """
        Get the PDF report for a feature result
        
        Args:
            feature_result_id (int): The feature result ID
        
        Returns:
            str: Path to the PDF file, or None if failed
        """
        
        if self.pdf_generated:
            logger.debug("PDF is already generated will skip generating again")
            return os.path.join("/code/behave/pdf",self.feature_result.pdf_result_file_path)
        
        try:
            # Request PDF generation/retrieval from the backend
            pdf_url = f'{get_cometa_backend_url()}/pdf/?feature_result_id={self.feature_result.feature_result_id}&download=true'
            headers = {'Host': 'cometa.local'}
            
            logger.debug(f"Requesting PDF from: {pdf_url}")
            response = requests.get(pdf_url, headers=headers, timeout=60)
            
            if response.status_code == 200:
                # Create a temporary file to store the PDF
                with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf', prefix=f'cometa_report_{self.feature_result.feature_result_id}_') as temp_file:
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

    def _get_failed_steps(self, feature_result_id):
        """
        Get information about failed steps for a feature result
        
        Args:
            feature_result_id (int): The feature result ID
        
        Returns:
            list: List of failed step dictionaries with 'sequence', 'name', and 'error' keys
        """
        try:
            from backend.models import Step_result
            
            # Get all failed step results for this feature result
            failed_step_results = Step_result.objects.filter(
                feature_result_id=feature_result_id,
                success=False
            ).order_by('step_execution_sequence')
            
            logger.debug(f"Found {failed_step_results.count()} failed steps for feature_result_id: {feature_result_id}")
            
            failed_steps = []
            for step_result in failed_step_results:
                failed_step = {
                    'sequence': step_result.step_execution_sequence,
                    'name': step_result.step_name or 'Unnamed Step',
                    'error': step_result.error or 'No error message available'
                }
                failed_steps.append(failed_step)
            
            return failed_steps
            
        except Exception as e:
            logger.error(f"Error getting failed steps: {str(e)}")
            return []

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
            
            logger.debug(f"Found {step_results.count()} step results with screenshots")
            
            screenshots = []
            screenshot_count = 0
            max_screenshots = 10  # Telegram media group limit
            
            for step_result in step_results:
                if screenshot_count >= max_screenshots:
                    logger.debug(f"Reached maximum screenshot limit of {max_screenshots}")
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
                        logger.debug(f"Added current screenshot: {screenshot_path}")
                    else:
                        logger.warning(f"Screenshot file not found: {screenshot_path}")
                
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
                        logger.debug(f"Added style screenshot: {style_path}")
                
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
                        logger.debug(f"Added difference screenshot: {diff_path}")
            
            logger.info(f"Retrieved {len(screenshots)} screenshots for feature_result_id: {feature_result_id}")
            return screenshots
            
        except Exception as e:
            logger.error(f"Error getting screenshots: {str(e)}")
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

    def _send_document_to_chat(self, bot_token, chat_id, caption, document_path, message_thread_id=None):
        """
        Send a document (PDF) to a specific Telegram chat with caption
        
        Args:
            bot_token (str): Telegram bot token
            chat_id (str): Telegram chat ID
            caption (str): Caption/message to send with the document
            document_path (str): Path to the document file
            message_thread_id (int, optional): Thread ID for group chats with topics
        
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
                
                # Add message thread ID if provided
                if message_thread_id is not None:
                    data['message_thread_id'] = message_thread_id
                
                response = requests.post(url, data=data, files=files, timeout=30)
                
                # Parse JSON response first to get actual Telegram error details
                try:
                    result = response.json()
                except json.JSONDecodeError:
                    result = None
                
                if response.status_code == 200 and result and result.get('ok'):
                    logger.debug(f"Telegram document sent successfully to chat ID: {chat_id}")
                    return True
                else:
                    # Log detailed error information
                    if result:
                        error_description = result.get('description', 'Unknown error')
                        error_code = result.get('error_code', 'Unknown code')
                        logger.error(f"Telegram API error for document to chat ID {chat_id}: {error_description} (Error code: {error_code}) | HTTP Status: {response.status_code}")
                    else:
                        logger.error(f"Telegram API error for document to chat ID {chat_id}: HTTP {response.status_code} - {response.text[:200]}")
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

    def _send_message_to_chat(self, bot_token, chat_id, message, message_thread_id=None, parse_mode='Markdown'):
        """
        Send a message to a specific Telegram chat
        
        Args:
            bot_token (str): Telegram bot token
            chat_id (str): Telegram chat ID
            message (str): Message to send
            message_thread_id (int, optional): Thread ID for group chats with topics
            parse_mode (str, optional): Telegram parse mode ('Markdown', 'HTML', or None)
        
        Returns:
            bool: True if message sent successfully, False otherwise
        """
        
        url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
        
        payload = {
            'chat_id': chat_id,
            'text': message,
        }
        if parse_mode:
            payload['parse_mode'] = parse_mode

        # Add message thread ID if provided
        if message_thread_id is not None:
            payload['message_thread_id'] = message_thread_id
        
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
            # Try to get error details from response
            try:
                error_data = e.response.json()
                logger.error(f"Telegram API error details: {error_data}")
            except:
                try:
                    logger.error(f"Response text: {e.response.text}")
                except:
                    pass
            return False
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error for Telegram response (chat ID {chat_id}): {str(e)}")
            return False
        except Exception as e:
            logger.error(f"Unexpected error sending Telegram message to chat ID {chat_id}: {str(e)}")
            return False

    def _send_screenshots_as_media_group(self, bot_token, chat_id, screenshots, caption=None, message_thread_id=None):
        """
        Send multiple screenshots as a media group to a specific Telegram chat
        
        Args:
            bot_token (str): Telegram bot token
            chat_id (str): Telegram chat ID
            screenshots (list): List of screenshot dictionaries with 'path' and 'caption' keys
            caption (str): Optional caption for the media group
            message_thread_id (int, optional): Thread ID for group chats with topics
        
        Returns:
            bool: True if screenshots sent successfully, False otherwise
        """
        url = f"https://api.telegram.org/bot{bot_token}/sendMediaGroup"
        
        try:
            if not screenshots:
                logger.warning("No screenshots provided to send")
                return False
            
            # Limit to 10 photos (Telegram's limit for media groups)
            screenshots = screenshots[:10]
            
            media_group = []
            files = {}
            
            for i, screenshot in enumerate(screenshots):
                if not os.path.exists(screenshot['path']):
                    logger.warning(f"Screenshot file not found: {screenshot['path']}")
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
                logger.warning("No valid screenshots found to send")
                return False
            
            data = {
                'chat_id': chat_id,
                'media': json.dumps(media_group)
            }
            
            # Add message thread ID if provided
            if message_thread_id is not None:
                data['message_thread_id'] = message_thread_id
            
            logger.debug(f"Sending {len(media_group)} screenshots to chat ID: {chat_id}")
            response = requests.post(url, data=data, files=files, timeout=60)
            
            # Close all file handles
            for file_handle in files.values():
                file_handle.close()
            
            response.raise_for_status()
            
            result = response.json()
            if result.get('ok'):
                logger.debug(f"Telegram screenshots sent successfully to chat ID: {chat_id}")
                return True
            else:
                logger.error(f"Telegram API error for screenshots to chat ID {chat_id}: {result.get('description', 'Unknown error')}")
                return False
                
        except Exception as e:
            logger.error(f"Error sending screenshots to chat ID {chat_id}: {str(e)}")
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

    def __init__(self, notification_provider, pdf_generated) -> None:
        self.notification_provider = notification_provider

        if notification_provider == "telegram":
            self.notification_manger = TelegramNotificationManger(pdf_generated)
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

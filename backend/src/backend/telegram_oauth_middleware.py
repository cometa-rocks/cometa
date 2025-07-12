"""
Middleware to handle Telegram OAuth completion after Apache mod_auth_openidc authentication.

This middleware checks if a user has just completed OAuth authentication and has a pending
Telegram authentication request. If so, it completes the Telegram linking process.
"""
import logging
from django.shortcuts import redirect
from django.utils.deprecation import MiddlewareMixin
from backend.ee.modules.notification.models import TelegramUserLink
from backend.telegram_auth import TelegramAuthenticationHandler
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


class TelegramOAuthCompletionMiddleware(MiddlewareMixin):
    """
    Middleware to complete Telegram authentication after OAuth login.
    
    This works around the limitation of Apache mod_auth_openidc not preserving
    the target_link_uri parameter through the OAuth flow.
    """
    
    def process_request(self, request):
        """
        Check if user just completed OAuth and has pending Telegram auth.
        """
        # Only process for authenticated users
        if not request.session.get('user'):
            return None
            
        # Skip if already processed in this session
        if request.session.get('telegram_oauth_checked'):
            return None
            
        # Skip non-GET requests and specific paths
        if request.method != 'GET':
            return None
            
        # Skip if this is an API or static resource request
        if any(request.path.startswith(p) for p in ['/api/', '/static/', '/media/', '/health', '/telegram/']):
            return None
            
        # Mark as checked for this session
        request.session['telegram_oauth_checked'] = True
        request.session.save()
        
        try:
            user_id = request.session['user'].get('user_id')
            if not user_id:
                return None
                
            # Check for pending Telegram authentication for this user
            # Look for links created in the last 10 minutes that are not verified
            recent_time = timezone.now() - timedelta(minutes=10)
            pending_link = TelegramUserLink.objects.filter(
                user_id=0,  # Pending links have user_id=0
                is_verified=False,
                is_active=True,
                auth_token__isnull=False,
                auth_token_expires__gte=timezone.now(),
                created_on__gte=recent_time
            ).order_by('-created_on').first()
            
            if pending_link:
                logger.info(f"Found pending Telegram auth for user {user_id}, chat_id: {pending_link.chat_id}")
                
                # Complete the Telegram linking
                try:
                    # Update the link with the authenticated user
                    pending_link.user_id = user_id
                    pending_link.is_verified = True
                    
                    # Get user info from session
                    user_info = request.session.get('user_info', {})
                    if user_info:
                        # For GitLab OAuth
                        pending_link.gitlab_username = user_info.get('preferred_username', '')
                        pending_link.gitlab_email = user_info.get('email', '')
                        pending_link.gitlab_name = user_info.get('name', '')
                    
                    # Clear the auth token for security
                    pending_link.auth_token = None
                    pending_link.auth_token_expires = None
                    pending_link.save()
                    
                    # Send success notification to Telegram
                    self._send_telegram_notification(
                        pending_link.chat_id,
                        user_info.get('name', 'User'),
                        user_info.get('email', '')
                    )
                    
                    logger.info(f"Successfully linked Telegram chat {pending_link.chat_id} to user {user_id}")
                    
                    # Redirect to success page with message
                    request.session['telegram_link_success'] = True
                    return redirect('/telegram/success/')
                    
                except Exception as e:
                    logger.error(f"Error completing Telegram link: {str(e)}")
                    
        except Exception as e:
            logger.error(f"Error in TelegramOAuthCompletionMiddleware: {str(e)}")
            
        return None
    
    def _send_telegram_notification(self, chat_id, user_name, user_email):
        """Send success notification to Telegram."""
        try:
            from backend.utility.configurations import ConfigurationManager
            import requests
            
            bot_token = ConfigurationManager.get_configuration("COMETA_TELEGRAM_BOT_TOKEN", None)
            if not bot_token:
                logger.warning("Telegram bot token not configured")
                return
                
            message = (
                f"✅ *Authentication Successful!*\n\n"
                f"Your Telegram account has been successfully linked to Cometa.\n\n"
                f"**Account Details:**\n"
                f"👤 Name: {user_name}\n"
                f"📧 Email: {user_email}\n\n"
                f"You can now receive test execution notifications!\n"
                f"Use `/subscribe` to select which features to monitor."
            )
            
            url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
            payload = {
                "chat_id": chat_id,
                "text": message,
                "parse_mode": "Markdown"
            }
            
            response = requests.post(url, json=payload, timeout=10)
            if not response.ok:
                logger.error(f"Failed to send Telegram notification: {response.text}")
                
        except Exception as e:
            logger.error(f"Error sending Telegram notification: {str(e)}")
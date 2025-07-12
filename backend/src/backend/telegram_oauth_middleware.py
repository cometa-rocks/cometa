"""
Middleware to handle Telegram OAuth completion after Apache mod_auth_openidc authentication.

This middleware checks if a user has just completed OAuth authentication and has a pending
Telegram authentication request. If so, it completes the Telegram linking process.
"""
import logging
from django.shortcuts import redirect
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


class TelegramOAuthCompletionMiddleware:
    """
    Middleware to complete Telegram authentication after OAuth login.
    
    This works around the limitation of Apache mod_auth_openidc not preserving
    the target_link_uri parameter through the OAuth flow.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        """
        Check if user just completed OAuth and has pending Telegram auth.
        """
        
        # Check for authenticated users only
        if not request.session.get('user'):
            
            # Process the response first
            response = self.get_response(request)
            
            # Check for pending Telegram auth after OAuth completion
            if request.session.get('user'):
                # Check URL for telegram token (development mode)
                telegram_token = request.GET.get('telegram_token')
                if telegram_token:
                    self._process_telegram_link_with_token(request, telegram_token)
                else:
                    # Check for pending auth (production mode)
                    self._check_pending_telegram_auth(request)
                
                # Show success page if link completed
                if request.path == '/' and request.session.get('telegram_link_completed'):
                    from django.shortcuts import render
                    return render(request, 'telegram_oauth_complete.html')
                
            return response
            
        # Skip if already processed in this session
        if request.session.get('telegram_oauth_checked'):
            return self.get_response(request)
            
        # Skip non-GET requests and specific paths
        if request.method != 'GET':
            return self.get_response(request)
            
        # Skip if this is an API or static resource request
        # Also skip if this is an AJAX request or Angular API call
        # Always skip /auth/telegram/ paths - they have their own handler
        if request.path.startswith('/auth/telegram/'):
            return self.get_response(request)
            
        # Don't skip /addoidcaccount/ and /api/browsers/ for telegram auth processing
        if request.path in ['/addoidcaccount/', '/backend/addoidcaccount/', '/api/browsers/']:
            # Allow these specific paths to be processed
            pass
        elif any(request.path.startswith(p) for p in ['/api/', '/static/', '/media/', '/health', '/telegram/', '/debug/', '/callback', '/backend/']):
            return self.get_response(request)
            
        # Skip AJAX requests
        if request.META.get('HTTP_X_REQUESTED_WITH') == 'XMLHttpRequest':
            return self.get_response(request)
            
        # Process authenticated request
        logger.debug(f"Processing telegram auth for path: {request.path}")
        
        # Mark as checked for this session
        request.session['telegram_oauth_checked'] = True
        request.session.save()
        
        try:
            # Import here to avoid circular imports
            from backend.ee.modules.notification.models import TelegramUserLink
            from backend.telegram_auth import TelegramAuthenticationHandler
            
            user_id = request.session['user'].get('user_id')
            if not user_id:
                return self.get_response(request)
            
            # Check telegram token in session
            telegram_token_from_session = request.session.get('telegram_auth_token')
            if not telegram_token_from_session:
                return self.get_response(request)
            
            # Verify token
            pending_link = TelegramAuthenticationHandler.verify_telegram_token(telegram_token_from_session)
            if not pending_link:
                return self.get_response(request)
            
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
                
                # Clear the token from session
                if 'telegram_auth_token' in request.session:
                    del request.session['telegram_auth_token']
                request.session.save()
                
                # Send success notification to Telegram
                self._send_telegram_notification(
                    pending_link.chat_id,
                    user_info.get('name', 'User'),
                    user_info.get('email', '')
                )
                
                logger.info(f"Linked Telegram chat {pending_link.chat_id} to user {user_id}")
                
            except Exception as e:
                logger.error(f"Error completing Telegram link: {str(e)}")
                    
        except Exception as e:
            logger.error(f"Error in TelegramOAuthCompletionMiddleware: {str(e)}")
            
        return self.get_response(request)
    
    def _process_telegram_link(self, request):
        """Process telegram linking for authenticated user."""
        try:
            # Import here to avoid circular imports
            from backend.ee.modules.notification.models import TelegramUserLink
            from backend.telegram_auth import TelegramAuthenticationHandler
            
            user_id = request.session['user'].get('user_id')
            if not user_id:
                return
            
            # Get telegram token from session
            telegram_token = request.session.get('telegram_auth_token')
            if not telegram_token:
                return
            
            # Verify token
            pending_link = TelegramAuthenticationHandler.verify_telegram_token(telegram_token)
            if not pending_link:
                return
            
            # Check if there's an existing verified link for this user
            existing_link = None
            try:
                from backend.ee.modules.notification.models import TelegramUserLink as TUL
                existing_link = TUL.objects.filter(
                    user_id=user_id,
                    is_verified=True,
                    is_active=True
                ).first()
                if existing_link:
                    logger.debug(f"Existing link found for user {user_id}")
            except Exception as e:
                logger.warning(f"Error checking existing link: {e}")
            
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
            
            # Clear the token from session
            if 'telegram_auth_token' in request.session:
                del request.session['telegram_auth_token']
            request.session.save()
            
            # Send success notification to Telegram
            self._send_telegram_notification(
                pending_link.chat_id,
                user_info.get('name', 'User'),
                user_info.get('email', '')
            )
            
            logger.info(f"Linked Telegram chat {pending_link.chat_id} to user {user_id}")
            
            # Mark as processed
            request.session['telegram_oauth_checked'] = True
            request.session['telegram_link_completed'] = True
            request.session.save()
            
        except Exception as e:
            logger.exception(f"Error processing telegram link: {str(e)}")
    
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
                logger.warning(f"Failed to send Telegram notification: {response.status_code}")
                
        except Exception as e:
            logger.warning(f"Error sending Telegram notification: {str(e)}")
    
    def _process_telegram_link_with_token(self, request, token):
        """Process Telegram link using token from URL."""
        try:
            from backend.ee.modules.notification.models import TelegramUserLink
            from backend.telegram_auth import TelegramAuthenticationHandler
            
            user_id = request.session['user'].get('user_id')
            if not user_id:
                return
            
            # Verify token
            pending_link = TelegramAuthenticationHandler.verify_telegram_token(token)
            if not pending_link:
                logger.warning(f"Invalid token provided in URL for user {user_id}")
                return
            
            # Update link with authenticated user
            pending_link.user_id = user_id
            pending_link.is_verified = True
            
            # Get user info
            user_info = request.session.get('user_info', {})
            if user_info:
                pending_link.gitlab_username = user_info.get('preferred_username', '')
                pending_link.gitlab_email = user_info.get('email', '')
                pending_link.gitlab_name = user_info.get('name', '')
            
            # Clear auth token
            pending_link.auth_token = None
            pending_link.auth_token_expires = None
            pending_link.save()
            
            # Send success notification
            self._send_telegram_notification(
                pending_link.chat_id,
                user_info.get('name', 'User'),
                user_info.get('email', '')
            )
            
            logger.info(f"Linked Telegram chat {pending_link.chat_id} to user {user_id} via URL token")
            
            # Mark as completed
            request.session['telegram_oauth_checked'] = True
            request.session['telegram_link_completed'] = True
            request.session.save()
            
        except Exception as e:
            logger.exception(f"Error processing telegram link with token: {str(e)}")
    
    def _check_pending_telegram_auth(self, request):
        """Check for pending auth based on user email/timing (production mode)."""
        try:
            from backend.ee.modules.notification.models import TelegramUserLink
            from django.utils import timezone
            from datetime import timedelta
            
            user = request.session.get('user', {})
            user_email = user.get('email')
            if not user_email:
                return
            
            # Check for recent pending auth (last 10 minutes)
            pending_link = TelegramUserLink.objects.filter(
                user_id=0,
                gitlab_email=user_email,
                auth_token_expires__gt=timezone.now(),
                created_on__gt=timezone.now() - timedelta(minutes=10)
            ).order_by('-created_on').first()
            
            if pending_link:
                # Complete the linking
                pending_link.user_id = user.get('user_id')
                pending_link.is_verified = True
                pending_link.auth_token = None
                pending_link.auth_token_expires = None
                pending_link.save()
                
                logger.info(f"Auto-linked Telegram chat {pending_link.chat_id} based on email match")
                
                request.session['telegram_link_completed'] = True
                request.session.save()
                
        except Exception as e:
            logger.debug(f"No pending telegram auth found: {str(e)}")
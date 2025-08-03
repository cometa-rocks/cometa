"""
Telegram Authentication Handler

This module provides a secure authentication flow for Telegram bot users,
ensuring all authentication goes through proper GitLab OAuth.
"""

import secrets
import logging
from functools import wraps
from django.utils import timezone
from django.http import JsonResponse
from django.core.exceptions import PermissionDenied
from backend.models import OIDCAccount, Account_role, Department
from backend.serializers import OIDCAccountLoginSerializer
from backend.ee.modules.notification.models import TelegramUserLink
from backend.utility.configurations import ConfigurationManager

logger = logging.getLogger(__name__)


class AuthenticationError(Exception):
    """Raised when authentication fails"""
    pass


class TelegramAuthenticationHandler:
    """Handle Telegram-specific authentication flow with GitLab OAuth validation"""
    
    @staticmethod
    def validate_oauth_user(user_id):
        """
        Validate that a user has completed GitLab OAuth authentication.
        Returns the OIDCAccount instance if valid, raises AuthenticationError otherwise.
        """
        try:
            oidc_account = OIDCAccount.objects.get(user_id=user_id)
            return oidc_account
        except OIDCAccount.DoesNotExist:
            logger.error(f"OAuth validation failed: No OIDCAccount for user_id {user_id}")
            raise AuthenticationError("User has not completed GitLab OAuth authentication")
    
    @staticmethod
    def validate_telegram_user(chat_id, require_verified=True):
        """
        Validate a Telegram user and their OAuth status.
        
        Args:
            chat_id: Telegram chat ID
            require_verified: Whether to require is_verified=True
            
        Returns:
            Tuple of (TelegramUserLink, OIDCAccount) if valid
            
        Raises:
            AuthenticationError: If validation fails
        """
        try:
            # Get the Telegram user link
            user_link = TelegramUserLink.objects.filter(
                chat_id=str(chat_id),
                is_active=True
            ).first()
            
            if not user_link:
                raise AuthenticationError("Telegram account not linked")
            
            # Check if verification is required
            if require_verified and not user_link.is_verified:
                raise AuthenticationError("Telegram account not verified through OAuth")
            
            # Validate OAuth account exists
            oidc_account = TelegramAuthenticationHandler.validate_oauth_user(user_link.user_id)
            
            return user_link, oidc_account
            
        except OIDCAccount.DoesNotExist:
            raise AuthenticationError("User has not completed GitLab OAuth authentication")
        except Exception as e:
            logger.error(f"Error validating Telegram user {chat_id}: {str(e)}")
            raise AuthenticationError(f"Authentication validation failed: {str(e)}")
    
    @staticmethod
    def validate_session_user(request):
        """
        Validate that the current session has a properly authenticated user.
        
        Returns:
            User dict from session if valid
            
        Raises:
            AuthenticationError: If session is invalid
        """
        user_info = request.session.get('user')
        if not user_info:
            raise AuthenticationError("No authenticated session")
        
        user_id = user_info.get('user_id')
        if not user_id:
            raise AuthenticationError("Invalid session: missing user_id")
        
        # Validate OAuth account exists
        TelegramAuthenticationHandler.validate_oauth_user(user_id)
        
        return user_info
    
    @staticmethod
    def verify_telegram_token(token):
        """
        Verify a Telegram authentication token and return the user link
        """
        try:
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
                return None
                
            if not user_link.is_auth_token_valid():
                logger.debug(f"Token expired for chat_id {user_link.chat_id}")
                return None
            
            logger.debug(f"Token verified for chat_id: {user_link.chat_id}")
            return user_link
            
        except Exception as e:
            logger.exception("Error verifying Telegram token")
            return None
    
    @staticmethod
    def complete_telegram_linking(request, chat_id):
        """
        Complete the Telegram account linking for an authenticated user
        """
        try:
            # Get current user from session
            user_info = request.session.get('user')
            if not user_info:
                logger.error("No user in session for Telegram linking")
                return False
            
            user_id = user_info.get('user_id')
            logger.info(f"Attempting to link Telegram chat {chat_id} to user {user_id}")
            
            # First check if there's an unverified link for this chat_id
            existing_link = TelegramUserLink.objects.filter(
                chat_id=str(chat_id)
            ).first()
            logger.info(f"Found existing link: {existing_link} (user_id={existing_link.user_id if existing_link else 'None'})")
            
            if existing_link:
                # Check if it's already linked to a different user
                if existing_link.user_id > 0 and existing_link.user_id != user_id:
                    logger.error(f"Chat ID {chat_id} is already linked to user {existing_link.user_id}")
                    return False
                
                # Update the existing link with the user information
                existing_link.user_id = user_id
                existing_link.is_active = True
                existing_link.is_verified = True
                existing_link.gitlab_email = user_info.get('email')
                existing_link.gitlab_name = user_info.get('name')
                existing_link.gitlab_username = user_info.get('name')
                existing_link.save()
            else:
                # Create new link
                TelegramUserLink.objects.create(
                    user_id=user_id,
                    chat_id=str(chat_id),
                    is_verified=True,
                    is_active=True,
                    gitlab_email=user_info.get('email'),
                    gitlab_name=user_info.get('name'),
                    gitlab_username=user_info.get('name')
                )
            
            # Reactivate user's subscriptions from previous sessions
            try:
                from backend.ee.modules.notification.managers import TelegramSubscriptionManager
                reactivated_count = TelegramSubscriptionManager.reactivate_user_subscriptions(
                    user_id=user_id,
                    chat_id=str(chat_id)
                )
                if reactivated_count > 0:
                    logger.info(f"Reactivated {reactivated_count} subscriptions for user {user_id}")
            except Exception as e:
                logger.error(f"Error reactivating subscriptions: {str(e)}")
                # Don't fail the authentication if subscription reactivation fails
            
            logger.info(f"Successfully linked Telegram chat {chat_id} to user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error completing Telegram linking: {str(e)}")
            return False


def require_telegram_oauth(func):
    """
    Decorator to ensure Telegram requests are properly authenticated through GitLab OAuth.
    Use this on any view that handles Telegram webhook commands requiring authentication.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        # Extract chat_id from different possible locations
        chat_id = None
        
        # Check if first arg is a request object
        request = args[0] if args else None
        
        # Try to get chat_id from kwargs first
        if 'chat_id' in kwargs:
            chat_id = kwargs['chat_id']
        # Try to get from request data
        elif hasattr(request, 'data') and isinstance(request.data, dict):
            chat_id = request.data.get('chat_id')
        # Try to get from parsed JSON body
        elif hasattr(request, 'body'):
            try:
                import json
                data = json.loads(request.body.decode('utf-8'))
                chat_id = data.get('message', {}).get('chat', {}).get('id')
            except:
                pass
        
        if not chat_id:
            logger.error("No chat_id found in request for OAuth validation")
            return JsonResponse({
                'success': False,
                'error': 'Authentication required: No chat_id provided'
            }, status=401)
        
        try:
            # Validate the Telegram user has completed OAuth
            user_link, oidc_account = TelegramAuthenticationHandler.validate_telegram_user(
                chat_id, 
                require_verified=True
            )
            
            # Add validated objects to kwargs for the view to use
            kwargs['user_link'] = user_link
            kwargs['oidc_account'] = oidc_account
            
            return func(*args, **kwargs)
            
        except AuthenticationError as e:
            logger.warning(f"OAuth validation failed for chat_id {chat_id}: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': str(e),
                'auth_required': True
            }, status=401)
        except Exception as e:
            logger.error(f"Unexpected error in OAuth validation: {str(e)}")
            return JsonResponse({
                'success': False,
                'error': 'Authentication validation failed'
            }, status=500)
    
    return wrapper
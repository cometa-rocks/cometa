"""
Telegram Authentication Handler

This module provides a custom authentication flow for Telegram bot users,
bypassing Apache mod_auth_openidc and creating Django sessions directly.
"""

import secrets
import logging
from django.utils import timezone
from django.http import JsonResponse
from backend.models import OIDCAccount, Account_role, Department
from backend.serializers import OIDCAccountLoginSerializer
from backend.ee.modules.notification.models import TelegramUserLink
from backend.utility.configurations import ConfigurationManager

logger = logging.getLogger(__name__)


class TelegramAuthenticationHandler:
    """Handle Telegram-specific authentication flow"""
    
    # REMOVED: create_telegram_session method that bypassed OAuth
    # Sessions must be created through proper OAuth flow only
    
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
            
            # Check if link already exists
            existing_link = TelegramUserLink.objects.filter(
                user_id=user_id,
                chat_id=str(chat_id)
            ).first()
            
            if existing_link:
                # Update existing link
                existing_link.is_verified = True
                existing_link.is_active = True
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
            
            logger.info(f"Successfully linked Telegram chat {chat_id} to user {user_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error completing Telegram linking: {str(e)}")
            return False
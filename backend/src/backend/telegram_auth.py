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
    
    @staticmethod
    def create_telegram_session(request, telegram_user_link):
        """
        Create a Django session for a Telegram authenticated user
        This bypasses Apache OAuth and creates the session directly
        """
        try:
            # Get the linked user account
            if not telegram_user_link.is_verified or telegram_user_link.user_id == 0:
                logger.error(f"Telegram user link not verified or invalid user_id: {telegram_user_link.chat_id}")
                return False
            
            # Get the OIDCAccount
            try:
                user = OIDCAccount.objects.get(user_id=telegram_user_link.user_id)
            except OIDCAccount.DoesNotExist:
                logger.error(f"OIDCAccount not found for user_id: {telegram_user_link.user_id}")
                return False
            
            # Update last login
            user.last_login = timezone.now()
            user.login_counter = user.login_counter + 1
            user.save()
            
            # Create session token (simulate mod_auth_openidc_session)
            session_token = secrets.token_urlsafe(32)
            request.session['session'] = session_token
            
            # Serialize and save user to session
            request.session['user'] = OIDCAccountLoginSerializer(user, many=False).data
            request.session['user_info'] = {
                'email': user.email,
                'name': user.name,
                'sub': str(user.user_id)
            }
            
            # Mark this as a Telegram session
            request.session['auth_method'] = 'telegram'
            request.session['telegram_chat_id'] = telegram_user_link.chat_id
            
            logger.info(f"Created Telegram session for user {user.email} (chat_id: {telegram_user_link.chat_id})")
            return True
            
        except Exception as e:
            logger.error(f"Error creating Telegram session: {str(e)}")
            return False
    
    @staticmethod
    def verify_telegram_token(token):
        """
        Verify a Telegram authentication token and return the user link
        """
        try:
            user_link = TelegramUserLink.objects.filter(auth_token=token).first()
            
            if not user_link:
                logger.error(f"No user link found for token: {token[:8]}...")
                # Log all existing tokens for debugging
                all_links = TelegramUserLink.objects.filter(auth_token__isnull=False).values('chat_id', 'auth_token', 'auth_token_expires')
                logger.error(f"Existing auth tokens: {[(l['chat_id'], l['auth_token'][:8] if l['auth_token'] else 'None', l['auth_token_expires']) for l in all_links]}")
                return None
                
            if not user_link.is_auth_token_valid():
                logger.error(f"Invalid or expired auth token for chat_id {user_link.chat_id}")
                logger.error(f"Token expires: {user_link.auth_token_expires}, Now: {timezone.now()}")
                return None
            
            logger.info(f"Token verified successfully for chat_id: {user_link.chat_id}")
            return user_link
            
        except Exception as e:
            logger.error(f"Error verifying Telegram token: {str(e)}")
            import traceback
            traceback.print_exc()
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
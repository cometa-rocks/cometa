"""
Telegram Subscription Manager
Handles all business logic for Telegram subscriptions and user links
"""
import logging
from typing import List, Optional
from django.db import transaction
from django.db.models import Q

logger = logging.getLogger(__name__)


class TelegramSubscriptionManager:
    """
    Centralized manager for all Telegram subscription operations.
    Follows single responsibility principle - handles all subscription lifecycle events.
    """
    
    @staticmethod
    @transaction.atomic
    def deactivate_user_subscriptions(user_id: int) -> int:
        """
        Deactivate all subscriptions for a user (e.g., on logout).
        
        Args:
            user_id: The user's ID
            
        Returns:
            Number of subscriptions deactivated
        """
        from .models import TelegramSubscription, TelegramUserLink
        
        try:
            # Deactivate all subscriptions
            count = TelegramSubscription.objects.filter(
                user_id=user_id,
                is_active=True
            ).update(is_active=False)
            
            # Deactivate all Telegram links
            TelegramUserLink.objects.filter(
                user_id=user_id,
                is_active=True
            ).update(is_active=False)
            
            logger.info(f"Deactivated {count} subscriptions for user {user_id}")
            return count
            
        except Exception as e:
            logger.error(f"Error deactivating subscriptions for user {user_id}: {str(e)}")
            raise
    
    @staticmethod
    @transaction.atomic
    def handle_department_access_change(user_id: int, removed_dept_ids: List[int]) -> int:
        """
        Handle when user loses access to departments.
        Deactivates subscriptions for features in those departments.
        
        Args:
            user_id: The user's ID
            removed_dept_ids: List of department IDs user no longer has access to
            
        Returns:
            Number of subscriptions deactivated
        """
        from .models import TelegramSubscription
        
        try:
            count = TelegramSubscription.objects.filter(
                user_id=user_id,
                department_id__in=removed_dept_ids,
                is_active=True
            ).update(is_active=False)
            
            logger.info(f"Deactivated {count} subscriptions for user {user_id} in departments {removed_dept_ids}")
            return count
            
        except Exception as e:
            logger.error(f"Error handling department change for user {user_id}: {str(e)}")
            raise
    
    @staticmethod
    def validate_subscription(user_id: int, feature_id: int) -> bool:
        """
        Validate if a user's subscription is still valid.
        Checks user access to feature's department.
        
        Args:
            user_id: The user's ID
            feature_id: The feature's ID
            
        Returns:
            True if subscription is valid, False otherwise
        """
        from backend.models import Account_role, Feature
        
        try:
            # Get feature's department
            feature = Feature.objects.filter(feature_id=feature_id).first()
            if not feature:
                return False
            
            # Check user has access to department
            has_access = Account_role.objects.filter(
                user_id=user_id,
                department_id=feature.department_id
            ).exists()
            
            return has_access
            
        except Exception as e:
            logger.error(f"Error validating subscription for user {user_id}, feature {feature_id}: {str(e)}")
            return False
    
    @staticmethod
    @transaction.atomic
    def cleanup_invalid_subscriptions(user_id: Optional[int] = None) -> int:
        """
        Clean up all invalid subscriptions.
        If user_id provided, only cleanup for that user.
        
        Args:
            user_id: Optional user ID to limit cleanup scope
            
        Returns:
            Number of subscriptions deactivated
        """
        from .models import TelegramSubscription
        from backend.models import Account_role, Feature
        
        try:
            # Build base query
            query = TelegramSubscription.objects.filter(is_active=True)
            if user_id:
                query = query.filter(user_id=user_id)
            
            count = 0
            # Check each subscription
            for subscription in query.select_related():
                # Validate access
                if not TelegramSubscriptionManager.validate_subscription(
                    subscription.user_id, 
                    subscription.feature_id
                ):
                    subscription.is_active = False
                    subscription.save()
                    count += 1
            
            logger.info(f"Cleaned up {count} invalid subscriptions")
            return count
            
        except Exception as e:
            logger.error(f"Error cleaning up subscriptions: {str(e)}")
            raise
    
    @staticmethod
    def get_user_unsubscribed_features(user_id: int, department_id: int) -> List[dict]:
        """
        Get features in a department that user hasn't subscribed to.
        
        Args:
            user_id: The user's ID
            department_id: The department's ID
            
        Returns:
            List of feature dictionaries
        """
        from .models import TelegramSubscription
        from backend.ee.modules.notification.views import get_department_features
        
        try:
            # Get all features user has access to
            all_features = get_department_features(user_id, department_id)
            if not all_features:
                return []
            
            # Get subscribed feature IDs
            subscribed_ids = set(
                TelegramSubscription.objects.filter(
                    user_id=user_id,
                    department_id=department_id,
                    is_active=True
                ).values_list('feature_id', flat=True)
            )
            
            # Filter out subscribed features
            unsubscribed = [
                f for f in all_features 
                if f['feature_id'] not in subscribed_ids
            ]
            
            return unsubscribed
            
        except Exception as e:
            logger.error(f"Error getting unsubscribed features: {str(e)}")
            return []
    
    @staticmethod
    @transaction.atomic
    def handle_telegram_unlink(chat_id: str) -> int:
        """
        Handle when a Telegram account is unlinked.
        Deactivates all subscriptions for that chat_id.
        
        Args:
            chat_id: The Telegram chat ID
            
        Returns:
            Number of subscriptions deactivated
        """
        from .models import TelegramSubscription, TelegramUserLink
        
        try:
            # Deactivate all subscriptions for this chat
            count = TelegramSubscription.objects.filter(
                chat_id=chat_id,
                is_active=True
            ).update(is_active=False)
            
            # Deactivate the link itself
            TelegramUserLink.objects.filter(
                chat_id=chat_id,
                is_active=True
            ).update(is_active=False)
            
            logger.info(f"Deactivated {count} subscriptions for chat {chat_id}")
            return count
            
        except Exception as e:
            logger.error(f"Error handling Telegram unlink for chat {chat_id}: {str(e)}")
            raise
    
    @staticmethod
    @transaction.atomic
    def reactivate_user_subscriptions(user_id: int, chat_id: str) -> int:
        """
        Reactivate valid subscriptions when user logs back in.
        Updates chat_id if user is logging in from a different device.
        
        Args:
            user_id: The user's ID
            chat_id: The new/current Telegram chat ID
            
        Returns:
            Number of subscriptions reactivated
        """
        from .models import TelegramSubscription
        from backend.models import Feature
        
        try:
            # Find all user's inactive subscriptions
            inactive_subs = TelegramSubscription.objects.filter(
                user_id=user_id,
                is_active=False
            )
            
            logger.info(f"Found {inactive_subs.count()} inactive subscriptions for user {user_id}")
            
            reactivated_count = 0
            
            for subscription in inactive_subs:
                # Validate subscription is still valid
                if TelegramSubscriptionManager.validate_subscription(user_id, subscription.feature_id):
                    # Check if feature still exists
                    if Feature.objects.filter(feature_id=subscription.feature_id).exists():
                        # Update chat_id if different (user on new device)
                        if subscription.chat_id != chat_id:
                            logger.info(f"Updating chat_id from {subscription.chat_id} to {chat_id} for subscription {subscription.id}")
                            subscription.chat_id = chat_id
                        
                        # Reactivate subscription
                        subscription.is_active = True
                        subscription.save()
                        reactivated_count += 1
                    else:
                        # Feature deleted - remove subscription
                        logger.info(f"Feature {subscription.feature_id} no longer exists, deleting subscription")
                        subscription.delete()
                else:
                    # User lost access - keep inactive or delete based on business rules
                    logger.info(f"User {user_id} no longer has access to feature {subscription.feature_id}")
            
            logger.info(f"Reactivated {reactivated_count} subscriptions for user {user_id}")
            return reactivated_count
            
        except Exception as e:
            logger.error(f"Error reactivating subscriptions for user {user_id}: {str(e)}")
            raise
    
    @staticmethod
    def create_subscription(user_id: int, feature_id: int, chat_id: str, 
                          notification_types: Optional[List[str]] = None) -> Optional['TelegramSubscription']:
        """
        Create a new subscription with validation.
        
        Args:
            user_id: The user's ID
            feature_id: The feature's ID
            chat_id: The Telegram chat ID
            notification_types: List of notification types (default: both success and failure)
            
        Returns:
            Created subscription or None if validation fails
        """
        from .models import TelegramSubscription
        
        try:
            # Validate user has access
            if not TelegramSubscriptionManager.validate_subscription(user_id, feature_id):
                logger.warning(f"User {user_id} doesn't have access to feature {feature_id}")
                return None
            
            # Set default notification types
            if not notification_types:
                notification_types = ['on_success', 'on_failure']
            
            # Check if subscription already exists
            existing = TelegramSubscription.objects.filter(
                user_id=user_id,
                feature_id=feature_id,
                chat_id=chat_id
            ).first()
            
            if existing:
                # Reactivate if inactive
                if not existing.is_active:
                    existing.is_active = True
                    existing.notification_types = notification_types
                    existing.save()
                    logger.info(f"Reactivated existing subscription {existing.id}")
                return existing
            
            # Create new subscription
            subscription = TelegramSubscription.objects.create(
                user_id=user_id,
                feature_id=feature_id,
                chat_id=chat_id,
                notification_types=notification_types,
                is_active=True
            )
            
            logger.info(f"Created new subscription {subscription.id} for user {user_id}, feature {feature_id}")
            return subscription
            
        except Exception as e:
            logger.error(f"Error creating subscription: {str(e)}")
            return None
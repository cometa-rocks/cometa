"""
Django signals for Telegram notification module
Handles cleanup when related models change
"""
import logging
from django.db.models.signals import post_delete, pre_delete, post_save
from django.dispatch import receiver
from backend.models import Account_role, Feature
from .models import TelegramUserLink, TelegramSubscription
from .managers import TelegramSubscriptionManager

logger = logging.getLogger(__name__)


@receiver(post_delete, sender=Account_role)
def handle_department_access_removal(sender, instance, **kwargs):
    """
    When user loses access to a department, deactivate related subscriptions
    """
    try:
        TelegramSubscriptionManager.handle_department_access_change(
            user_id=instance.user_id,
            removed_dept_ids=[instance.department_id]
        )
    except Exception as e:
        logger.error(f"Error handling department access removal: {str(e)}")


@receiver(post_delete, sender=Feature)
def handle_feature_deletion(sender, instance, **kwargs):
    """
    When a feature is deleted, deactivate all related subscriptions
    """
    try:
        count = TelegramSubscription.objects.filter(
            feature_id=instance.feature_id,
            is_active=True
        ).update(is_active=False)
        
        if count > 0:
            logger.info(f"Deactivated {count} subscriptions for deleted feature {instance.feature_id}")
    except Exception as e:
        logger.error(f"Error handling feature deletion: {str(e)}")


@receiver(pre_delete, sender=TelegramUserLink)
def handle_telegram_unlink(sender, instance, **kwargs):
    """
    When a Telegram link is deleted, deactivate all related subscriptions
    """
    try:
        TelegramSubscriptionManager.handle_telegram_unlink(instance.chat_id)
    except Exception as e:
        logger.error(f"Error handling Telegram unlink: {str(e)}")


@receiver(post_save, sender=TelegramUserLink)
def handle_telegram_link_deactivation(sender, instance, created, **kwargs):
    """
    When a Telegram link is deactivated (not deleted), deactivate subscriptions
    """
    if not created and not instance.is_active:
        try:
            TelegramSubscriptionManager.handle_telegram_unlink(instance.chat_id)
        except Exception as e:
            logger.error(f"Error handling Telegram link deactivation: {str(e)}")
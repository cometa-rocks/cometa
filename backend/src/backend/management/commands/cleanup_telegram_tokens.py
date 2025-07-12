"""
Management command to clean up expired Telegram authentication tokens.
Run periodically via cron or scheduler.
"""
from django.core.management.base import BaseCommand
from django.utils import timezone
from backend.ee.modules.notification.models import TelegramUserLink
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Clean up expired Telegram authentication tokens'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cleaned without actually deleting',
        )
        parser.add_argument(
            '--days',
            type=int,
            default=7,
            help='Delete unverified links older than N days (default: 7)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        days_old = options['days']
        
        # Clean expired auth tokens
        expired_tokens = TelegramUserLink.objects.filter(
            auth_token__isnull=False,
            auth_token_expires__lt=timezone.now()
        )
        
        expired_count = expired_tokens.count()
        if expired_count > 0:
            self.stdout.write(f"Found {expired_count} expired auth tokens")
            
            if not dry_run:
                for link in expired_tokens:
                    link.clear_auth_token()
                self.stdout.write(self.style.SUCCESS(f"Cleared {expired_count} expired tokens"))
            else:
                self.stdout.write("DRY RUN: Would clear these tokens")
        
        # Clean old unverified links
        cutoff_date = timezone.now() - timezone.timedelta(days=days_old)
        old_unverified = TelegramUserLink.objects.filter(
            is_verified=False,
            created_on__lt=cutoff_date
        )
        
        unverified_count = old_unverified.count()
        if unverified_count > 0:
            self.stdout.write(f"Found {unverified_count} unverified links older than {days_old} days")
            
            if not dry_run:
                old_unverified.delete()
                self.stdout.write(self.style.SUCCESS(f"Deleted {unverified_count} old unverified links"))
            else:
                self.stdout.write("DRY RUN: Would delete these links")
        
        # Summary
        if expired_count == 0 and unverified_count == 0:
            self.stdout.write(self.style.SUCCESS("No cleanup needed"))
        
        logger.info(f"Telegram token cleanup: {expired_count} expired, {unverified_count} old unverified")
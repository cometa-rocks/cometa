"""
Django management command to delete Telegram authentication for testing purposes.

Usage:
    python manage.py delete_telegram_auth <chat_id>
    python manage.py delete_telegram_auth --all
"""

from django.core.management.base import BaseCommand
from backend.ee.modules.notification.models import TelegramUserLink
from django.contrib.sessions.models import Session
from backend.models import OIDCAccount
import logging

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Delete Telegram authentication link for testing purposes'

    def add_arguments(self, parser):
        parser.add_argument(
            'chat_id',
            type=str,
            nargs='?',
            help='The Telegram chat ID to unlink'
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Delete all Telegram authentication links (use with caution!)'
        )
        parser.add_argument(
            '--user-email',
            type=str,
            help='Delete Telegram links for a specific user by email'
        )
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip confirmation prompts (non-interactive mode)'
        )

    def handle(self, *args, **options):
        if options['all']:
            # Delete all Telegram links
            count = TelegramUserLink.objects.all().count()
            if count > 0:
                self.stdout.write(f"Found {count} Telegram link(s).")
                confirm = input("Are you sure you want to delete ALL Telegram links? (yes/no): ")
                if confirm.lower() == 'yes':
                    TelegramUserLink.objects.all().delete()
                    self.stdout.write(self.style.SUCCESS(f"Successfully deleted {count} Telegram link(s)."))
                else:
                    self.stdout.write("Operation cancelled.")
            else:
                self.stdout.write("No Telegram links found.")
        
        elif options['user_email']:
            # Delete by user email
            email = options['user_email']
            try:
                user = OIDCAccount.objects.get(email__iexact=email)
                links = TelegramUserLink.objects.filter(user_id=user.user_id)
                count = links.count()
                if count > 0:
                    links.delete()
                    self.stdout.write(self.style.SUCCESS(
                        f"Successfully deleted {count} Telegram link(s) for user {email}"
                    ))
                else:
                    self.stdout.write(f"No Telegram links found for user {email}")
            except OIDCAccount.DoesNotExist:
                self.stdout.write(self.style.ERROR(f"User with email {email} not found"))
        
        elif options['chat_id']:
            # Delete by chat ID
            chat_id = options['chat_id']
            try:
                link = TelegramUserLink.objects.get(chat_id=str(chat_id))
                user_info = f"User ID: {link.user_id}, Email: {link.gitlab_email}" if link.is_verified else "Not verified"
                self.stdout.write(f"Found Telegram link: {user_info}")
                
                if options.get('yes'):
                    confirm = 'yes'
                else:
                    confirm = input("Delete this link? (yes/no): ")
                if confirm.lower() == 'yes':
                    link.delete()
                    self.stdout.write(self.style.SUCCESS(
                        f"Successfully deleted Telegram link for chat ID {chat_id}"
                    ))
                    
                    # Also clear any Django sessions that might have this chat_id
                    sessions_cleared = 0
                    for session in Session.objects.all():
                        data = session.get_decoded()
                        if data.get('telegram_chat_id') == str(chat_id):
                            session.delete()
                            sessions_cleared += 1
                    
                    if sessions_cleared > 0:
                        self.stdout.write(self.style.SUCCESS(
                            f"Also cleared {sessions_cleared} session(s) with this chat ID"
                        ))
                else:
                    self.stdout.write("Operation cancelled.")
                    
            except TelegramUserLink.DoesNotExist:
                self.stdout.write(self.style.ERROR(
                    f"No Telegram link found for chat ID {chat_id}"
                ))
        
        else:
            self.stdout.write(self.style.ERROR(
                "Please provide a chat_id or use --all or --user-email option"
            ))
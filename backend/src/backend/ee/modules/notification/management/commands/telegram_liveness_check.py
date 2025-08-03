"""
Django management command for Telegram notification system liveness check.
Simple check to verify the application is running.
"""
import json
from django.core.management.base import BaseCommand
from django.utils import timezone


class Command(BaseCommand):
    help = 'Run simple liveness check for Telegram notification system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--json',
            action='store_true',
            help='Output results in JSON format',
        )

    def handle(self, *args, **options):
        timestamp = timezone.now()
        
        if options['json']:
            response_data = {
                "status": "alive",
                "timestamp": timestamp.isoformat()
            }
            self.stdout.write(json.dumps(response_data, indent=2))
        else:
            self.stdout.write(
                self.style.SUCCESS('Status: ALIVE')
            )
            self.stdout.write(f'Timestamp: {timestamp}')
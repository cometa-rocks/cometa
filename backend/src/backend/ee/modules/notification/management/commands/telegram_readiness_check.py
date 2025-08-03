"""
Django management command for Telegram notification system readiness check.
Checks if the application is ready to serve requests.
"""
import json
from django.core.management.base import BaseCommand
from django.db import connection
from django.core.cache import cache
from django.utils import timezone


class Command(BaseCommand):
    help = 'Run readiness check for Telegram notification system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--json',
            action='store_true',
            help='Output results in JSON format',
        )

    def handle(self, *args, **options):
        timestamp = timezone.now()
        
        try:
            # Quick database check
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            
            # Quick cache check
            cache.set("readiness_check", "ok", 10)
            cache.get("readiness_check")
            
            if options['json']:
                response_data = {
                    "status": "ready",
                    "timestamp": timestamp.isoformat()
                }
                self.stdout.write(json.dumps(response_data, indent=2))
            else:
                self.stdout.write(
                    self.style.SUCCESS('Status: READY')
                )
                self.stdout.write(f'Timestamp: {timestamp}')
                
        except Exception as e:
            if options['json']:
                response_data = {
                    "status": "not_ready",
                    "error": str(e),
                    "timestamp": timestamp.isoformat()
                }
                self.stdout.write(json.dumps(response_data, indent=2))
            else:
                self.stdout.write(
                    self.style.ERROR('Status: NOT READY')
                )
                self.stdout.write(f'Error: {str(e)}')
                self.stdout.write(f'Timestamp: {timestamp}')
            
            exit(1)
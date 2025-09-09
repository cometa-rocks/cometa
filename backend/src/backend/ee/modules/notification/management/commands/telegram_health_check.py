"""
Django management command for Telegram notification system health check.
"""
import json
from django.core.management.base import BaseCommand
from backend.ee.modules.notification.health import TelegramHealthChecker, HealthCheckStatus


class Command(BaseCommand):
    help = 'Run comprehensive health check for Telegram notification system'

    def add_arguments(self, parser):
        parser.add_argument(
            '--json',
            action='store_true',
            help='Output results in JSON format',
        )
        parser.add_argument(
            '--component',
            type=str,
            help='Check specific component: database, cache, telegram_api, configuration, models, webhook',
        )
        parser.add_argument(
            '--fail-on-degraded',
            action='store_true',
            help='Exit with code 1 if any component is degraded',
        )

    def handle(self, *args, **options):
        checker = TelegramHealthChecker()
        
        if options['component']:
            # Check specific component
            component_name = options['component']
            check_method = getattr(checker, f'check_{component_name}', None)
            
            if not check_method:
                self.stderr.write(
                    self.style.ERROR(f'Unknown component: {component_name}')
                )
                return
            
            result = check_method()
            
            if options['json']:
                self.stdout.write(json.dumps(result.to_dict(), indent=2))
            else:
                self._print_component_result(result)
            
            # Exit with appropriate code
            if result.status == HealthCheckStatus.UNHEALTHY:
                exit(1)
            elif result.status == HealthCheckStatus.DEGRADED and options['fail_on_degraded']:
                exit(1)
                
        else:
            # Run all checks
            overall_status, results = checker.check_all()
            
            if options['json']:
                response_data = {
                    "status": overall_status,
                    "components": [result.to_dict() for result in results]
                }
                self.stdout.write(json.dumps(response_data, indent=2))
            else:
                self._print_health_report(overall_status, results)
            
            # Exit with appropriate code
            if overall_status == HealthCheckStatus.UNHEALTHY:
                exit(1)
            elif overall_status == HealthCheckStatus.DEGRADED and options['fail_on_degraded']:
                exit(1)

    def _print_health_report(self, overall_status, results):
        """Print human-readable health report."""
        # Print overall status
        if overall_status == HealthCheckStatus.HEALTHY:
            self.stdout.write(
                self.style.SUCCESS(f'Overall Status: {overall_status.upper()}')
            )
        elif overall_status == HealthCheckStatus.DEGRADED:
            self.stdout.write(
                self.style.WARNING(f'Overall Status: {overall_status.upper()}')
            )
        else:
            self.stdout.write(
                self.style.ERROR(f'Overall Status: {overall_status.upper()}')
            )
        
        self.stdout.write('')
        
        # Print component results
        for result in results:
            self._print_component_result(result)
            self.stdout.write('')

    def _print_component_result(self, result):
        """Print individual component result."""
        status_style = self.style.SUCCESS
        if result.status == HealthCheckStatus.DEGRADED:
            status_style = self.style.WARNING
        elif result.status == HealthCheckStatus.UNHEALTHY:
            status_style = self.style.ERROR
        
        self.stdout.write(f'{result.name.upper()}: {status_style(result.status)}')
        
        if result.message:
            self.stdout.write(f'  Message: {result.message}')
        
        if result.details:
            self.stdout.write('  Details:')
            for key, value in result.details.items():
                self.stdout.write(f'    {key}: {value}')
        
        self.stdout.write(f'  Duration: {result.duration_ms}ms')
        self.stdout.write(f'  Timestamp: {result.timestamp}')
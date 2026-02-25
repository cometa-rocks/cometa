from django.core.management.base import BaseCommand
from backend.ee.modules.security.models import ResponseHeaders
from django.db.models import Q
import traceback
import sys

# Try to use LoggedCommand if available, otherwise fall back to BaseCommand
try:
    from command_log.management.commands import LoggedCommand, PartialCompletionError
    from backend.utility.classes import LogCommand
    USE_LOGGING = True
    BaseCommandClass = LoggedCommand
except (ImportError, Exception):
    USE_LOGGING = False
    BaseCommandClass = BaseCommand
    PartialCompletionError = Exception

# ERROR CODES
# 0 - Script proceeded as expected
# 1 - Script error: Something went wrong while running the procedure
# 2 - Prompt error: Missing prompt or invalid value

class Command(BaseCommandClass):
    help = 'Clean up orphaned ResponseHeaders for Feature_results that have been soft-deleted or already processed by housekeeping.'

    """
    CRONTAB
    Run cleanup: python /opt/code/manage.py cleanup_orphaned_response_headers
    Run with dry-run: python /opt/code/manage.py cleanup_orphaned_response_headers --dry-run
    """

    def add_arguments(self, parser):
        if USE_LOGGING:
            super().add_arguments(parser)
        parser.add_argument(
            '--dry-run',
            action='store_true',
            default=False,
            help='Show what would be deleted without actually deleting.'
        )

    def handle(self, *args, **options):
        """Entry point for BaseCommand"""
        if USE_LOGGING:
            return self.do_command(**options)
        else:
            return self.do_command_simple(**options)

    def log(self, message, type='info', spacing=0):
        """Logging method that works with or without LogCommand"""
        if USE_LOGGING:
            # Use LogCommand's log method if available
            if hasattr(super(), 'log'):
                super().log(message, type=type, spacing=spacing)
            else:
                # Fallback if LogCommand is not properly initialized
                prefix = {'info': 'INFO', 'error': 'ERROR', 'success': 'SUCCESS', 'warning': 'WARNING'}.get(type, 'INFO')
                indent = '  ' * spacing
                self.stdout.write(f"{indent}[{prefix}] {message}")
        else:
            # Simple print-based logging when LogCommand is not available
            prefix = {'info': 'INFO', 'error': 'ERROR', 'success': 'SUCCESS', 'warning': 'WARNING'}.get(type, 'INFO')
            indent = '  ' * spacing
            self.stdout.write(f"{indent}[{prefix}] {message}")

    def do_command(self, *args, **kwargs):
        """Main cleanup logic"""
        # Extract dry_run from kwargs or options
        if kwargs:
            dry_run = kwargs.get('dry_run', False)
        else:
            dry_run = False
        
        self.log("============================================")
        self.log("Starting orphaned ResponseHeaders cleanup")
        if dry_run:
            self.log("DRY RUN MODE - No changes will be made")
        self.log("============================================")
        
        try:
            # Find ResponseHeaders where the associated Feature_result is soft-deleted (#6705)
            # or has been marked for housekeeping completion
            # Query for orphaned ResponseHeaders:
            # 1. Feature_result is soft-deleted (is_removed=True)
            # 2. Feature_result has house_keeping_done=True (already processed)
            orphaned_response_headers = ResponseHeaders.all_objects.filter(
                Q(result_id__is_removed=True) | Q(result_id__house_keeping_done=True)
            )
            
            # Remove duplicates (in case a ResponseHeaders matches both conditions)
            orphaned_response_headers = orphaned_response_headers.distinct()
            
            count = orphaned_response_headers.count()
            self.log(f"Found {count} orphaned ResponseHeaders record(s) to clean")
            
            if count == 0:
                self.log("No orphaned ResponseHeaders found")
                return
            
            deleted_count = 0
            failed_count = 0
            
            for response_header in orphaned_response_headers:
                try:
                    # Get feature_result_id safely
                    feature_result_id = None
                    if response_header.result_id:
                        feature_result_id = response_header.result_id.feature_result_id
                    else:
                        feature_result_id = "Unknown (result_id is None)"
                    
                    if dry_run:
                        self.log(
                            f"[DRY RUN] Would delete ResponseHeaders [ID: {response_header.id}] for Feature_Result [ID: {feature_result_id}]",
                            spacing=2
                        )
                        deleted_count += 1
                    else:
                        self.log(
                            f"Deleting orphaned ResponseHeaders [ID: {response_header.id}] for Feature_Result [ID: {feature_result_id}]",
                            spacing=2
                        )
                        response_header.delete(soft=False)  # Hard delete
                        deleted_count += 1
                        self.log(f"  ✓ Deleted successfully", type='success', spacing=2)
                except Exception as e:
                    failed_count += 1
                    self.log(
                        f"Error deleting orphaned ResponseHeaders [ID: {response_header.id}]: {str(e)}",
                        type="error",
                        spacing=2
                    )
                    self.log(f"Traceback: {traceback.format_exc()}", type="error", spacing=2)
            
            self.log("============================================")
            if dry_run:
                self.log(f"DRY RUN completed: {deleted_count} would be deleted, {failed_count} errors")
            else:
                self.log(f"Orphaned ResponseHeaders cleanup completed: {deleted_count} deleted, {failed_count} failed")
            self.log("============================================")
            
        except Exception as exception:
            self.log(
                f"Exception occurred while cleaning orphaned ResponseHeaders: {str(exception)}",
                type="error",
                spacing=1
            )
            self.log(f"Traceback: {traceback.format_exc()}", type="error", spacing=2)
            if USE_LOGGING:
                raise PartialCompletionError("Failed to complete orphaned ResponseHeaders cleanup")
            else:
                sys.exit(1)

    def do_command_simple(self, **kwargs):
        """Simplified version that doesn't require LoggedCommand"""
        return self.do_command(**kwargs)

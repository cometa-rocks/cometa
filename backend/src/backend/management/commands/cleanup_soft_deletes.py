from django.core.management.base import BaseCommand
from backend.models import Department, File
from datetime import datetime, timedelta
from backend.utility.classes import LogCommand
from command_log.management.commands import LoggedCommand, PartialCompletionError
from django.core.management import call_command

# ERROR CODES
# 0 - Script proceeded as expected
# 1 - Script error: Something went wrong while running the procedure
# 2 - Prompt error: Missing prompt or invalid value

class Command(LoggedCommand, LogCommand):
    help = 'Automatically removes SoftDeleteableModel objects older than x days.'

    """
    CRONTAB
    For all departments: 1 0 * * * python /opt/code/manage.py cleanup_soft_deletes --all-departments
    For one department:  1 0 * * * python /opt/code/manage.py cleanup_soft_deletes --department 1 --days 90
    """

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument('--days', type=int, help='Defines amount of days. If specified with --all-departments, all departments will be treated with the specified days.')
        parser.add_argument('--department', type=int, help='Defines which department to cleanup. Must be the ID.')
        parser.add_argument('--dry-run', action='store_true', default=False, help='Goes through without deleting.')
        parser.add_argument('--all-departments', action='store_true', default=False, help='Fetch all departments in database and re-runs this script for each one.')

    def do_command(self, *args, **kwargs):
        # Check days parameter
        days = kwargs.get('days', None)
        # Get all departments parameter
        all_departments = kwargs.get('all_departments', False)
        if all_departments:
            departments = Department.objects.all()
            self.log('============================================')
            self.log('%d departments will be cleaned up.' % len(departments))
            self.log('============================================')
            # Make copy and delete original all_departments parameter
            sub_kwargs = kwargs.copy()
            del sub_kwargs['all_departments']
            for department in departments:
                self.log('Cleaning up department: %s (ID: %d) ...' % (str(department.department_name), int(department.department_id)))
                sub_kwargs['department'] = department.department_id
                sub_kwargs['days'] = days if days else department.settings.get('result_expire_days', 90) # default to 90 days
                call_command('cleanup_soft_deletes', **sub_kwargs)
                self.log('Done', type='success')
            return 0
        # Get dry run parameter
        dry_run = kwargs.get('dry_run', False)
        if days is None:
            raise PartialCompletionError('Days argument is mandatory. Example: --days 10')
        # Check department parameter
        department = kwargs.get('department', None)
        if department is None:
            raise PartialCompletionError('Department argument is mandatory. Example: --department Default')
        # Check department exists
        departments = Department.objects.filter(department_id=department)
        if not departments.exists():
            raise Exception('The passed department id does not exist.')
        # Calculate time offset of days
        time_threshold = datetime.utcnow() - timedelta(days=days)
        # get objects we need to delete
        objects = []
        objects.extend(File.all_objects.filter(
            is_removed=True,
            removed_at__lte=time_threshold,
            department_id=department
        ))
        if objects:
            self.log('=================================')
            self.log('Total objects older than %d days: %d' % (days, len(objects)))
            self.log('=================================')

            objects_removed = {}

            for object in objects:
                object_type = type(object).__name__
                if object_type not in objects_removed:
                    objects_removed[object_type] = 0

                self.log(f"Removing object for model {object_type} with id {object.pk}")
                if not dry_run:
                    object.delete(soft=False)
                objects_removed[object_type] += 1

            self.log('=================================')
            self.log(f'RESULTS {"(no items were removed since dry-run is on)" if dry_run else ""}')
            self.log('=================================')
            for k,v in objects_removed.items():
                self.log(f'-> {k}: {v}')
        else:
            self.log('=================================')
            self.log('No objects older than %d days: %d' % (days, len(objects)))
            self.log('=================================')
            

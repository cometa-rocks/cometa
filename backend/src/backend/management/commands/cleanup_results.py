from django.core.management.base import BaseCommand
from backend.models import Feature_result, Feature_Runs, Department
from datetime import datetime, timedelta
from backend.utility.classes import LogCommand
import os, sys
from command_log.management.commands import LoggedCommand, PartialCompletionError
from django.core.management import call_command

# ERROR CODES
# 0 - Script proceeded as expected
# 1 - Script error: Something went wrong while running the procedure
# 2 - Prompt error: Missing prompt or invalid value

class Command(LoggedCommand, LogCommand):
    help = 'Automatically removes Feature results older than x days. Including images and videos.'

    """
    CRONTAB
    For all departments: 1 0 * * * python /opt/code/manage.py cleanup_results --all-departments
    For one department:  1 0 * * * python /opt/code/manage.py cleanup_results --department 1 --days 90 --backup /backups/2021-07-16.zip
    """

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument('--days', type=int, help='Defines amount of days. If specified with --all-departments, all departments will be treated with the specified days.')
        parser.add_argument('--department', type=int, help='Defines which department to cleanup. Must be the ID.')
        parser.add_argument('--backup', type=str, help='Defines a backup name. If not provided will not be done.')
        parser.add_argument('--dry-run', action='store_true', default=False, help='Goes through without deleting.')
        parser.add_argument('--all-departments', action='store_true', default=False, help='Fetch all departments in database and re-runs this script for each one.')

    def do_command(self, *args, **kwargs):
        # Check days parameter
        days = kwargs.get('days', None)
        # Get all departments parameter
        all_departments = kwargs.get('all_departments', False)
        if all_departments:
            if days is None:
                # Retrieve all departments with a configured expiry_results_days
                departments = Department.objects.filter(settings__result_expire_days__gt=0)
            else:
                departments = Department.objects.all()
            self.log('============================================')
            self.log('%d departments with expire days configured' % len(departments))
            self.log('============================================')
            # Make copy and delete original all_departments parameter
            sub_kwargs = kwargs.copy()
            del sub_kwargs['all_departments']
            for department in departments:
                self.log('Cleaning up department: %s (ID: %d) ...' % (str(department.department_name), int(department.department_id)))
                sub_kwargs['department'] = department.department_id
                call_command('cleanup_results', **sub_kwargs)
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
        # Check backup parameter
        backup = kwargs.get('backup', None)
        if backup:
            # Import ZIP
            from zipfile import ZipFile
            # Aditional checks
            if not backup.endswith('.zip'):
                backup = backup + '.zip'
        # Calculate time offset of days
        time_threshold = datetime.now() - timedelta(days=days)
        # Get results older than the provided days
        runs = Feature_Runs.all_objects.filter(
            archived=False,
            date_time__lte=time_threshold,
            feature__department_id=department
        )
        if len(runs) > 0:
            self.log('=================================')
            self.log('Total runs older than %d days: %d' % (days, len(runs)))
            self.log('=================================')
            if backup:
                # Create ZIP file
                zipObj = ZipFile('%s' % backup, 'a')
            results_removed = 0
            runs_removed = 0
            # Iterate runs
            for run in runs:
                self.log('Working on run ID: %d - Feature ID: %d' % (run.run_id, run.feature_id))
                # Retrieve feature results of the current run
                results = run.feature_results.filter(archived=False)
                self.log('\t• %d child results found' % len(results))
                self.log('\t• Removing results:')
                # Delete each result, which also triggers delete of images and video
                for result in results:
                    self.log('\t\t• Result ID: %d' % result.feature_result_id)
                    if backup:
                        # Backup images
                        self.log('\t\t\t• Performing backup of images')
                        featureId = run.feature.feature_id
                        featureRunId = run.run_id
                        featureResultId = result.feature_result_id
                        dirPath = '/code/behave/screenshots/%d/%d/%d/' % (featureId, featureRunId, featureResultId)
                        # Iterate over all the files in directory
                        for folderName, subfolders, filenames in os.walk(dirPath):
                            for filename in filenames:
                                # Create complete filepath of file in directory
                                filePath = os.path.join(folderName, filename)
                                # Add file to zip
                                zipObj.write(filePath, filePath)
                        self.log('\t\t\t\tDone', type='success')
                        if result.video_url:
                            # Backup video
                            self.log('\t\t\t• Performing backup of video')
                            videoPath = '/code/behave%s' % result.video_url
                            if os.path.isfile(videoPath):
                                # Add file to zip
                                zipObj.write(videoPath, videoPath)
                                self.log('\t\t\t\tDone', type='success')
                            else:
                                self.log('\t\t\t\tvideo_url is defined but file doesn\'t exist', type='warning')
                    # Delete current result and sum 1 to count
                    if not dry_run:
                        result.delete()
                    results_removed += 1
                    self.log('\t\t\tDeleted')
                # Re-run all() to obtain how many results remain
                results = run.feature_results.all()
                # Delete run if empty results
                if len(results) == 0:
                    if not dry_run:
                        run.delete()
                    runs_removed += 1
                    self.log('\t• Removed empty run')
            self.log('=====================', type='success')
            self.log('=====  RESULTS  =====', type='success')
            self.log('=====================', type='success')
            self.log('Removed runs: %d' % runs_removed)
            self.log('Removed results: %d' % results_removed)
            # Finalize ZIP
            if backup:
                zipObj.close()
                self.log('Backup created: %s' % backup, type='success')
        else:
            self.log('=================================')
            self.log('No runs found older than %d days' % days)
            self.log('=================================')


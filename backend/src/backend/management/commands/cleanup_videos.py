from backend.utility.classes import LogCommand
import subprocess
import os
from command_log.management.commands import LoggedCommand, PartialCompletionError


# ------------------------------------------------------------------
# see help below how this works .... #2802
# 2021-07-13 ABP created this for housekeeping
# ------------------------------------------------------------------

class Command(LoggedCommand, LogCommand):
    help = '''Automatically removes videos older than 1 day with 0 size or dangled.
            # ERROR CODES
            # 0 - Script proceeded as expected
            # 1 - Script error: Something went wrong while running the procedure
            # 2 - Prompt error: Missing prompt or invalid value
            '''

    """
    CRONTAB
    For all departments: 1 0 * * * python /opt/code/manage.py cleanup_videos
    """

    def add_arguments(self, parser):
        super().add_arguments(parser)

    # Correctly format video string
    def fix_video(self, video):
        video = video.strip()
        if isinstance(video, bytes):
            video = video.decode('utf-8')
        return video
    
    # Removes the given video file
    def remove_video(self, video, index):
        video = self.fix_video(video)
        if os.path.isfile(video):
            try:
                self.log('Removing video # %d ...' % index)
                os.remove(video)
                self.log('\t• Done', type='success')
            except Exception as err:
                self.log('\t• Unable to remove video file: %s' % video, type='error')
                self.log(str(err), type='error')

    def do_command(self, *args, **kwargs):
        # Get video files with 0 size
        videos_zero_size = subprocess.check_output(['/usr/bin/find', '/code/behave/videos', '-name',  '*.mp4', '-mtime', '+1', '-size', '0']).splitlines()
        self.log('Found %d videos with size 0' % len(videos_zero_size))
        for index, video in enumerate(videos_zero_size):
            self.remove_video(video, index)
        # Get video files dangling (videos created by selenoid which failed while running, therefore they couldn't be renamed)
        videos_dangling = subprocess.check_output(['/usr/bin/find', '/code/behave/videos', '-name',  'selenoid*.mp4', '-mtime', '+1']).splitlines()
        self.log('Found %d dangling videos' % len(videos_dangling))
        for index, video in enumerate(videos_dangling):
            self.remove_video(video, index)
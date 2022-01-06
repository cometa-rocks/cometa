import datetime

from command_log.management.commands import LoggedCommand, PartialCompletionError, isodate
from command_log.models import ManagementCommandLog

# declared here so they can be referred to in tests
EXCEPTION_MSG = "Forced error"
DEFAULT_RETURN_VALUE = {"updated": 1}


class Command(LoggedCommand):

    truncate_interval = datetime.timedelta(seconds=10)

    def add_arguments(self, parser):
        super().add_arguments(parser)
        parser.add_argument(
            "--exit-code",
            action="store",
            dest="exit_code",
            type=int,
            default=ManagementCommandLog.EXIT_CODE_SUCCESS,
            help="Use this option to force a specific exit code.",
        )

    def do_command(self, *args, **options):
        exit_code = options["exit_code"]
        self.stdout.write(
            f"Running test command, "
            f"--exit-code={exit_code}, "
        )
        if exit_code == ManagementCommandLog.EXIT_CODE_FAILURE:
            raise Exception(EXCEPTION_MSG)
        if exit_code == ManagementCommandLog.EXIT_CODE_PARTIAL:
            raise PartialCompletionError(EXCEPTION_MSG, output=DEFAULT_RETURN_VALUE)
        return DEFAULT_RETURN_VALUE
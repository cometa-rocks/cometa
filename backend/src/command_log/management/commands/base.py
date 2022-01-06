from __future__ import annotations

import argparse
import datetime
import logging
from typing import Any

from django.core.management.base import BaseCommand, CommandParser
from django.db import transaction
from django.utils.timezone import now as tz_now
from contextlib import redirect_stdout
import io

from ...models import ManagementCommandLog

logger = logging.getLogger("command_log")

__all__ = [
    "DoNotCommit",
    "PartialCompletionError",
    "isodate",
    "LoggedCommand",
    "TransactionLoggedCommand",
]


class DoNotCommit(Exception):
    """Exception used to indicate the --commit option is not set."""

    pass


class PartialCompletionError(Exception):
    """
    Exception raised to indicate that the command partially succeeded.

    In the event of a command partially completing, when the user does
    not want to rollback the transaction, they should raise this error
    to show that they want to store some output as well as the error
    details.

    """

    def __init__(self, message: str, output: Any = {}) -> None:
        self.output = output
        super().__init__(message)


def isodate(date_str: str) -> datetime.date:
    """Parse option string as isoformat date (YYYY-MM-DD)."""
    try:
        return datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise argparse.ArgumentTypeError(
            "Invalid date format - date options must be YYYY-MM-DD"
        )


class LoggedCommand(BaseCommand):
    """Base class for commands that automatically log their execution."""

    # interval after which the record can be deleted by
    # truncate_management_command_log command.
    truncate_interval: datetime.timedelta = None

    @property
    def app_name(self) -> str:
        return self.__module__.split(".")[-4]

    @property
    def command_name(self) -> str:
        return self.__module__.split(".")[-1]

    @property
    def truncate_at(self) -> datetime.datetime:
        if not self.truncate_interval:
            return None
        return tz_now() + self.truncate_interval

    def do_command(self, *args: Any, **options: Any) -> Any:
        raise NotImplementedError()

    def handle(self, *args: Any, **options: Any) -> None:
        """Run the do_command method and log the output."""
        log = ManagementCommandLog(
            app_name=self.app_name,
            command_name=self.command_name,
            truncate_at=self.truncate_at,
            parameters=options
        )
        log.start()
        try:
            # Get output of function
            f = io.StringIO()
            with redirect_stdout(f):
                self.do_command(*args, **options)
            output = f.getvalue()
            log.stop(output=str(output), exit_code=log.EXIT_CODE_SUCCESS)
        except PartialCompletionError as ex:
            logger.error(self.style.ERROR(ex))
            log.stop(output=ex.output, exit_code=log.EXIT_CODE_PARTIAL, error=ex)
            # Added exit code for external usage
            exit(1)
        except Exception as ex:  # pylint:disable=broad-except
            logger.exception("Error running management command: %s", log)
            log.stop(output="", exit_code=log.EXIT_CODE_FAILURE, error=ex)
            print(self.style.ERROR(ex))
            # Added exit code for external usage
            exit(2)


class TransactionLoggedCommand(LoggedCommand):
    """Base class for commands that automatically rollback in the event of a failure."""

    def add_arguments(self, parser: CommandParser) -> None:
        super().add_arguments(parser)
        parser.add_argument(
            "--commit",
            action="store_true",
            dest="commit",
            default=False,
            help="Commit database changes",
        )

    def handle(self, *args: Any, **options: Any) -> None:
        commit = options["commit"]
        try:
            with transaction.atomic():
                super().handle(*args, **options)
                if not commit:
                    raise DoNotCommit()
        except DoNotCommit:
            self.print_rollback_message()

    def print_rollback_message(self) -> None:
        self.stdout.write(
            "\n"
            + self.style.NOTICE("ROLLBACK")
            + " All database changes have been rolled back (--commit option not set)"
        )

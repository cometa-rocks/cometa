from __future__ import annotations

import datetime
from typing import Optional

from django.db import models
from django.utils.timezone import now


class ManagementCommandLog(models.Model):
    """Records the running of a management command."""

    EXIT_CODE_SUCCESS = 0
    EXIT_CODE_FAILURE = 1
    EXIT_CODE_PARTIAL = 2

    EXIT_CODE_CHOICES = (
        (EXIT_CODE_SUCCESS, "0 - Succeeded"),
        (EXIT_CODE_FAILURE, "1 - Failed"),
        (EXIT_CODE_PARTIAL, "2 - Partial"),
    )

    id = models.AutoField(primary_key=True)

    app_name = models.CharField(
        help_text="The app containing the management command", max_length=100
    )
    command_name = models.CharField(
        help_text="The management command that was executed", max_length=100
    )
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    exit_code = models.IntegerField(
        default=None,
        choices=EXIT_CODE_CHOICES,
        help_text="0 if the command ran without error.",
        null=True,
        blank=True,
    )
    output = models.TextField(
        default="",
        help_text="The output of the command (stored as a string)",
        blank=True,
    )
    parameters = models.JSONField(
        default=dict,
        blank=True,
        help_text="The parameters of the command (stored as a JSON)",
    )
    error = models.TextField(
        default="",
        help_text="Any error output captured",
        blank=True,
    )
    truncate_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp after which record can be safely deleted.",
    )

    def __str__(self) -> str:
        return f"{self.management_command} run at {self.started_at}"

    def __repr__(self) -> str:
        return (
            f"<{self.__class__.__name__} id={self.pk} "
            f'command="{self.management_command}">'
        )

    @property
    def management_command(self) -> str:
        return f"{self.app_name}.{self.command_name}"

    @property
    def duration(self) -> Optional[datetime.timedelta]:
        try:
            return self.finished_at - self.started_at
        except TypeError:
            return None

    def start(self) -> None:
        """Mark the beginning of a management command execution."""
        if any([self.started_at, self.finished_at, self.output, self.exit_code]):
            raise ValueError("Log object is already in use.")
        self.started_at = datetime.datetime.utcnow()
        self.save()

    def stop(
        self, *, output: str, exit_code: int, error: Optional[Exception] = None
    ) -> None:
        """Mark the end of a management command execution."""
        if not self.started_at:
            raise ValueError("Log object has not been started.")
        if any([self.finished_at, self.output, self.exit_code]):
            raise ValueError("Log object has already completed.")
        self.finished_at = datetime.datetime.utcnow()
        self.output = output
        self.error = str(error) if error else ""
        self.exit_code = exit_code
        self.save()

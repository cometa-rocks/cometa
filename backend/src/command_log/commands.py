import logging

from .management.commands.base import *  # noqa: F401,F403

logger = logging.getLogger(__name__)

logger.warning(
    "The command_log.commands modules has been deprecated; "
    "please use command_log.management.commands.* instead."
)

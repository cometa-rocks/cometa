"""
Python library with custom exceptions for Behave
"""

import traceback
import datetime


class PromptReferenceNotFound(Exception):
    pass


class PromptReferenceNameNotFound(Exception):
    pass


class PromptValueEmpty(Exception):
    pass


# ########################################################################## #
# CustomError exception #################################################### #
# this will help us in case if we want to fail the step without ############ #
# other exceptions ######################################################### #
# ########################################################################## #
class CustomError(Exception):
    def __init__(self, message, context=None):
        self.message = message
        self.context = context
        self.timestamp = datetime.datetime.now()

    def __str__(self):
        error_msg = f"CustomError: {self.message}"

        if self.context:
            error_msg += f"\nContext: {self.context}"

        # Add stacktrace
        if hasattr(self, '__traceback__') and self.__traceback__:
            stacktrace = ''.join(traceback.format_tb(self.__traceback__))
            error_msg += f"\nStacktrace:\n{stacktrace}"

        return error_msg

# ########################################################################## #
# CustomError exception #################################################### #
# this will help us in case if we want to fail the step without ############ #
# other exceptions ######################################################### #
# ########################################################################## #
class CometaElementNotFoundError(Exception):
    pass

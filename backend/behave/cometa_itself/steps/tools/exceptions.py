
"""
Python library with custom exceptions for Behave
"""

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
    pass
import os
from src.utility.common import get_logger
logger = get_logger()

# check if context has a variable
def error_handling(*_args, **_kwargs):
    def decorator(fn):
        def decorated(*args, **kwargs):
            try:
                result = fn(*args, **kwargs)
                return result
            except Exception as err:
                # print the traceback
                logger.debug("Found an error @%s function, please check the traceback: " % (fn.__name__))
                
                # fail the feature
                raise AssertionError(str(err))

        return decorated

    return decorator
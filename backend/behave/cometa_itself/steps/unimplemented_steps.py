from behave import step
import sys
from actions import (
    done,
    logger
)

# Ignores undefined steps
@step(u'{step}')
@done(u'{step}')
def step_imp(context, step):
    logger.error("Step is not implemented yet....")
    raise NotImplementedError(f"Unknown step found: '{step}'")
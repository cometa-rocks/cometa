# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from behave import (
    step,
    use_step_matcher
)
import sys, requests, re, json
sys.path.append('/opt/code/cometa_itself/steps')
from actions import (
    done,
    logger,
    addVariable
)
from tools.exceptions import CustomError
from tools.models import Condition

use_step_matcher("re")

# This step initiates a conditional "If" block to evaluate a comparison between two values. 
# The step supports multiple comparison operators such as equals, not equals, contains, >=, <=, etc.
# Based on the comparison result, it activates the conditional logic (e.g., proceeding to an 'Else' or 'End If').
#
# Parameters:
# - value1: (String|Number) The first value to be compared.
# - condition: (String) The operator for comparison. Supported conditions are:
#     - "equals"       -> Checks if value1 is equal to value2.
#     - "not equals"   -> Checks if value1 is not equal to value2.
#     - "contains"     -> Checks if value1 contains value2.
#     - "not contains" -> Checks if value1 does not contain value2.
#     - ">="           -> Checks if value1 is greater than or equal to value2.
#     - "<="           -> Checks if value1 is less than or equal to value2.
#     - "=="           -> Checks if value1 is equal to value2 (numeric comparison).
#     - "!="           -> Checks if value1 is not equal to value2 (numeric comparison).
# - value2: (String|Number) The second value for comparison.
#
# This step initiates a conditional "If" block to evaluate a comparison between two values. 
# Example:
# 1. If "5" ">=" "3"             -> True, condition is activated.
# 2. If "Hello World" "contains" "World" -> True, condition is activated.
# 3. If "10" "not equals" "20"   -> True, condition is activated.
@step(u'If "(?P<value1>.+?)" "(?P<condition>.+?)" "(?P<value2>.+?)"')
@done(u'If "{value1}" "{condition}" "{value2}"')
def start_if(context, value1, condition, value2):
    condition_result = False
    if condition == 'equals':
        condition_result = value1==value2
    if condition == 'not equals':
        condition_result = value1!=value2
    elif condition == 'contains':
        condition_result = value1.find(value2)>=0
    elif condition == 'not contains':
        condition_result = value1.find(value2)>=0
    elif condition == '>=':
        condition_result = float(value1)>=float(value2)
    elif condition == '<=':
        condition_result = float(value1)<=float(value2)
    elif condition == '==':
        condition_result = float(value1)==float(value2)
    elif condition == '!=':
        condition_result = float(value1)!=float(value2)
    
    condition = Condition(index=len(context.test_conditions_list))
    condition.set_condition(condition_result)
    context.test_conditions_list.append(condition)
    

# This step defines the 'Else' block within an If condition flow. 
# It allows for alternative execution when the "If" condition fails.
# Example:
# If "5" "==" "10"
#     <perform actions if true>
# Else
#     <perform actions if false>
@step(u'Else')
@done(u'Else')
def start_else(context):
    if len(context.test_conditions_list)==0:
        raise CustomError("Flow is not with in the If Condition")

    context.test_conditions_list[-1].activate_else_section()    


# This step marks the end of an "If-Else" conditional block. 
# It finalizes the condition and removes it from the active condition list.
# Example:
# If "5" ">=" "3"
#     <perform actions if true>
# Else
#     <perform actions if false>
# End If
@step(u'End If')
@done(u'End If')
def end_if(context):
    if len(context.test_conditions_list)==0:
        raise CustomError("Flow is not with in the If Condition")
        
    last_condition = context.test_conditions_list.pop()
    last_condition.close_condition()
    
    
use_step_matcher("parse")
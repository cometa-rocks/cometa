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
    

@step(u'Else')
@done(u'Else')
def start_else(context):
    if len(context.test_conditions_list)==0:
        raise CustomError("Flow is not with in the If Condition")

    context.test_conditions_list[-1].activate_else_section()    


@step(u'End If')
@done(u'End If')
def end_if(context):
    if len(context.test_conditions_list)==0:
        raise CustomError("Flow is not with in the If Condition")
        
    last_condition = context.test_conditions_list.pop()
    last_condition.close_condition()
    
    
use_step_matcher("parse")
# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from behave import (
    step,
    use_step_matcher
)
import sys, requests, re, json
sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")

from utility.functions import *

from tools.exceptions import *
from tools.common import send_step_details, uploadFileTarget
from tools.common_functions import *

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
        condition_result = value2 in value1
    elif condition == 'not contains':
        condition_result = value2 not in value1
    elif condition == '>=':
        condition_result = float(value1)>=float(value2)
    elif condition == '<=':
        condition_result = float(value1)<=float(value2)
    elif condition == '==':
        condition_result = float(value1)==float(value2)
    elif condition == '!=':
        condition_result = float(value1)!=float(value2)
        
    addTestRuntimeVariable(context, "First Value", value1, save_to_step_report=True)
    addTestRuntimeVariable(context, "Second Value", value2, save_to_step_report=True)
    addTestRuntimeVariable(context, "Condition Result", condition_result, save_to_step_report=True)
    
    condition = Condition(index=len(context.test_conditions_list))
    condition.set_condition(condition_result)
    # Let condition know if it is running with in the loop
    # This information will be used with condition will be used with in the if condition 
    condition.set_condition_with_in_loop(context.insideLoop)
    context.test_conditions_list.append(condition)
    

# This step defines the 'Else' block within an If condition flow. 
# It allows for alternative execution when the "If" condition fails.
#
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
    # Activate the last if condition else section
    # This done this way becase in future we want to have nested if conditions block, preparing list is a good idea for it
    context.test_conditions_list[-1].activate_else_section()    


# This step marks the end of an "If-Else" conditional block. 
# It finalizes the condition and removes it from the active condition list.
#
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
    logger.debug("Closing the if condition")
    last_condition = context.test_conditions_list.pop()    
    context.CURRENT_STEP_STATUS  = last_condition.get_condition_step_status("End If")
    # logger.debug(f"Step Status updated to {context.CURRENT_STEP_STATUS}")
    last_condition.close_condition()
    


# Example:
# 1. If "5" ">=" "3"             -> True, condition is activated.
# 2. If "Hello World" "contains" "World" -> True, condition is activated.
# 3. If "10" "not equals" "20"   -> True, condition is activated.
@step(u'Calculate "(?P<value1>.+?)" "(?P<operation>.+?)" "(?P<value2>.+?)" and store in the "(?P<variable>.+?)"')
@done(u'Calculate "{value1}" "{operation}" "{value2}" and store in the "{variable}"')
def arthmatic_calculations(context, value1, operation, value2, variable):
    except_operations =  ["+","-","*","/","//","**", "%"]
    operation = operation.strip()
    
    try:
        if not operation in except_operations:
            raise CustomError(f"Invalid operation selected, please use any of {', '.join(except_operations)}")
        
        calculation = None
        if "." in value1 or "." in value2:
            calculation = f"{float(value1)}{operation}{float(value2)}"
        else:
            calculation = f"{int(value1)}{operation}{int(value2)}"
        send_step_details(context, f"Calculating : {calculation}")
        result = eval(calculation)
        
        addTestRuntimeVariable(context, "Calculation", calculation, save_to_step_report=True )
        addTestRuntimeVariable(context, variable, result, save_to_step_report=True)

    except Exception as e:
        raise CustomError("Error while calculating",e)    
        



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
# Example:
# 1. If "5" ">=" "3"             -> True, condition is activated.
# 2. If "Hello World" "contains" "World" -> True, condition is activated.
# 3. If "10" "not equals" "20"   -> True, condition is activated.
# @step(u'Start For Loop from "(?P<start_index>.+?)" till "(?P<end_index>.+?)" change index by "(?P<increment_decrement>.+?)"')
# @step(u'Start For Loop from "{start_index}" till "{end_index}" change index by "{increment_decrement}"')
# def start_for_loop(context, start_index, end_index, increment_decrement):
    
#     context.current_loop = ForLoop(start_index, end_index, increment_decrement)
        
#     # check if there was an error during loop
#     err = False
#     # save substep index
#     subStepIndex = 0
    
#     all_steps = context.scenario.steps
#     current_step_index = context.counters['index']
#     # currentStepIndex = 
#     total_steps = len(all_steps)
    
#     count_inner_steps = current_step_index+1
    
#     # >= because last step index == total_steps-1
#     if count_inner_steps >= total_steps:
#         raise CustomError("Please close the loop properly using step 'End For Loop'")
    
    
#     try:
  
#         current_sub_step = all_steps[count_inner_steps]
#         # This condition is only required for the first iteration of the loop
#         if current_sub_step.name.strip() == "End For Loop":
#             logger.debug("No step found in between of the loop, will call the 'End For Loop' in next step")
#             return
#         logger.debug(f"current_step_index = {count_inner_steps}")
#         logger.debug(f"current_sub_step.name = {current_sub_step.name}")
#         # This is first iteration of the loop
        
#         while count_inner_steps < total_steps and context.current_loop.is_loop_condition_valid():
#             count_inner_steps +=1
#             logger.debug(f"Loading the inner step with count {count_inner_steps} : {current_sub_step.name}")
            
#             if current_sub_step.name.strip() == "End For Loop":
#                 if count_inner_steps > 1:
#                     logger.debug("End For Loop step found, will stop adding the steps")    
#                 else:
#                     logger.debug("No step found in between of the loop, will call the 'End For Loop' step")
#                 break
#             logger.debug(f"Adding to step list")
#             context.current_loop.add_step(current_sub_step)
#             send_step_details(context, "Executing step '%s' inside for loop." % current_sub_step.name)
#             context.execute_steps(current_sub_step.name)
#             # current_step_index = current_step_index+1
#             current_sub_step = all_steps[count_inner_steps]

#         increment_decrement = int(increment_decrement)
#         loop_index = int(start_index) + increment_decrement
#         end_index = int(end_index)
        
#         # This should start from the the second iteration of the loop
#         while loop_index <= end_index and context.current_loop.is_loop_condition_valid():
#             loop_index = loop_index + increment_decrement
#             logger.debug(f"Incrementing loop for index {loop_index}")
#             logger.debug(context.current_loop)
            
#             while context.current_loop.active_step_index < context.current_loop.get_total_steps() and context.current_loop.is_loop_condition_valid():                     
#                 current_sub_step = context.current_loop.get_current_step()
#                 send_step_details(context, "Executing step '%s' inside for loop." % current_sub_step.name)
#                 try:
#                     context.execute_steps(current_sub_step.name)
#                 except Exception as e:
#                     logger.exception(e)
#                 context.current_loop.increment_active_step_index()
            
#             context.current_loop.start_step_iteration()
            
#             if context.current_loop.is_loop_continued():
#                 logger.debug("setting loop back to normal to discontinued")
#                 context.current_loop.loop_not_continued_for_next_iteration()
            

#     except Exception as error:
#         err = True
#         err_msg = error
    
    
#     # update current step index to Loop again
#     # context.counters['index'] = currentStepIndex
#     # set jumpLoop value to steps count
#     context.jumpLoopIndex = context.current_loop.get_total_steps()
#     # remove 1 execution from executedStepsInLoop
#     context.executedStepsInLoop -= context.jumpLoopIndex

#     if err:
#         raise CustomError(err_msg)
        
            
    
#     # # get all the sub steps from text
#     # steps = context.text
#     # logger.debug(f"Steps to be executed {steps}")
#     # # set context.insideLoop to true
#     # context.insideLoop = True
#     # # set executedStepsInLoop value
#     # context.executedStepsInLoop = 0
#     # # match regexp to find steps and step descriptions
#     # steps = list(filter(None, re.findall(r".*\n?(?:\t'''(?:.|\n)+?'''\n?)?", steps)))
#     # logger.debug(f"list of test_steps : {steps}")
#     # try:
#     #     logger.debug("Steps: {}".format(steps))
#     #     for i in range(int(index), int(x) + int(index)):
#     #         logger.debug(f"With in the loop-Step {i}")
#     #         # update subStepIndex to currentStepIndex
#     #         subStepIndex = currentStepIndex
#     #         # add a index variable to context.JOB_PARAMETERS
#     #         params = json.loads(context.PARAMETERS)
#     #         params['index'] = i
#     #         context.PARAMETERS = json.dumps(params)
#     #         for step in steps:
#     #             logger.debug("Executing step: {}".format(step))
#     #             # update steps executed
#     #             context.executedStepsInLoop += 1
#     #             # update subStepIndex with +1 on each step
#     #             subStepIndex = subStepIndex + 1
#     #             # update stepIndex with subStepIndex
#     #             context.counters['index'] = subStepIndex
#     #             # replace ''' to """
#     #             step = step.replace("'''", "\"\"\"")
#     #             # print some information
                
#     #             # execute the step
#     #             context.execute_steps(step)
#     #     logger.debug("Out of the loop")
#     # except Exception as error:
#     #     err = True
#     #     err_msg = error

#     # # update current step index to Loop again
#     # context.counters['index'] = currentStepIndex
#     # # set jumpLoop value to steps count
#     # context.jumpLoopIndex = len(steps)
#     # # remove 1 execution from executedStepsInLoop
#     # context.executedStepsInLoop -= context.jumpLoopIndex

#     # if err:
#     #     raise CustomError(err_msg)

    
    
    
#     # condition_result = False
#     # if condition == 'equals':
#     #     condition_result = value1==value2
#     # if condition == 'not equals':
#     #     condition_result = value1!=value2
#     # elif condition == 'contains':
#     #     condition_result = value1.find(value2)>=0
#     # elif condition == 'not contains':
#     #     condition_result = value1.find(value2)>=0
#     # elif condition == '>=':
#     #     condition_result = float(value1)>=float(value2)
#     # elif condition == '<=':
#     #     condition_result = float(value1)<=float(value2)
#     # elif condition == '==':
#     #     condition_result = float(value1)==float(value2)
#     # elif condition == '!=':
#     #     condition_result = float(value1)!=float(value2)
        
#     # addTestRuntimeVariable(context, "First Value", value1, save_to_step_report=True)
#     # addTestRuntimeVariable(context, "Second Value", value2, save_to_step_report=True)
#     # addTestRuntimeVariable(context, "Condition Result", condition_result, save_to_step_report=True)
    
#     # condition = Condition(index=len(context.test_conditions_list))
#     # condition.set_condition(condition_result)
#     # context.test_conditions_list.append(condition)
    

# # This step defines the 'Else' block within an If condition flow. 
# # It allows for alternative execution when the "If" condition fails.
# #
# # Example:
# # If "5" "==" "10"
# #     <perform actions if true>
# # Else
# #     <perform actions if false>
# # @step(u'Else')
# # @done(u'Else')
# # def start_else(context):
# #     if len(context.test_conditions_list)==0:
# #         raise CustomError("Flow is not with in the If Condition")

# #     context.test_conditions_list[-1].activate_else_section()    


# # This step marks the end of an "If-Else" conditional block. 
# # It finalizes the condition and removes it from the active condition list.
# #


# @step(u'Continue For Loop')
# @done(u'Continue For Loop')
# def continue_for_loop(context):
#     context.current_loop.continue_loop()
#     send_step_details(context, "For loop will be continued, rest of the step will be skipped")
#     logger.debug("For loop will be continued, rest of the step will be skipped")

# @step(u'Break For Loop')
# @done(u'Break For Loop')
# def break_loop(context):
#     context.current_loop.break_loop()
#     send_step_details(context, "For loop breaked")
#     logger.debug("For loop breaked")


# @step(u'End For Loop')
# @done(u'End For Loop')
# def end_loops(context):
#     send_step_details(context, "For loop completed")
#     context.current_loop = None
    


# use_step_matcher("parse")




import logging


# setup logging
logger = logging.getLogger("FeatureExecution")


def is_step_conditional_statement(step):
    step_name :str = step.name
    conditional_steps = ("End If", "Else")
    return step_name.startswith(conditional_steps)

def check_if_step_should_execute(context):
    step = context.CURRENT_STEP   
    should_execute_step = True
    # Check if test flow is with in the condition
    if len(context.test_conditions_list) > 0:
        current_condition = context.test_conditions_list[-1]
        logger.debug(f"Current condition values : {current_condition}")
        # Check if current step is not conditional statement
        if not is_step_conditional_statement(step):
            logger.debug(f"Step {step.name} is with in the if condition")
            
            # When a condition is true and current step lies with in the If section then execute the current step
            if current_condition.is_condition_true() and not current_condition.is_else_section_active():
                logger.debug(f"Step \"{step.name}\" will be executed with in the if section")
                should_execute_step = True
            # When a condition is false and current step lies with in the If section then skip the current step execution
            elif not current_condition.is_condition_true() and not current_condition.is_else_section_active():
                logger.debug(f"Step \"{step.name}\" will be skipped with in the if section")
                should_execute_step = False

            # When condition is false and current step lies with in the else section then execute the current step
            elif not current_condition.is_condition_true() and current_condition.is_else_section_active():
                logger.debug(f"Step \"{step.name}\" will be executed with in the else section")
                should_execute_step = True
            # When condition is true and current step lies with in the else condition then skip the current step execution
            elif current_condition.is_condition_true() and current_condition.is_else_section_active():
                logger.debug(f"Step \"{step.name}\" will be skipped with in the else section")
                should_execute_step = False
        else:
            logger.debug("Executing step without any condition check")
            should_execute_step = True        
    
    return should_execute_step

class Condition:
    def __init__(self, index):
        self.index = index
        # if condition is True and not over if mean it is in the if section
        # if condition is False and not over it mean it is in the else section
        self._is_condition_true = True
        self._is_else_section_active = False
        self._is_condition_over = False
        self._sub_conditions: list[Condition]  = []
        
    def set_condition(self, condition_result):
        self._is_condition_true = condition_result
                
    def is_condition_true(self):
        return self._is_condition_true
        
    def close_condition(self):
        self._is_condition_over = True

    def is_flow_with_in_condition(self):
        return self._is_condition_over

    def activate_else_section(self):
        self._is_else_section_active = True
    
    def is_else_section_active(self):
        return self._is_else_section_active
    
    def __str__(self):
        return f"\n _is_condition_true : {self._is_condition_true}, \
            \n is_else_section_active: {self._is_else_section_active}, \
                \n is_condition_over: {self._is_condition_over}, \
                    \n count_of_sub_conditions: {len(self._sub_conditions)}"
   

# Not in use as of now, Implementation In progress        # 
class ForLoop:
    def __init__(self, start_index, end_index, increment_decrement):
        self.start_index = start_index
        self.end_index = end_index
        self.increment_decrement = increment_decrement
        self.active_step_index = 0
        self.__inner_steps = []
        self.__sub_loops: list[Condition] = []
        self.__is_loop_breaked = False
        self.__is_loop_continued = False
        self.__is_loop_over = False
    
    # Insert records of steps to have list of steps executed
    def add_step(self, step):
        self.__inner_steps.append(step)

    def get_current_step(self):
        return self.__inner_steps[self.active_step_index]

    def get_all_steps(self):
        return self.__inner_steps

    def get_total_steps(self):
        return len(self.__inner_steps)
    
    # This method increases the index for the active indexs
    def increment_active_step_index(self):
        self.active_step_index = self.active_step_index + 1

    # set the step iteration to 0 to start the steps execution again
    def start_step_iteration(self):
        self.active_step_index = 0
                
    def break_loop(self):
        self.__is_loop_breaked = True

    def is_loop_breaked(self):
        return self.__is_loop_breaked 
        
    # To continue the loop set the __active_step_index to the last step with in the loop
    def continue_loop(self):
        self.__is_loop_continued = True
        self.active_step_index = len(self.__inner_steps)-1

    def is_loop_continued(self):
        return self.__is_loop_continued

    def loop_not_continued_for_next_iteration(self):
        self.__is_loop_continued = False
        
    def close_loop(self):
        self.__is_loop_over = True

    def is_flow_with_in_loop(self):
        return self.__is_loop_over

    def change_index(self, increment_decrement):
        self.start_index = self.start_index + increment_decrement
    
    def apply_increment_decrement(self):
        self.start_index = self.start_index + self.increment_decrement
        
    def is_loop_condition_valid(self):
        return self.start_index <= self.end_index and not self.is_loop_breaked() and not self.is_loop_continued()
    
    def __str__(self) -> str:
        return f"""start_index {self.start_index},  end_index {self.end_index}, increment_decrement {self.increment_decrement},
                     active_step_index {self.active_step_index}, total_steps {self.get_total_steps()}, continued {self.is_loop_continued()}, break {self.is_loop_breaked()}, loop_condition_valid {self.is_loop_condition_valid()}"""
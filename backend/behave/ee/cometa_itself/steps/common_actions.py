import base64
import time
import logging
import json
import sys
import sys, requests, re, json

import jq

from behave import step, use_step_matcher

sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")

from utility.functions import *

from tools.exceptions import *
from tools.common import send_step_details
from tools.common_functions import *


# setup logging
logger = logging.getLogger("FeatureExecution")





# This step displays the value of a variable_name at runtime and in the browser screen as well for a given seconds amount of time.
# The popup will disappear after the specified number of seconds.
# Example: Show me variable "user_details" value for "10" seconds
@step(u'Show me variable "{variable_name}" value for "{seconds}" seconds')
@done(u'Show me variable "{variable_name}" value for "{seconds}" seconds')
def show_variable_value(context, variable_name, seconds):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    # Assuming getVariable is a function that retrieves the variable value
    variable_value = getVariable(context, variable_name) 
    send_step_details(context, f"{variable_name} : {variable_value}")    
    # Define the variable type (implement the logic as needed)
    variable_type = type(variable_value).__name__  # You can replace this with your own logic
    if variable_type!='str':
        variable_value = json.dumps(variable_value)  # Convert the value to JSON format
    try:
        if context.browser: 
        # Use old-style string formatting (%s) with escaped % symbols for the JavaScript code
            script = """
            // Function to invoke the div and display JSON content
            function invokeDiv() {
                // Create a container element (div)
                const container = document.createElement('div');
                container.style.position = 'fixed';
                container.style.top = '18%%';  // Place it at the top of the viewport
                container.style.marginLeft = '14%%';
                container.style.width = '70%%';
                container.style.minHeight = '200px';
                container.style.border = '10px solid';
                container.style.borderRadius = '6px';
                container.style.padding = '1%%';
                container.style.fontFamily = 'system-ui';
                container.style.color = 'black';
                container.style.background = 'rgb(240, 240, 240)';  // A light gray background for visibility
                container.style.zIndex = '1000';  // High z-index to make it visible at top

                // Create an inner div to hold the JSON content
                const contentDiv = document.createElement('div');
                contentDiv.style.padding = '20px';
                contentDiv.style.width = '100%%';  // Make sure the inner div takes up the full width of its container

                // Populate the content div with JSON data (in a simple format)
                const jsonContent = `
                    <h2>Cometa Runtime Variable</h2>
                    <p><b>Variable Name:</b> %s</p>
                    <p><b>Variable Value:</b> %s</p>
                    <p><b>Variable Type:</b> %s</p>
                `;

                contentDiv.innerHTML = jsonContent;

                // Add the content div to the container
                container.appendChild(contentDiv);

                // Append the container to the body of the document
                document.body.appendChild(container);

                // After disappearTime seconds, remove the container from the DOM
                setTimeout(() => {
                    container.remove();
                }, %s * 1000 + 500);  // Multiply by 1000 to convert seconds to milliseconds
            }

            // Invoke the function
            invokeDiv();
        """ % (variable_name, variable_value, variable_type, seconds)

            context.browser.execute_script(script)
    except Exception as e:
        logger.exception("Exception while showing value in browser", e)
        
        
    time.sleep(int(seconds))




use_step_matcher("re")


# Assert api request and response data using JQ patterns. Please refer JQ documentation https://jqlang.github.io/jq/manual/
# jq_pattern is a JSON path that can also be combined with conditions to perform assertions,
@step(u'Fetch value using \"(?P<jq_pattern>.*?)\" from "(?P<variable_name>.+?)" and store in "(?P<new_variable_name>.+?)"')
@done(u'Fetch value using "{jq_pattern}" from "{variable_name}" and store in "{new_variable_name}"')
def assert_imp(context, jq_pattern, variable_name, new_variable_name):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE

    variable_value = getVariable(context, variable_name) 
    logger.debug(variable_value)
    try:
        parsed_value = jq.compile(jq_pattern).input(variable_value).text()
        addTestRuntimeVariable(context, new_variable_name, parsed_value, save_to_step_report=True)
    except Exception as err:
        logger.error("Invalid JQ pattern", err)
        raise CustomError(err)
        

use_step_matcher("parse")


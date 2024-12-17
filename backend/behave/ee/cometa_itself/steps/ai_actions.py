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


def convert_ai_answer_to_json(ai_answer, use_regex=True):
    logger.debug(f"Converting {ai_answer} to json")
    # Replace escaped newlines and backslashes

    formatted_string = ai_answer.encode().decode("unicode_escape")

    json_containing_pattern = r"```(.*?)```"
    json_string = formatted_string.replace("json", "")
    if use_regex:
        # Find all matches
        matches = re.findall(json_containing_pattern, json_string, re.DOTALL)
        if len(matches)>0:
            json_string = matches[0]
    
    return json.loads(json_string)


def feature_cannot_be_used_error():
    raise CustomError(
        "AI features cannot be used because this Cometa installation does not have the AI feature enabled."
    )

use_step_matcher("re")


# This step validates whether the current screen contains a specific object, with an optional set of conditions (options).
# Parameters:
# - object_name: The name of the object that should be present on the screen.
# - options: (Optional) Additional options or conditions that can refine the validation. This part is optional, meaning it can be omitted in the Gherkin step.   
# Example Usages:
# - Validate current screen to contain "Car"
# - Validate current screen to contain "Car" with "color:red"
# In the second case, the additional option "fullscreen" will be captured and used in the step logic.
@step(u'Validate current screen to contain \"(?P<object_name>.*?)\"(?: with \"(?P<options>.*?)\")?')
@done(u'Validate current screen to contain "{object_name}" with "{options}"')
def validate_screen_using_ai(context, object_name, options):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    if not context.COMETA_AI_ENABLED:
        feature_cannot_be_used_error()

    image_decoded_data = get_screenshot_bytes_from_screen(context)

    if not image_decoded_data:
        raise CustomError(f"Could not take screenshot")

    # Define the two dictnary in the data
    # first one should containe the image data to get information from the image
    # and based on second content it will provide the answer in json for the validation
    data = [
        {
            "content": f"Explain everything that you see about the {object_name}" + "" if not options else f"put focus on {options}",
            "images": [image_decoded_data],
        },
        {
            "content": "Based on the above answer, give me the response only in JSON format. The keys should be 'has_object', and the value should be a boolean."
        },
    ]
    logger.debug("Will analyze data")
    send_step_details(context, "Analyzing screen")
    is_success, response = context.ai.analyze_image(context, data)
    logger.debug(response)
    if not is_success:
        raise CustomError(
            f'The AI server could not complete the analysis and failed with the error: "{response[1]}"'
        )
        
    json_response = convert_ai_answer_to_json(response)
    logger.debug(json_response)
    if not json_response.get("has_object", False):
        raise CustomError(f"{object_name} did not appear on the screen")



# This step retrieves the list of visible objects on the current screen and stores it in the specified variable, 
# with an optional set of conditions (options) that can alter the behavior of the retrieval.
# Parameters:
# - variable: The name of the variable in which to store the list of visible objects.
# - options: (Optional) Additional options or filters that may refine the list of objects to be retrieved. This is optional in the Gherkin step.
# Regular Expression Breakdown:
# - (?P<variable>.*?): Captures the name of the variable where the list of objects will be stored.
# - (?: with "(?P<options>.*?)")?: This part is optional.
# Example Usages:
# - Get list of visible objects in the current screen and store in "myObjects"
# - Get list of visible objects in the current screen and store in "myObjects" with "visible_only"
# The first usage stores the visible objects without any specific options, while the second one applies the "visible_only" option.
@step(u'Get list of visible objects in the current screen and store in "(?P<variable>.*?)"(?: with "(?P<options>.*?)")?')
@done(u'Get list of visible objects in the current screen and store in "{variable}" with "{options}"')
def get_list_of_visible_objects_in_the_screen(context, variable, options):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    if not context.COMETA_AI_ENABLED:
        feature_cannot_be_used_error()

    image_decoded_data = get_screenshot_bytes_from_screen(context)

    if not image_decoded_data:
        raise CustomError(f"Could not take screenshot")

    # Define the two dictnary in the data
    # first one should containe the image data to get information from the image
    # and based on second content it will provide the answer in json for the validation
    data = [
        {
            "content": f"Explain everything that you see in the image, " + "" if not options else f"focus on {options}",
            "images": [image_decoded_data],
        },
        {
            "content": """Based on the above answer, 
            prepare a list of object names and provide the answer in JSON list, do not use any formatting
            JSON list should be in the form of [object_name1,object_name2,object_name3,...]
            """
        },
    ]

    logger.debug("Will analyze data")
    send_step_details(context, "Analyzing screen")
    is_success, response = context.ai.analyze_image(context, data)
    logger.debug(response)

    if not is_success:
        raise CustomError(
            f'The AI server could not complete the analysis and failed with the error: "{response}"'
        )
    json_response = convert_ai_answer_to_json(response)
    logger.debug(json_response)

    addTestRuntimeVariable(context, variable, json_response)


@step(u'Get screenshot and store in the variable \"(?P<variable_name>.*?)\"')
@done(u'Get screenshot and store in the variable "{variable_name}"')
def get_screen_shot(context, variable_name):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    screenshot_bytes = get_screenshot_bytes_from_screen(context)
    addTestRuntimeVariable(context, variable_name, screenshot_bytes)
    
    

# Assert the variable's value by providing variable_name, jq_pattern, condition (match|contain), and value using JQ patterns. Refer to the JQ documentation: https://jqlang.github.io/jq/manual/
# The jq_pattern is a JSON path that can be combined with conditions to perform assertions.
@step(u'Assert variable \"(?P<variable_name>.*?)\" using jq_pattern \"(?P<jq_pattern>.*?)\" to "(?P<condition>match|contain)" \"(?P<value>.*?)\"')
@done(u'Assert variable "{variable_name}" using jq_pattern "{jq_pattern}" to "{condition}" "{value}"')
def assert_imp(context, variable_name, jq_pattern, condition, value):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    variable_value = getVariable(context, variable_name) 
    try:
        parsed_value = jq.compile(jq_pattern).input(variable_value).text()
    except Exception as err:
        logger.error("Invalid JQ pattern")
        logger.exception(err)
        parsed_value = ""
    
    assert_failed_error = f"{parsed_value} ({jq_pattern}) does not { condition } {value}"
    assert_failed_error = logger.mask_values(assert_failed_error)
    
    if condition == "match":
        assert parsed_value == value, assert_failed_error
    else:
        assert value in parsed_value, assert_failed_error


# Assert variable value by providing 'variable_name', 'condition(match|contain)' and exepected 'value'
@step(u'Assert variable \"(?P<variable_name>.*?)\" to "(?P<condition>match|contain)" \"(?P<value>.*?)\"')
@done(u'Assert variable "{variable_name}" to "{condition}" "{value}"')
def assert_imp(context, variable_name, condition, value):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    variable_value = getVariable(context, variable_name) 
    
    assert_failed_error = f"{variable_name} does not { condition } {value}"
    assert_failed_error = logger.mask_values(assert_failed_error)
    
    if condition == "match":
        assert variable_value == value, assert_failed_error
    else:
        assert value in variable_value, assert_failed_error




# This step retrieves information based on the specified context and stores it in a variable. 
# An optional set of options can be provided to modify the output format (e.g., JSON conversion).
# Parameters:
# - user_message_to_ai: (String) A JSON-like list that serves as input for the AI model, guiding what analysis to perform.
#     Example structure of the input JSON list:
#     [
#         {
#             "content": "
#               Explain everything that you see in the image." if not options else f"focus on {options}.
#               prepare a list of object names and provide the answer in JSON list, JSON list should be in the form of [object_name1, object_name2, object_name3, ...]           
#               ",
#             "images": [image1, image2, ...],
#         }
#     ]
#     - The 'content' field describes the action the AI model should perform, such as analyzing images or generating object lists.
#     - The 'images' field refers to placeholders for image variables that will be dynamically replaced with actual image data (screenshots).
# - variable: (String) The name of the variable where the AI analysis output will be stored.
# - options: (String) (Optional) Modifies how the analysis result is processed. For example, if 'Output JSON' is provided,
#     the result will be converted to a JSON format before being stored.
@step(u'Get information based on """(?P<user_message_to_ai>[\s\S]*?)""" and store in the "(?P<variable>.*?)"(?: with "(?P<option>.*?)")?')
@done(u'Get information based on """{user_message_to_ai}""" and store in the "{variable}" with "{option}"')
def ai_analyze(context, user_message_to_ai, variable, option):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    if not context.COMETA_AI_ENABLED:
        feature_cannot_be_used_error()
    user_messages = user_message_to_ai.encode().decode("unicode_escape")
    logger.debug(user_messages)
    user_messages = json.loads(user_messages)
    
    logger.debug(user_messages)
    
    for message in user_messages:
        if 'images' in message.keys():
            # Ensure the number of image placeholders matches the number of screenshot variable names
            for i in range(len(message['images'])):
                message['images'][i] = getVariable(context, message['images'][i])
                # message['images'][i] = get_screenshot_bytes_from_screen(context)
    
    logger.debug(f"length : {len(user_messages)}")
    
    send_step_details(context, "Analyzing user message")
    is_success, response = context.ai.analyze_image(context, user_messages)
    send_step_details(context, "Analysis done")
    logger.debug(response)
    if not is_success:
        raise CustomError(
            f'The AI server could not complete the analysis and failed with the error: "{response}"'
        )
        
    if option=='Output JSON':
        response = convert_ai_answer_to_json(response)
        logger.debug(response)

    addTestRuntimeVariable(context, variable, response)



# This step retrieves information from current screen based on the given prompt and stores it in a variable. 
# An optional set of option can be provided to modify the output format (e.g., JSON conversion).
# Parameters:
# - prompt: (String) Explain everything that you see in the image.
# - variable: (String) The name of the variable where the AI analysis output will be stored.
# - option: (String) (Optional) Modifies how the analysis result is processed. For example, if 'Output JSON' is provided,
#            if option "Output JSON" is provided the result will be converted to a JSON format before it is stored in the variable.
@step(u'Get information based on """(?P<prompt>[\s\S]*?)""" from current screen and store in the "(?P<variable>.*?)"(?: with "(?P<option>.*?)")?')
@done(u'Get information based on """{prompt}""" from current screen and store in the "{variable}" with "{option}"')
def get_information_from_current_screen_based_on_prompt(context, prompt, variable, option):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    if not context.COMETA_AI_ENABLED:
        feature_cannot_be_used_error()
    
    image_decoded_data = get_screenshot_bytes_from_screen(context)

    if not image_decoded_data:
        raise CustomError(f"Could not take screenshot")

    # Define the two dictnary in the data
    # first one should containe the image data to get information from the image
    # and based on second content it will provide the answer in json for the validation
    data = [
        {
            "content": f"""
            ## Provide information about the image based on description given below 
            {prompt}
            """,
            "images": [image_decoded_data],
        }
    ]

    logger.debug("Will analyze data")
    send_step_details(context, "Analyzing screen")
    is_success, response = context.ai.analyze_image(context, data)
    logger.debug(response)

    if not is_success:
        raise CustomError(
            f'The AI server could not complete the analysis and failed with the error: "{response}"'
        )
    logger.debug(response)
    
    # json_response = convert_ai_answer_to_json()
    # logger.debug(json_response)
    # output = response[1]

    if option=='Output JSON':
        response = convert_ai_answer_to_json(response)
        logger.debug(response)

    addTestRuntimeVariable(context, variable, response)


use_step_matcher("parse")

    
# This step displays the value of a variable_name at runtime and in the browser screen as well for a given seconds amount of time.
# The popup will disappear after the specified number of seconds.
@step(u'Show me variable "{variable}" value for "{seconds}" seconds')
@done(u'Show me variable "{variable}" value for "{seconds}" seconds')
def show_variable_value(context, variable, seconds):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    # Assuming getVariable is a function that retrieves the variable value
    variable_value = getVariable(context, variable) 
    send_step_details(context, f"{variable} : {variable_value}")    
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
                container.style.top = '28%%';  // Place it at the top of the viewport
                container.style.marginLeft = '24%%';
                container.style.width = '50%%';
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
        """ % (variable, variable_value, variable_type, seconds)

            context.browser.execute_script(script)
    except Exception as e:
        logger.exception("Exception while showing value in browser", e)
        
        
    time.sleep(int(seconds))



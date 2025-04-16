import base64
import time
import logging
import json
import sys, requests, re, json, traceback, html
import jq
import asyncio
import concurrent.futures
import threading

from behave import step, use_step_matcher
from browser_use import Agent, Browser, BrowserConfig, Controller
from langchain_openai import ChatOpenAI

sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")

from utility.functions import *
from utility.configurations import ConfigurationManager

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


def ai_feature_cannot_be_used_error():
    raise CustomError(
        "AI based testing features cannot be used because this Cometa subscription. Please contact your administrator to enable AI features."
    )

use_step_matcher("re")


# This step validates whether the current screen contains a specific object, with an optional set of conditions (options).
# Parameters:
# - object_name: The name of the object that should be present on the screen.
# - options: (Optional) Additional options or conditions that can refine the validation. This part is optional, meaning it can be omitted in the Gherkin step.   
# Example:
# - Validate current screen to contain "Car"
# - Validate current screen to contain "Car" with "color:red"
# In the second case, the additional option "fullscreen" will be captured and used in the step logic.
@step(u'Validate current screen to contain \"(?P<object_name>.*?)\"(?: with \"(?P<options>.*?)\")?')
@done(u'Validate current screen to contain "{object_name}" with "{options}"')
def validate_screen_using_ai(context, object_name, options):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    if not context.COMETA_AI_ENABLED:
        ai_feature_cannot_be_used_error()

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
# Example:
# - Get list of visible objects in the current screen and store in "myObjects"
# - Get list of visible objects in the current screen and store in "myObjects" with "visible_only"
# The first usage stores the visible objects without any specific options, while the second one applies the "visible_only" option.
@step(u'Get list of visible objects in the current screen and store in "(?P<variable>.*?)"(?: with "(?P<options>.*?)")?')
@done(u'Get list of visible objects in the current screen and store in "{variable}" with "{options}"')
def get_list_of_visible_objects_in_the_screen(context, variable, options):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    if not context.COMETA_AI_ENABLED:
        ai_feature_cannot_be_used_error()

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

# Captures a screenshot of the current screen and stores it in a variable.
# Example: Get screenshot and store in the variable "screenshot_data"
@step(u'Get screenshot and store in the variable \"(?P<variable_name>.*?)\"')
@done(u'Get screenshot and store in the variable "{variable_name}"')
def get_screen_shot(context, variable_name):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    screenshot_bytes = get_screenshot_bytes_from_screen(context)
    addTestRuntimeVariable(context, variable_name, screenshot_bytes)
    
    

# Assert the variable's value by providing variable_name, jq_pattern, condition (match|contain), and value using JQ patterns. Refer to the JQ documentation: https://jqlang.github.io/jq/manual/
# The jq_pattern is a JSON path that can be combined with conditions to perform assertions.
# Example: Assert variable "response_data" using jq_pattern ".status" to "match" "success"
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
# Example: Assert variable "status_code" to "match" "200"
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
# Example: Get information based on the input message and store it in a variable.
# Get information based on """
# [
#     {
#         "content": "Explain everything you see in the image.",
#         "images": ["screenshot1"]
#     }
# ]
# """ and store in the "analysis_result"
@step(u'Get information based on """(?P<user_message_to_ai>[\s\S]*?)""" and store in the "(?P<variable>.*?)"(?: with "(?P<option>.*?)")?')
@done(u'Get information based on """{user_message_to_ai}""" and store in the "{variable}" with "{option}"')
def ai_analyze(context, user_message_to_ai, variable, option):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    if not context.COMETA_AI_ENABLED:
        ai_feature_cannot_be_used_error()
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
# Example: Get information from the screen and store it in a variable.
# Get information based on """
# Explain everything that you see in the image.
# """ from current screen and store in the "screen_analysis"
@step(u'Get information based on """(?P<prompt>[\s\S]*?)""" from current screen and store in the "(?P<variable>.*?)"(?: with "(?P<option>.*?)")?')
@done(u'Get information based on """{prompt}""" from current screen and store in the "{variable}" with "{option}"')
def get_information_from_current_screen_based_on_prompt(context, prompt, variable, option):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    if not context.COMETA_AI_ENABLED:
        ai_feature_cannot_be_used_error()
    
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
    if not is_success:
        raise CustomError(
            f'The AI server could not complete the analysis and failed with the error: "{response}"'
        )

    if option=='Output JSON':
        response = convert_ai_answer_to_json(response)
        logger.debug(response)
    addTestRuntimeVariable(context, variable, response)


# This step executes the browser-use action based on the given prompt.
# Parameters:
# - prompt: (String) The prompt that specifies the action
# Example Usage:
# Execute AI agent action "Navigate to https://www.google.com and search for 'Cometa Rocks'"
@step(u'Execute AI agent action "(?P<prompt>[\s\S]*?)"')
@done(u'Execute AI agent action "{prompt}"')
def execute_ai_action(context, prompt):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
     
    try:
        # Verify AI features are enabled in the environment
        if not context.COMETA_AI_ENABLED:
            ai_feature_cannot_be_used_error()

        logger.debug("Executing AI action")
        logger.debug(f"Prompt: {prompt}")
        send_step_details(context, "Executing Browser-Use action with prompt: " + prompt)

        controller = Controller()

        # Get the CDP URL based on browser connection mode
        if context.USE_COMETA_BROWSER_IMAGES:
            logger.debug("Using custom Cometa browser image mode")
            # Need to query the browser status endpoint to get the CDP URL
            status_check_connection_url = f"http://{context.browser_hub_url}:4444/status"
            logger.debug(f"Checking browser status at: {status_check_connection_url}")
            
            response = requests.get(status_check_connection_url)
            if response.status_code != 200:
                raise CustomError("Error while fetching the CDP URL")
                
            response_json = response.json()
            nodes = response_json['value']['nodes']
            if len(nodes) == 0:
                raise CustomError("Browser selenium session was closed")
                
            cdp_url = nodes[0]['slots'][0]['session']['capabilities']['se:cdp']
            logger.debug(f"Retrieved CDP URL from browser capabilities: {cdp_url}")
        else:
            logger.debug("Using standard Selenoid browser image mode")
            cdp_url = f"ws://{context.browser_hub_url}:4444/devtools/{context.browser.session_id}"
            logger.debug(f"Constructed CDP URL using session ID: {cdp_url}")

        # Create the browser with the appropriate CDP URL
        browser_config = BrowserConfig(
            cdp_url=cdp_url,
        )
        browser = Browser(config=browser_config)

        # Get OpenAI API key from configuration
        COMETA_OPENAI_API_KEY = ConfigurationManager.get_configuration("COMETA_OPENAI_API_KEY", "")

        if COMETA_OPENAI_API_KEY is None:
            raise ValueError("OpenAI API key is not set in environment variables")
        if not isinstance(COMETA_OPENAI_API_KEY, str):
            raise ValueError("OpenAI API key must be a string")
        if not COMETA_OPENAI_API_KEY.strip():
            raise ValueError("OpenAI API key cannot be empty or whitespace")
        if not COMETA_OPENAI_API_KEY.startswith("sk-"):
            raise ValueError("Invalid OpenAI API key format (should start with 'sk-')")

        step_timeout = context.step_data.get("timeout", 600)

        # Create the agent
        agent = Agent(
            task=prompt,
            llm=ChatOpenAI(
                model="gpt-4o",
                temperature=0.0,
                api_key=COMETA_OPENAI_API_KEY,
            ), 
            browser=browser,
            controller=controller,
            use_vision=False,
        )
        
        # Create a new event loop in a separate thread to run the agent
        def run_agent_in_thread(agent, max_steps):
            # Create a new event loop for this thread
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            
            try:
                # Run the agent in this new loop
                return loop.run_until_complete(agent.run(max_steps=max_steps))
            finally:
                loop.close()
        
        # Run the agent in a separate thread
        logger.debug("Running agent in a separate thread")
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(run_agent_in_thread, agent, 25)
            try:
                # Wait for the agent to complete with a timeout
                result = future.result(timeout=step_timeout)
                logger.debug(f"Agent execution completed: {result}")
            except concurrent.futures.TimeoutError:
                logger.error("Agent execution timed out after timeout: " + str(step_timeout))
                raise TimeoutError("Browser-use agent timed out")
        
        # Process the results
        logger.debug("Received agent response: %s", result)
        logger.debug(f"Agent response type: {type(result)}")
        
        if hasattr(result, "model_outputs"):
            logger.debug(f"Model outputs: {result.model_outputs()}")
        if hasattr(result, "action_results"):
            logger.debug(f"Action results: {result.action_results()}")
        if hasattr(result, "errors"):
            logger.debug(f"Errors: {result.errors()}")
        
        if hasattr(result, "is_done") and result.is_done():
            final_result = result.final_result() if hasattr(result, "final_result") else None
            if final_result:
                logger.debug("Browser-use task completed successfully with result: %s", final_result)
                return {"success": True, "result": final_result}
            else:
                logger.error("Task completed but no final result was returned")
                return {"success": False, "error": "Task completed but no final result was returned."}
        else:
            model_outputs = result.model_outputs() if hasattr(result, "model_outputs") else []
            action_results = result.action_results() if hasattr(result, "action_results") else []
            logger.debug(f"##################3 result: {result}")
            if not action_results and not model_outputs:
                error_details = "Agent failed to execute any actions"
                logger.error(error_details)
            else:
                error_details = result.errors() if hasattr(result, "errors") else "Unknown error"
                logger.error(error_details)
            raise AssertionError(error_details)
    
    except Exception as e:
        # Log any unexpected errors and store for reporting
        logger.exception("Exception while executing browser-use step: %s", str(e))
        context.STEP_ERROR = str(e)
        send_step_details(context, f"Error: {str(e)}")
        raise


use_step_matcher("parse")

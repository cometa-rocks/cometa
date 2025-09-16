import base64
import time
# import logging
import json
import sys, requests, re, json, traceback, html
import jq

import os, logging

from langchain_openai import ChatOpenAI


from behave import step, use_step_matcher

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


# Parameters:
# - object_name: The name of the object that should be present on the screen.
# - options: (Optional) Additional options or conditions that can refine the validation. This part is optional, meaning it can be omitted in the Gherkin step. 
#  
# This step validates whether the current screen contains a specific object, with an optional set of conditions (options).
# In the second case, the additional option "fullscreen" will be captured and used in the step logic.
# Example:
# Validate current screen to contain "Car"
# Validate current screen to contain "Car" with "color:red"
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



# Parameters:
# - variable: The name of the variable in which to store the list of visible objects.
# - options: (Optional) Additional options or filters that may refine the list of objects to be retrieved. This is optional in the Gherkin step.
# Regular Expression Breakdown:
# - (?P<variable>.*?): Captures the name of the variable where the list of objects will be stored.
# - (?: with "(?P<options>.*?)")?: This part is optional.
#
# This step retrieves the list of visible objects on the current screen and stores it in the specified variable, 
# with an optional set of conditions (options) that can alter the behavior of the retrieval.
# The first usage stores the visible objects without any specific options, while the second one applies the "visible_only" option.
# Example:
# Get list of visible objects in the current screen and store in "myObjects"
# Get list of visible objects in the current screen and store in "myObjects" with "visible_only"
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




# Parameters:
# - user_message_to_ai: (String) A JSON-like list that serves as input for the AI model, guiding what analysis to perform.
#     Example structure of the input JSON list:
#     [
#         {
#             "content": "
#               Explain everything that you see in the image." if not options else focus on {options}.
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
#
# This step retrieves information based on the specified context and stores it in a variable. 
# An optional set of options can be provided to modify the output format (e.g., JSON conversion).
# Example: Get information based on the input message and store it in a variable.
# Get information based on "
# [
#     {
#         "content": "Explain everything you see in the image.",
#         "images": ["screenshot1"]
#     }
# ]
# " and store in the "analysis_result"
@step(u'Get information based on "(?P<user_message_to_ai>[\s\S]*?)" and store in the "(?P<variable>.*?)"(?: with "(?P<option>.*?)")?')
@done(u'Get information based on "{user_message_to_ai}" and store in the "{variable}" with "{option}"')
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


# Parameters:
# - prompt: (String) Explain everything that you see in the image.
# - variable: (String) The name of the variable where the AI analysis output will be stored.
# - option: (String) (Optional) Modifies how the analysis result is processed. For example, if 'Output JSON' is provided,
#            if option "Output JSON" is provided the result will be converted to a JSON format before it is stored in the variable.
#
# This step retrieves information from current screen based on the given prompt and stores it in a variable. 
# An optional set of option can be provided to modify the output format (e.g., JSON conversion).
# Example: Get information from the screen and store it in a variable.
# Get information based on " Explain everything that you see in the image. " from current screen and store in the "screen_analysis"
@step(u'Get information based on "(?P<prompt>[\s\S]*?)" from current screen and store in the "(?P<variable>.*?)"(?: with "(?P<option>.*?)")?')
@done(u'Get information based on "{prompt}" from current screen and store in the "{variable}" with "{option}"')
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


def validate_openai_api_key(OPENAI_API_KEY):
    """
    Validates OpenAI API key format and presence.
    Raises ValueError for invalid or missing keys.
    """

    if OPENAI_API_KEY is None:
        raise ValueError("OpenAI API key is not set in environment variables")
    if not isinstance(OPENAI_API_KEY, str):
        raise ValueError("OpenAI API key must be a string")
    if not OPENAI_API_KEY.strip():
        raise ValueError("OpenAI API key cannot be empty or whitespace")
    if not OPENAI_API_KEY.startswith("sk-"):
        raise ValueError("Invalid OpenAI API key format (should start with 'sk-')")


async def execute_browser_use_action(context, prompt, browser_context=None):
    from browser_use import Agent, Browser, BrowserConfig, Controller
    """
    Execute a browser-use action by initializing and running a Browser Use Agent.
    
    Args:
        prompt (str): The natural language instruction for browser automation
        browser_context (dict): Contains browser session details including:
            - cdp_endpoint: WebSocket endpoint for browser connection
            - session_id: Unique identifier for browser session
            - page_url: Current page URL (optional)
            - config: Configuration dictionary containing:
                - COMETA_OPENAI_API_KEY: OpenAI API key
    
    Returns:
        dict: Result containing:
            - success (bool): Whether the action completed successfully
            - result (str): Action output on success
            - error (str): Error message on failure
    
    Raises:
        ValueError: For invalid configurations
        Exception: For general execution errors
    """

    logger.info("Starting browser-use action execution")
    logger.debug("Input prompt: %s", prompt)
    logger.debug("Browser context: %s", browser_context)
    
    COMETA_OPENAI_API_KEY = ConfigurationManager.get_configuration("COMETA_OPENAI_API_KEY", "")
    logger.debug("Retrieved OpenAI API key from configuration")
    
    config = browser_context.get('config', {}) if browser_context else {}
    

    DEFAULT_BROWSER_USE_MODEL = os.getenv("BROWSER_USE_MODEL", "gpt-4o")

    # Ensure OpenAI API key is valid before proceeding
    validate_openai_api_key(COMETA_OPENAI_API_KEY)

    try:
        # Validate required browser context
        if not browser_context:
            logger.error("browser_context not provided.")
            return "browser_context not provided."

        # Extract and validate CDP endpoint for browser connection
        cdp_endpoint = browser_context.get('cdp_endpoint')
        if not cdp_endpoint:    
            logger.error("CDP endpoint not provided in browser_context.")
            return "CDP endpoint not provided."

        logger.info("Initializing browser automation components")
        logger.debug("CDP endpoint: %s", cdp_endpoint)
        logger.debug("Using model: %s", DEFAULT_BROWSER_USE_MODEL)

        controller = Controller()

        browser_config = BrowserConfig(
            cdp_url=cdp_endpoint,
        )
        browser = Browser(config=browser_config)

        os.environ["OPENAI_API_KEY"] = COMETA_OPENAI_API_KEY

        # Initialize AI agent with OpenAI LLM
        agent = Agent(
            task=prompt,
            llm=ChatOpenAI(
                model=DEFAULT_BROWSER_USE_MODEL,
                temperature=0.0,
                api_key=COMETA_OPENAI_API_KEY,
            ), 
            browser=browser,
            controller=controller,
            use_vision=False,
        )   

        # Execute the browser automation task
        logger.info("Executing browser-use action")
        logger.debug("Task prompt: %s", prompt)
        result = await agent.run(max_steps=25)

        # Wait a moment if needed
        time.sleep(2)

        
        logger.info("Received agent response")
        logger.debug("Response details: %s", result)
        
        if hasattr(result, "is_done") and result.is_done():
            final_result = result.final_result() if hasattr(result, "final_result") else None
            if final_result:
                logger.info("Task completed successfully")
                return {"success": True, "result": final_result}
            else:
                logger.warning("Task completed but no final result was returned")
                return {"success": False, "error": "Task completed but no final result was returned."}
        else:
            model_outputs = result.model_outputs()
            action_results = result.action_results()
            
            if not action_results and not model_outputs:
                error_details = "Agent failed to execute any actions"
            else:
                error_details = result.errors() if hasattr(result, "errors") else "Unknown error"
            
            logger.error("Task failed: %s", error_details)
            return {"success": False, "error": f"Failed to complete task: {error_details}"}
            
     
    except Exception as e:
        logger.exception("Error in browser-use action: %s", str(e))
        return f"Error: {str(e)}"


def start_execution_of_browser_use_action(context, prompt):
    # This is imported at function level to avoid the errors faced during while implementation 
    # in future this might can be moved to globe import
    import asyncio, nest_asyncio
    # IMPORTANT : This import should be done at the function level to avoid conflict with the behave 
    from browser_use import Agent, Browser, BrowserConfig, Controller
        
    try:
        # Extract browser session information
        session_id = context.browser.session_id
        step_timeout = context.step_data.get("timeout", 600)
        
        logger.debug(f"Browser session ID: {session_id}")
        logger.debug(f"CDP endpoint: {context.websocket_url}")
        logger.debug(f"Step timeout: {step_timeout} seconds")

        # Prepare browser context with session details
        browser_context = {
            'cdp_endpoint': context.websocket_url,
            'session_id': session_id,
            'page_url': context.page.url if hasattr(context.page, 'url') else None
        }
        
        logger.debug(f"Prepared browser context: {browser_context}")
        
        # Add configuration from context if available
        if hasattr(context, 'browser_use_config'):
            browser_context['config'] = context.browser_use_config
            logger.debug(f"Passing configuration to browser_use_worker: {context.browser_use_config}")
        
        nest_asyncio.apply()

        loop = asyncio.get_event_loop()
        answer = loop.run_until_complete(execute_browser_use_action(context, prompt=prompt, browser_context=browser_context))
        
        logger.debug("Ending browser use actions")
        return True, answer
    except Exception as exception:
        error_msg = "Exception in browser-use action: %s"
        logger.error(error_msg, str(exception))
        traceback.print_exc()
        raise CustomError("Error while executing the start_execution_of_browser_use_action method")


# Parameters:
# - prompt: (String) The prompt that specifies the action
#
# This step executes the browser-use action based on the given prompt.
# Example:
# Execute AI agent action "Navigate to https://www.google.com and search for 'Cometa Rocks'"
@step(u'Execute AI agent action "(?P<prompt>[\s\S]*?)"')
@done(u'Execute AI agent action "{prompt}"')
def execute_ai_action(context, prompt):
     
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    
    try:
        # Verify AI features are enabled in the environment
        if not context.COMETA_AI_ENABLED:
            feature_cannot_be_used_error()

        logger.debug("Executing AI action")
        logger.debug(f"Prompt: {prompt}")

        # Create config to pass to browser_use_worker
        config = {
            "COMETA_OPENAI_API_KEY": ConfigurationManager.get_configuration("COMETA_OPENAI_API_KEY", "")
        }
        
        # Store configuration in context so it can be accessed by AI module
        context.browser_use_config = config
        
        # Update UI with current action status
        send_step_details(context, "Executing Browser-Use action")
        
        # Execute the AI action and get results
        is_success, response = start_execution_of_browser_use_action(context, prompt)
        
        # Log response and relevant context for debugging
        logger.debug("Response: %s", response)
        logger.debug(f"Context attributes:")
        logger.debug(f"- Browser session ID: {getattr(context.browser, 'session_id', 'Not available')}")
        logger.debug(f"- Page URL: {getattr(context.page, 'url', 'Not available')}")
        logger.debug(f"- AI enabled: {getattr(context, 'COMETA_AI_ENABLED', False)}")
        
        logger.debug("AI action executed")
 
        # Handle errors if the action fails
        if not is_success:
            error_msg = f'The AI server could not complete the analysis and failed with the error: "{response}"'
            logger.error(error_msg)
            raise AssertionError(error_msg)
    except Exception as e:
        # Log any unexpected errors and store for reporting
        logger.exception("Exception while executing browser-use step: %s", str(e))
        context.STEP_ERROR = str(e)
        raise


use_step_matcher("parse")

import base64
import json
import sys, requests, re, html
import jq
import os, logging
import asyncio
import nest_asyncio

# LLM imports are done at function level to avoid conflicts


from behave import step, use_step_matcher

sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")

from utility.functions import *
from utility.configurations import ConfigurationManager

from tools.exceptions import *
from tools.common import send_step_details
from tools.common_functions import *
import datetime

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


def send_browser_use_log(context, message, level='info'):
    """Send browser-use log to dedicated WebSocket channel"""
    # Get the actual step index from context
    step_index = getattr(context, 'step_index', 0)

    requests.post(f'{get_cometa_socket_url()}/feature/{context.feature_id}/browserUseLogs', data={
        "user_id": context.PROXY_USER['user_id'],
        "feature_result_id": os.environ['feature_result_id'],
        "log_level": level,
        "message": message,
        "step_index": step_index,  # Send actual step index instead of counter
        "timestamp": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    })


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


# This step retrieves information from current screen based on the given prompt and stores it in a variable. 
# An optional set of option can be provided to modify the output format (e.g., JSON conversion).
# Parameters:
# - prompt: (String) Explain everything that you see in the image.
# - variable: (String) The name of the variable where the AI analysis output will be stored.
# - option: (String) (Optional) Modifies how the analysis result is processed. For example, if 'Output JSON' is provided,
#            if option "Output JSON" is provided the result will be converted to a JSON format before it is stored in the variable.
# Example: Get information from the screen and store it in a variable.
# Get information based on "
# Explain everything that you see in the image.
# " from current screen and store in the "screen_analysis"
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


class BrowserUseAgentFactory:
    """Factory class for creating LLM instances based on configuration."""
    
    @staticmethod
    def create_llm(context):
        """Create and return appropriate LLM instance based on configuration."""
        browser_use_mode = ConfigurationManager.get_configuration("COMETA_BROWSER_USE_MODE", "openai").lower()
        
        if browser_use_mode == "openai":
            return BrowserUseAgentFactory._create_openai_llm()
        elif browser_use_mode == "ollama":
            return BrowserUseAgentFactory._create_ollama_llm()
        else:
            raise ValueError(f"Unsupported browser use mode: {browser_use_mode}")
    
    @staticmethod
    def _create_openai_llm():
        """Create OpenAI LLM instance."""
        from browser_use import ChatOpenAI
        
        api_key = ConfigurationManager.get_configuration("COMETA_OPENAI_API_KEY", "")
        model = ConfigurationManager.get_configuration("COMETA_BROWSER_USE_MODEL", "gpt-4o-mini")
        
        if not api_key or not api_key.strip():
            raise ValueError("OpenAI API key is required for OpenAI mode")
        if not api_key.startswith("sk-"):
            raise ValueError("Invalid OpenAI API key format")
        
        os.environ["OPENAI_API_KEY"] = api_key
        return ChatOpenAI(model=model, temperature=0.0, api_key=api_key)
    
    @staticmethod
    def _create_ollama_llm():
        """Create Ollama LLM instance."""
        from browser_use import ChatOllama
        
        host = ConfigurationManager.get_configuration("OLLAMA_AI_HOST", "localhost")
        port = ConfigurationManager.get_configuration("OLLAMA_AI_PORT", "11434")
        model = ConfigurationManager.get_configuration("OLLAMA_BROWSER_USE_MODEL", "llama3.1:8b")
        tls_enabled = ConfigurationManager.get_configuration("OLLAMA_AI_TLS_SSL_ENABLED", "False").lower() == "true"
        
        protocol = "https" if tls_enabled else "http"
        base_url = f"{protocol}://{host}:{port}"
        
        return ChatOllama(base_url=base_url, model=model, temperature=0.1)


async def execute_browser_use_action(context, prompt, browser_context=None):
    """
    Execute browser-use action with dynamic LLM provider selection.
    
    Args:
        context: Behave context
        prompt (str): Natural language instruction
        browser_context (dict): Browser session details
    
    Returns:
        dict: Result with success status and response
    """
    import logging as browser_use_logging
    from browser_use import Agent, Browser
    from browser_use.logging_config import setup_logging
    
    # Constants for browser-use execution
    BROWSER_USE_MAX_STEPS = 50
    BROWSER_USE_LOG_LEVEL = 'info'
    
    logger.info(f"Executing browser-use action: {prompt[:100]}...")
    
    try:
        if not browser_context or not browser_context.get('cdp_endpoint'):
            raise ValueError("Invalid browser context or missing CDP endpoint")
        
        # Set environment variables for browser-use logging
        os.environ['BROWSER_USE_LOGGING_LEVEL'] = BROWSER_USE_LOG_LEVEL
        os.environ['BROWSER_USE_SETUP_LOGGING'] = 'true'
        
        # Configure browser-use logging for detailed output
        setup_logging(
            log_level=BROWSER_USE_LOG_LEVEL,  # Enable detailed debugging
            force_setup=True  # Force reconfiguration for debugging
        )
        
        # Set the appropriate logging level based on our configuration
        logging_level = browser_use_logging.INFO if BROWSER_USE_LOG_LEVEL == 'info' else browser_use_logging.DEBUG
        
        logger.info(f"🤖 Starting browser-use agent with CDP: {browser_context['cdp_endpoint']}")
        
        # Initialize browser with CDP connection
        browser = Browser(cdp_url=browser_context['cdp_endpoint'])
        logger.info(f"🌐 Browser connected to CDP endpoint")
        
        # Create LLM based on configuration
        llm = BrowserUseAgentFactory.create_llm(context)
        logger.info(f"🧠 LLM initialized: {type(llm).__name__}")
        
        # Configure agent with optimized settings
        agent = Agent(
            task=prompt,
            llm=llm,
            browser=browser,
            use_vision=False
        )
        logger.info(f"🚀 Agent created with task: {prompt}")
        
        # Execute task with detailed logging using behave timeout
        step_timeout = getattr(context.step_data, 'timeout', 900) if hasattr(context, 'step_data') else 900
        logger.info(f"▶️  Starting agent execution (max {BROWSER_USE_MAX_STEPS} steps, timeout: {step_timeout}s)...")
        
        # Add minimal logging handler to filter authentication messages
        class BrowserUseLogHandler(browser_use_logging.Handler):
            """Filters and forwards browser-use logs to WebSocket"""

            AUTH_FILTERS = re.compile(r'(🔐.*Browser Use Cloud|authenticate with:|browser-use auth|python -m browser_use\.cli auth|^─+$|^👉)')
            ANSI_ESCAPE = re.compile(r'(?:\x1b|\033)\[[0-9;]*m|\\x1b\[[0-9;]*m|\\u[0-9a-fA-F]{4}')

            def __init__(self, context):
                super().__init__()
                self.context = context

            def emit(self, record):
                msg = self.format(record).replace('[browser-use] ', '')
                msg = self.ANSI_ESCAPE.sub('', msg).strip()

                if msg and not self.AUTH_FILTERS.search(msg):
                    level = 'critical' if any(x in msg for x in ['❌', '💥', 'failed', 'error']) else \
                            'progress' if '📍 Step' in msg else 'info'
                    send_browser_use_log(self.context, msg, level)

        # Add handler to browser-use logger (remove existing to avoid duplicates)
        browser_logger = browser_use_logging.getLogger('browser_use')
        # Remove any existing BrowserUseLogHandler to prevent duplicates
        browser_logger.handlers = [h for h in browser_logger.handlers if not isinstance(h, BrowserUseLogHandler)]
        handler = BrowserUseLogHandler(context)
        handler.setLevel(logging_level)
        browser_logger.addHandler(handler)

        try:
            result = await agent.run(max_steps=BROWSER_USE_MAX_STEPS)
            logger.info(f"✅ Agent execution completed")

            # Process result - browser-use returns a history object
            if result and hasattr(result, 'is_done') and result.is_done():
                final_result = result.final_result() if hasattr(result, 'final_result') else "Task completed successfully"
                logger.info(f"🎯 Task completed successfully: {final_result}")
                return {"success": True, "result": final_result or "Task completed"}
            elif result:
                # Task completed but check for errors
                errors = result.errors() if hasattr(result, 'errors') else None
                if errors:
                    logger.error(f"❌ Task failed with errors: {errors}")
                    return {"success": False, "error": f"Task failed: {errors}"}
                else:
                    logger.info(f"✅ Task completed without explicit result")
                    return {"success": True, "result": "Task completed successfully"}
            else:
                logger.error(f"❌ No result returned from agent")
                return {"success": False, "error": "No result returned from agent"}
        finally:
            # Always remove the handler to prevent duplicates in subsequent runs
            browser_logger.removeHandler(handler)

    except Exception as e:
        logger.exception(f"💥 Browser-use action failed with exception: {e}")
        return {"success": False, "error": str(e)}


def start_execution_of_browser_use_action(context, prompt):
    """Simplified browser-use execution wrapper."""
    
    try:
        # Prepare browser context
        browser_context = {
            'cdp_endpoint': context.websocket_url,
            'session_id': getattr(context.browser, 'session_id', None),
            'page_url': getattr(context.page, 'url', None) if hasattr(context, 'page') else None
        }
        
        # Execute with asyncio
        nest_asyncio.apply()
        loop = asyncio.get_event_loop()
        result = loop.run_until_complete(
            execute_browser_use_action(context, prompt, browser_context)
        )
        
        return result.get("success", False), result
        
    except Exception as e:
        logger.exception(f"Browser-use execution failed: {e}")
        raise CustomError(f"Browser-use execution error: {str(e)}")


# This step executes the browser-use action based on the given prompt.
# Parameters:
# - prompt: (String) The prompt that specifies the action
# Example Usage:
# Execute AI agent action "Navigate to https://www.google.com and search for 'Cometa Rocks'"
@step(u'Execute AI agent action "(?P<prompt>[\s\S]*?)"')
@done(u'Execute AI agent action "{prompt}"')
def execute_ai_action(context, prompt):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    
    if not context.COMETA_AI_ENABLED:
        ai_feature_cannot_be_used_error()
    
    try:
        logger.info(f"Executing browser-use action: {prompt[:50]}...")
        send_step_details(context, f"Executing Browser-Use action")
        
        # Execute the streamlined browser-use action
        is_success, response = start_execution_of_browser_use_action(context, prompt)
        
        # Handle result
        if not is_success:
            error_details = response.get("error", "Unknown error") if isinstance(response, dict) else str(response)
            raise CustomError(f"Browser-use action failed: {error_details}")
        
        logger.info("Browser-use action completed successfully")
        
    except Exception as e:
        logger.exception(f"Browser-use step execution failed: {e}")
        context.STEP_ERROR = str(e)
        raise


use_step_matcher("parse")

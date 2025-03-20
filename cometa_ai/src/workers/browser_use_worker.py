import os
from dotenv import load_dotenv
from browser_use import Agent, Browser, BrowserConfig, Controller
from src.utility.common import get_logger
from langchain_openai import ChatOpenAI


logger = get_logger()

load_dotenv()

DEFAULT_BROWSER_USE_MODEL = os.getenv("BROWSER_USE_MODEL", "gpt-4o")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")


def validate_openai_api_key():
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


async def execute_browser_use_action(prompt, browser_context=None):
    """
    Execute a browser-use action by initializing and running a Browser Use Agent.
    
    Args:
        prompt (str): The natural language instruction for browser automation
        browser_context (dict): Contains browser session details including:
            - cdp_endpoint: WebSocket endpoint for browser connection
            - session_id: Unique identifier for browser session
            - page_url: Current page URL (optional)
    
    Returns:
        dict: Result containing:
            - success (bool): Whether the action completed successfully
            - result (str): Action output on success
            - error (str): Error message on failure
    
    Raises:
        ValueError: For invalid configurations
        Exception: For general execution errors
    """
    # Ensure OpenAI API key is valid before proceeding
    validate_openai_api_key()

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

        logger.debug("cdp_endpoint: %s", cdp_endpoint)
        logger.debug("browser_context: %s", browser_context)
        logger.debug("Initializing Agent with model: %s", DEFAULT_BROWSER_USE_MODEL)

        controller = Controller()

        browser_config = BrowserConfig(
            cdp_url=cdp_endpoint,
        )
        browser = Browser(config=browser_config)

        # Initialize AI agent with OpenAI LLM
        agent = Agent(
            task=prompt,
            llm=ChatOpenAI(
                model="gpt-4o",
                temperature=0.0,
                api_key=OPENAI_API_KEY,
            ), 
            browser=browser,
            controller=controller,
            use_vision=False,
        )

        # Execute the browser automation task
        logger.debug("Executing browser-use action with prompt: %s", prompt)
        result = await agent.run(max_steps=25)  # Limit maximum steps to prevent infinite loops

        logger.debug("Received agent response: %s", result)
        
        if hasattr(result, "is_done") and result.is_done():
            final_result = result.final_result() if hasattr(result, "final_result") else None
            if final_result:
                return {"success": True, "result": final_result}
            else:
                return {"success": False, "error": "Task completed but no final result was returned."}
        else:
            model_outputs = result.model_outputs()
            action_results = result.action_results()
            
            if not action_results and not model_outputs:
                error_details = "Agent failed to execute any actions"
            else:
                error_details = result.errors() if hasattr(result, "errors") else "Unknown error"
            
            return {"success": False, "error": f"Failed to complete task: {error_details}"}
            
     
    except Exception as e:
        logger.exception(f"Error in browser-use action: {str(e)}")
        return f"Error: {str(e)}"
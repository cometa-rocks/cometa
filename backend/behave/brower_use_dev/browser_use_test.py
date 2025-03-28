from langchain_openai import ChatOpenAI
from browser_use import Agent, Browser, BrowserConfig, Controller
import os
from dotenv import load_dotenv
# from src.utility.common import get_logger
from langchain_openai import ChatOpenAI
import logging
import logging

logging.basicConfig(level=logging.DEBUG)
import asyncio
logger = logging.getLogger(__name__)


import logging
logging.getLogger("browser_use").setLevel(logging.DEBUG)

# # Initialize the model
# llm = ChatOpenAI(
#     model="gpt-4o",
#     temperature=0.0,
# )

# # Create agent with the model
# agent = Agent(
#     task="Your task here",
#     llm=llm
# )


# load_dotenv()

DEFAULT_BROWSER_USE_MODEL = os.getenv("BROWSER_USE_MODEL", "gpt-4o")
OPENAI_API_KEY = "***REMOVED***"

# options = webdriver.ChromeOptions()
# options.add_argument("--headless")  # Optional
# options.add_argument("--disable-gpu")  # Optional

# hub_url = "http://cometa_selenoid:4444/wd/hub"  # Update if needed

# # Connect to Selenium Grid
# driver = webdriver.Remote(command_executor=hub_url, options=options)

# Extract browser session information
cdp_endpoint = f"ws://cometa_selenoid:4444/devtools/9cb577a854d290f3d9bcc03f20f84a6c"

logger.debug("cdp_endpoint: %s", cdp_endpoint)
logger.debug("Initializing Agent with model: %s", DEFAULT_BROWSER_USE_MODEL)

controller = Controller()

browser_config = BrowserConfig(
    cdp_url=cdp_endpoint,
)
browser = Browser(config=browser_config)

async def run_agent():
    prompt = """ 
1. Open google.com.
2. Wait for the search bar to appear.
3. Type 'how to make a cake'.
4. Press Enter.
5. Click the first search result.
"""

    # Initialize AI agent with OpenAI LLM
    agent = Agent(
        task=prompt,
        llm=ChatOpenAI(
            model="gpt-4o",
            temperature=0.0,
            api_key=OPENAI_API_KEY,
        ),
        browser=browser,
        use_vision=False,
    )

    # Execute the browser automation task
    logger.debug("Executing browser-use action with prompt: %s", prompt)

    # ✅ Await the agent run
    result = await agent.run(max_steps=10)

    logger.debug("Received agent response: %s", result)

    # Extract model outputs and actions
    model_outputs = result.model_outputs() if result else None
    action_results = result.action_results() if result else None

    if not action_results and not model_outputs:
        error_details = result.errors() if hasattr(result, "errors") else "Agent failed to execute any actions"
        logger.error("Agent execution failed: %s", error_details)
    else:
        logger.info("Agent successfully completed the task!")

# Run the async function
if __name__ == "__main__":
    asyncio.run(run_agent())
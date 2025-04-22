# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###
import sys, re, requests

sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")

from playwright.sync_api import sync_playwright
from behave import (
    step,
    use_step_matcher
)
from actions import (
    done,
    logger,
    addVariable
)

from utility.functions import *
from utility.configurations import ConfigurationManager
from utility.common import *
from utility.encryption import *
from tools.common_functions import *
from tools.common import *

use_step_matcher("re")

@step(u'PLW launch browser')
@done(u'PLW launch browser')
def launch_playwright_browser(context):
    
        context.pw = sync_playwright().start()
        send_step_details(context, 'Connecting to Browser')
        logger.debug("Connecting to browser")
        
        if context.USE_COMETA_BROWSER_IMAGES:
            status_check_connection_url = f"http://{context.browser_hub_url}:4444/status"
            response = requests.get(status_check_connection_url)
            if response.status_code != 200:
                raise CustomError("Error while fetching the CDP url")
                # Extract the CDP websocket URL from the response
            response_json = response.json()
            nodes = response_json['value']['nodes']
            if len(nodes)==0:
                raise CustomError("Browser selenium session was closed")
            websocket_url = nodes[0]['slots'][0]['session']['capabilities']['se:cdp']  
            context.websocket_url = websocket_url
            
        else:
            context.websocket_url = f"ws://{context.browser_hub_url}:4444/devtools/{context.browser.session_id}"        
        logger.debug(f"Connecting to browser with Playwright using CDP url : {context.websocket_url}")
        context.playwright_browser = context.pw.chromium.connect_over_cdp(context.websocket_url)
        logger.debug("Browser started")
        time.sleep(2)
        logger.debug("Getting page")
        # Get the first page from the browser context
        
        context.page = context.playwright_browser.contexts[0].pages[0] 
        

# When browser is connected to playwright CDP connection, after that if you are facing any issue with selenium steps, 
# Use this fucntion to release the CDP connection from browser
@step(u'Switch back to selenium browser')
@done(u'Switch back to selenium browser')
def switch_back_to_selenium(context):
    # Once done with browser-use, release it:
    send_step_details(context, "Swithcing back to selenium")
    logger.debug("Release the playwright page")
    context.page.context.close()
    context.page.close()
    logger.debug("Close the playwright browser")
    context.playwright_browser.close()  
    # Releases CDP control

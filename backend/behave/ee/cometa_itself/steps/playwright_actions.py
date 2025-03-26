# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###
import sys, re
from cometa_itself.steps.tools.common import *
from playwright.sync_api import sync_playwright
from behave import (
    step,
    use_step_matcher
)

sys.path.append('/code/behave/cometa_itself/steps')

from actions import (
    done,
    logger,
    addVariable
)

use_step_matcher("re")

@step(u'PLW launch browser')
@done(u'PLW launch browser')
def launch_playwright_browser(context):
    
        context.pw = sync_playwright().start()
        send_step_details(context, 'Launching Browser')
        logger.debug("Starting browser")
        # Connect to existing Chrome instance in Selenoid via CDP
        browser = context.pw.chromium.connect_over_cdp(f"ws://{context.browser_hub_url}:4444/devtools/{context.browser.session_id}")
        logger.debug("Browser started")
        time.sleep(5)
        logger.debug("Getting page")
        # Get the first page from the browser context
        context.page = browser.contexts[0].pages[0] 
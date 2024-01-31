# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###
from cometa_itself.steps.tools.common import *


from playwright.sync_api import sync_playwright

from behave import (
    step,
    use_step_matcher
)

import sys, re
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
    
        # os.environ['SELENIUM_REMOTE_URL'] = 'http://192.168.1.10:4440'
        context.pw = sync_playwright().start()
       
        logger.debug("setting SELENIUM_REMOTE_URL")
        send_step_details(context, 'Launching Browser')
        logger.debug("Starting browser")
        # browser = pw.chromium.launch(headless=False)
        browser = context.pw.chromium.connect_over_cdp(f"ws://cometa_selenoid:4444/devtools/{context.browser.session_id}")
        logger.debug("browser started")
        logger.debug("getting page")
        time.sleep(5)
        context.page = browser.contexts[0].pages[0] 
        logger.debug("setting default timeout to 60 seconds ")
        # context.page.set_default_timeout(60)
        # context.page.goto("https://behave.readthedocs.io/en/stable/api.html")
        # context.page.goto("https://www.amvara.de/#/")
        # logger.debug("navigated ")

    
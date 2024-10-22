import base64
import time
import logging
import json
import sys, traceback
import sys, requests, re, json

import jq
from appium import webdriver as mobile_driver

from appium.options.android import UiAutomator2Options
from appium.options.ios import XCUITestOptions
from appium.options.common.base import AppiumOptions

from behave import step, use_step_matcher

sys.path.append("/opt/code/behave_django")
sys.path.append("/code/behave/cometa_itself/steps")

from utility.functions import *
from tools.exceptions import *
from tools.common import send_step_details
from tools.common_functions import *
from tools.service_manager import ServiceManager


# setup logging
logger = logging.getLogger("FeatureExecution")

use_step_matcher("re")


@step('Launch mobile "(?P<mobile_name>.*?)"(?: with "(?P<option>.*?)")?(?: reference to "(?P<variable_name>.*?)")?')
@done('Launch mobile "{mobile_name}" with "{option}" reference to "{variable_name}"')
def start_mobile_and_application(context, mobile_name, option=None, variable_name=None):
    parameters = {"mobile_image_name": mobile_name}
    
    mobile_response = call_backend(
        method="GET", path="/api/mobile/", parameters=parameters
    )
    if (
        not mobile_response.status_code == 200
        or len(mobile_response.json()["mobiles"]) == 0
    ):
        raise CustomError(f"Can not find mobile with name {mobile_name} ")
    
    mobile_configuration = mobile_response.json()["mobiles"][0]
    logger.debug(f"Received mobile configuration {mobile_configuration}")
    service_manager = ServiceManager()
    logger.debug(f"preparing emulator service configurations")
    service_manager.prepare_emulator_service_configuration(
        image=mobile_configuration["mobile_json"]["image"]
    )
    service_details = service_manager.create_service()
    logger.debug(f"Service created with Id {service_details['Id']}")
    context.container_services.append(service_details)
    service_manager.wait_for_service_to_be_running(
        service_name_or_id=service_details["Id"],
        max_wait_time_seconds=30,
    )
    
    # connect to backend    
    mobile_configuration["capabilities"].update(context.mobile_capabilities)
    mobile_configuration["appium:noReset"]=True
    options = AppiumOptions()
    options.load_capabilities(mobile_configuration["capabilities"])
    options.noReset = True
    options.set_capability('ignoreHiddenApiPolicyError', True)
    
    time.sleep(30)
    logger.debug(f"Connecting to the mobile using appium with capabilities {mobile_configuration['capabilities']}")
    new_mobile = mobile_driver.Remote(f"http://{service_details['Config']['Hostname']}:4723", strict_ssl = False, options=options)
    context.mobiles[variable_name if variable_name else 'default'] = new_mobile


@step('Install app "(?P<apk_file_name>.*?)"')
@done('Install app "{apk_file_name}"')
def install_app(context, app_package, device_name, option):
    pass



use_step_matcher("parse")

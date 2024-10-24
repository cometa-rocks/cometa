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

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from behave import step, use_step_matcher

sys.path.append("/opt/code/behave_django")
sys.path.append("/code/behave/cometa_itself/steps")

from utility.functions import *
from tools.exceptions import *
from tools.common import send_step_details, decryptFile
from tools.common_functions import *
from tools.service_manager import ServiceManager
from .mobile_actions_utils import upload_file_to_appium_container


IMPLICIT_WAIT_TIME = 10  # Adjust as needed
EXPLICIT_WAIT_TIME = 30  # Adjust as needed

# setup logging
logger = logging.getLogger("FeatureExecution")

use_step_matcher("re")


@step('Launch mobile "(?P<mobile_name>.*?)"(?: with "(?P<option>.*?)")?(?: reference to "(?P<variable_name>.*?)")?')
@done('Launch mobile "{mobile_name}" with "{option}" reference to "{variable_name}"')
def start_mobile_and_application(context, mobile_name, option=None, variable_name=None):
    context.STEP_TYPE = 'MOBILE'
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
    send_step_details(context, "Starting mobile container")
    service_details = service_manager.create_service()
    logger.debug(f"Service created with Id {service_details['Id']}")
    context.container_services.append(service_details)
    service_manager.wait_for_service_to_be_running(
        service_name_or_id=service_details["Id"],
        max_wait_time_seconds=30,
    )
    time.sleep(40)

    # connect to backend
    mobile_configuration["capabilities"].update(context.mobile_capabilities)
    mobile_configuration["capabilities"]["appium:noReset"] = True
    options = AppiumOptions()
    options.load_capabilities(mobile_configuration["capabilities"])
    options.noReset = True
    options.set_capability("ignoreHiddenApiPolicyError", True)
    # Add Application related configuration
    logger.debug(type(options))
    if option and option.startswith("Install app"):
        file_path = option.replace("Install app", "").strip()
        file_name = upload_file_to_appium_container(
            context, service_details["Id"], file_path
        )
        options.set_capability("app", f"/tmp/{file_name}")

    logger.debug(
        f"Connecting to the mobile using appium with capabilities {mobile_configuration['capabilities']}"
    )
    send_step_details(context, "Connecting to appium server")
    new_mobile = mobile_driver.Remote(
        f"http://{service_details['Config']['Hostname']}:4723",
        strict_ssl=False,
        options=options,
    )
    mobile_info = {
        "driver": new_mobile,
        "container_service_details": service_details,
    }
    # Save in the list of mobile
    context.mobiles[variable_name if variable_name else "default"] = mobile_info
    # Save in the list of mobile to use it without iterating
    context.mobile = mobile_info

    data = {
        "feature_result_id": int(context.FEATURE_RESULT_ID),  
        "mobile": [
            {
                "container_service_details": service_details,
                "mobile_configuration": mobile_configuration,
            }
        ]
    }
    
    call_backend(
        method="PATCH", path="/api/feature_results/", body=data
    )
 

@step('Switch mobile to "(?P<variable_name>.*?)"')
@done('Switch mobile to "{variable_name}"')
def switch_mobile(context, variable_name):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(context, f"Changing current mobile to {variable_name}")
    context.mobile = context.mobiles[variable_name]


@step('Install app "(?P<apk_file_name>.*?)"')
@done('Install app "{apk_file_name}"')
def install_app(context, apk_file_name):
    context.STEP_TYPE = 'MOBILE'
    # select the upload element to send the filenames to
    # get the target file or files
    service_id = context.mobile["container_service_details"]["Id"]
    file_name = upload_file_to_appium_container(context, service_id, apk_file_name)

    logger.debug(f"Installing app")
    send_step_details(context, f"Installing app")
    service_manager = ServiceManager()
    result, message = service_manager.install_apk(
        service_name_or_id=service_id, apk_file_name=file_name
    )
    if not result:
        raise CustomError(message)


use_step_matcher("parse")

IMPLICIT_WAIT_TIME = 10  # Adjust as needed
EXPLICIT_WAIT_TIME = 30  # Adjust as needed


# Helper function to return the correct locator strategy
def get_locator(strategy, value):
    strategies = {
        "id": By.ID,
        "xpath": By.XPATH,
        "class_name": By.CLASS_NAME,
        "accessibility_id": By.ACCESSIBILITY_ID,
        "name": By.NAME,
        # Add other strategies as needed
    }
    return strategies[strategy], value


@step('Tap on element with {strategy} "{value}"')
@done('Tap on element with {strategy} "{value}"')
def tap_on_element(context, strategy, value):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Initiating tap action on element with {strategy}: {value}"
    )
    logger.debug(f"Attempting to tap on element with {strategy}: {value}")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.element_to_be_clickable(locator)
    )
    actions = ActionChains(context.mobile["driver"])
    actions.click(element).perform()
    send_step_details(context, f"Tapped on element with {strategy}: {value}")


@step('Long press element with {strategy} "{value}"')
@done('Long press element with {strategy} "{value}"')
def long_press_on_element(context, strategy, value):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Initiating long press action on element with {strategy}: {value}"
    )
    logger.debug(f"Attempting to long press on element with {strategy}: {value}")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.presence_of_element_located(locator)
    )
    actions = ActionChains(context.mobile["driver"])
    actions.click_and_hold(element).pause(2).release().perform()
    send_step_details(context, f"Long pressed on element with {strategy}: {value}")


@step('Double tap on element with {strategy} "{value}"')
@done('Double tap on element with {strategy} "{value}"')
def double_tap_on_element(context, strategy, value):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Initiating double tap action on element with {strategy}: {value}"
    )
    logger.debug(f"Attempting to double tap on element with {strategy}: {value}")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.element_to_be_clickable(locator)
    )
    actions = ActionChains(context.mobile["driver"])
    actions.double_click(element).perform()
    send_step_details(context, f"Double tapped on element with {strategy}: {value}")


@step('Swipe left on element with {strategy} "{value}"')
@done('Swipe left on element with {strategy} "{value}"')
def swipe_left_on_element(context, strategy, value):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Initiating swipe left action on element with {strategy}: {value}"
    )
    logger.debug(f"Attempting to swipe left on element with {strategy}: {value}")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.presence_of_element_located(locator)
    )
    actions = ActionChains(context.mobile["driver"])
    actions.move_to_element(element).click_and_hold().move_by_offset(
        -200, 0
    ).release().perform()
    send_step_details(context, f"Swiped left on element with {strategy}: {value}")


@step('Swipe right on element with {strategy} "{value}"')
@done('Swipe right on element with {strategy} "{value}"')
def swipe_right_on_element(context, strategy, value):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Initiating swipe right action on element with {strategy}: {value}"
    )
    logger.debug(f"Attempting to swipe right on element with {strategy}: {value}")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.presence_of_element_located(locator)
    )
    actions = ActionChains(context.mobile["driver"])
    actions.move_to_element(element).click_and_hold().move_by_offset(
        200, 0
    ).release().perform()
    send_step_details(context, f"Swiped right on element with {strategy}: {value}")


@step('Swipe up on element with {strategy} "{value}"')
@done('Swipe up on element with {strategy} "{value}"')
def swipe_up_on_element(context, strategy, value):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Initiating swipe up action on element with {strategy}: {value}"
    )
    logger.debug(f"Attempting to swipe up on element with {strategy}: {value}")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.presence_of_element_located(locator)
    )
    actions = ActionChains(context.mobile["driver"])
    actions.move_to_element(element).click_and_hold().move_by_offset(
        0, -200
    ).release().perform()
    send_step_details(context, f"Swiped up on element with {strategy}: {value}")


@step('Swipe down on element with {strategy} "{value}"')
@done('Swipe down on element with {strategy} "{value}"')
def swipe_down_on_element(context, strategy, value):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Initiating swipe down action on element with {strategy}: {value}"
    )
    logger.debug(f"Attempting to swipe down on element with {strategy}: {value}")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.presence_of_element_located(locator)
    )
    actions = ActionChains(context.mobile["driver"])
    actions.move_to_element(element).click_and_hold().move_by_offset(
        0, 200
    ).release().perform()
    send_step_details(context, f"Swiped down on element with {strategy}: {value}")


@step('Set value "{text}" on element with {strategy} "{value}"')
@done('Set value "{text}" on element with {strategy} "{value}"')
def set_value_on_element(context, text, strategy, value):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Setting value '{text}' on element with {strategy}: {value}"
    )
    logger.debug(f"Setting value '{text}' on element with {strategy}: {value}")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.presence_of_element_located(locator)
    )
    element.clear()
    element.send_keys(text)
    send_step_details(
        context, f"Value '{text}' set on element with {strategy}: {value}"
    )


@step('Take screenshot and save as "{filename}"')
@done('Screenshot saved as "{filename}"')
def take_screenshot(context, filename):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(context, f"Taking screenshot and saving as {filename}")
    logger.debug(f"Taking screenshot and saving as {filename}")
    screenshot_path = f"/path/to/save/{filename}"  # Replace with actual path
    context.mobile["driver"].save_screenshot(screenshot_path)
    send_step_details(context, f"Screenshot saved at {screenshot_path}")


@step('Check if element with {strategy} "{value}" is visible')
@done('Checked if element with {strategy} "{value}" is visible')
def check_if_element_visible(context, strategy, value):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Checking if element with {strategy}: {value} is visible"
    )
    logger.debug(f"Checking if element with {strategy}: {value} is visible")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.visibility_of_element_located(locator)
    )
    is_visible = element.is_displayed()
    send_step_details(
        context, f"Element with {strategy}: {value} is visible: {is_visible}"
    )
    return is_visible


@step('Check if element with {strategy} "{value}" is not visible')
@done('Checked if element with {strategy} "{value}" is not visible')
def check_if_element_not_visible(context, strategy, value):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Checking if element with {strategy}: {value} is not visible"
    )
    logger.debug(f"Checking if element with {strategy}: {value} is not visible")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    try:
        WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until_not(
            EC.visibility_of_element_located(locator)
        )
        send_step_details(context, f"Element with {strategy}: {value} is not visible")
        return True
    except:
        send_step_details(context, f"Element with {strategy}: {value} is still visible")
        return False


@step('Check if element with {strategy} "{value}" is enabled')
@done('Checked if element with {strategy} "{value}" is enabled')
def check_if_element_enabled(context, strategy, value):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Checking if element with {strategy}: {value} is enabled"
    )
    logger.debug(f"Checking if element with {strategy}: {value} is enabled")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.element_to_be_clickable(locator)
    )
    is_enabled = element.is_enabled()
    send_step_details(
        context, f"Element with {strategy}: {value} is enabled: {is_enabled}"
    )
    return is_enabled


@step('Check if element with {strategy} "{value}" is not enabled')
@done('Checked if element with {strategy} "{value}" is not enabled')
def check_if_element_not_enabled(context, strategy, value):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Checking if element with {strategy}: {value} is not enabled"
    )
    logger.debug(f"Checking if element with {strategy}: {value} is not enabled")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.presence_of_element_located(locator)
    )
    is_not_enabled = not element.is_enabled()
    send_step_details(
        context, f"Element with {strategy}: {value} is not enabled: {is_not_enabled}"
    )
    return is_not_enabled


@step('Check if element with {strategy} "{value}" contains text "{text}"')
@done('Checked if element with {strategy} "{value}" contains text "{text}"')
def check_if_element_contains_text(context, strategy, value, text):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context, f"Checking if element with {strategy}: {value} contains text: {text}"
    )
    logger.debug(f"Checking if element with {strategy}: {value} contains text: {text}")
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.presence_of_element_located(locator)
    )
    element_text = element.text
    contains_text = text in element_text
    send_step_details(
        context,
        f"Element with {strategy}: {value} contains text '{text}': {contains_text}",
    )
    return contains_text


@step('Check if element with {strategy} "{value}" does not contain text "{text}"')
@done('Checked if element with {strategy} "{value}" does not contain text "{text}"')
def check_if_element_not_contains_text(context, strategy, value, text):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(
        context,
        f"Checking if element with {strategy}: {value} does not contain text: {text}",
    )
    logger.debug(
        f"Checking if element with {strategy}: {value} does not contain text: {text}"
    )
    context.mobile["driver"].implicitly_wait(IMPLICIT_WAIT_TIME)
    locator = get_locator(strategy, value)
    element = WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until(
        EC.presence_of_element_located(locator)
    )
    element_text = element.text
    not_contains_text = text not in element_text
    send_step_details(
        context,
        f"Element with {strategy}: {value} does not contain text '{text}': {not_contains_text}",
    )
    return not_contains_text


@step('Validate if current screen contains "{object_name}"')
@done('Validated if current screen contains "{object_name}"')
def validate_if_screen_contains_object(context, object_name):
    context.STEP_TYPE = 'MOBILE'
    send_step_details(context, f"Validating if current screen contains '{object_name}'")
    logger.debug(f"Validating if current screen contains '{object_name}'")
    screen_text = context.mobile["driver"].page_source
    contains_object = object_name in screen_text
    send_step_details

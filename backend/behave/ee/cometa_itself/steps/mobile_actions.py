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
from tools.common import send_step_details, decryptFile, waitSelector
from tools.common_functions import *
from tools.service_manager import ServiceManager
from .mobile_actions_utils import upload_file_to_appium_container


IMPLICIT_WAIT_TIME = 10  # Adjust as needed
EXPLICIT_WAIT_TIME = 30  # Adjust as needed

# setup logging
logger = logging.getLogger("FeatureExecution")

use_step_matcher("re")


@step(
    'Launch mobile "(?P<mobile_name>.*?)"(?: use capabilities """(?P<capabilities>.*?)""")?(?: reference to "(?P<variable_name>.*?)")?'
)
@done(
    'Launch mobile "{mobile_name}" use capabilities """{capabilities}""" reference to "{variable_name}"'
)
def start_mobile_and_application(
    context, mobile_name, capabilities="{}", variable_name=None
):
    context.STEP_TYPE = "MOBILE"
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

    mobile_configuration["capabilities"].update(context.mobile_capabilities)
    try:
        user_provided_capabilities: dict = json.loads(capabilities)
    except Exception as e:
        raise CustomError(f"Error while loading capabilities, {str(e)}")
    # Checking user provided capbilities are not overriding with capabilities provided by cometa
    common_keys = (
        user_provided_capabilities.keys() & mobile_configuration["capabilities"].keys()
    )
    if common_keys:
        # If there are any common keys, raise an error
        raise CustomeError(
            f"The following keys are already in set : {common_keys}, you do not need to pass them"
        )

    # connect to backend
    mobile_configuration["capabilities"].update(user_provided_capabilities)

    if "app" in mobile_configuration["capabilities"].keys():
        file_name = upload_file_to_appium_container(
            context, service_details["Id"], mobile_configuration["capabilities"]["app"]
        )
        mobile_configuration["capabilities"]["app"] = f"/tmp/{file_name}"

    options = AppiumOptions()
    options.load_capabilities(mobile_configuration["capabilities"])

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
                "is_started_by_test": True,
                "container_service_details": service_details,
                "mobile_configuration": mobile_configuration,
            }
        ],
    }

    call_backend(method="PATCH", path="/api/feature_results/", body=data)


@step(
    'Connect to mobile "(?P<mobile_code>.*?)"(?: use capabilities """(?P<capabilities>.*?)""")?(?: reference to "(?P<variable_name>.*?)")?'
)
@done(
    'Connect to mobile "{mobile_code}" use capabilities """{capabilities}""" reference to "{variable_name}"'
)
def connect_mobile_and_application(
    context, mobile_code, capabilities={}, variable_name=None
):
    context.STEP_TYPE = "MOBILE"
    parameters = {"information__Config__Hostname": mobile_code}

    container_services = call_backend(
        method="GET", path="/api/container_service/", parameters=parameters
    )
    response_json = container_services.json()
    if (
        not container_services.status_code == 200
        or len(response_json["containerservices"]) == 0
    ):
        raise CustomError(f"Can not find mobile with code {mobile_code} ")

    container_service = response_json["containerservices"][0]
    mobile_configuration = {"capabilities": {}}
    mobile_configuration["capabilities"].update(context.mobile_capabilities)
    mobile_configuration["capabilities"].update(container_service["capabilities"])

    # Checking user provided capabilities are not overriding with capabilities provided by cometa
    try:
        user_provided_capabilities: dict = json.loads(capabilities)
    except Exception as e:
        raise CustomError(f"Error while loading capabilities, {str(e)}")
    common_keys = (
        user_provided_capabilities.keys() & mobile_configuration["capabilities"].keys()
    )
    if common_keys:
        # If there are any common keys, raise an error
        raise CustomeError(
            f"The following keys are already in set : {common_keys}, you do not need to pass them"
        )

    mobile_configuration["capabilities"].update(user_provided_capabilities)

    logger.debug(f"Mobile configurations : {mobile_configuration['capabilities']}")

    # Add Application related configuration
    if "app" in mobile_configuration["capabilities"].keys():
        file_name = upload_file_to_appium_container(
            context,
            container_service["service_id"],
            mobile_configuration["capabilities"]["app"],
        )
        mobile_configuration["capabilities"]["app"] = f"/tmp/{file_name}"

    # Prepare the appium options
    options = AppiumOptions()
    options.load_capabilities(mobile_configuration["capabilities"])

    logger.debug(
        f"Connecting to the mobile using appium with capabilities {mobile_configuration['capabilities']}"
    )
    send_step_details(context, "Connecting to appium server")
    new_mobile = mobile_driver.Remote(
        f"http://{container_service['hostname']}:4723",
        strict_ssl=False,
        options=options,
    )

    mobile_info = {
        "driver": new_mobile,
        "container_service_details": ServiceManager().inspect_service(
            container_service["service_id"]
        ),
    }
    # Save in the list of mobile
    context.mobiles[variable_name if variable_name else "default"] = mobile_info
    # Save in the list of mobile to use it without iterating
    context.mobile = mobile_info

    data = {
        "feature_result_id": int(context.FEATURE_RESULT_ID),
        "mobile": [
            {
                "is_started_by_test": False,
                "container_service_details": container_service,
                "mobile_configuration": mobile_configuration,
            }
        ],
    }

    call_backend(method="PATCH", path="/api/feature_results/", body=data)


@step('Switch mobile to "(?P<variable_name>.*?)"')
@done('Switch mobile to "{variable_name}"')
def switch_mobile(context, variable_name):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Changing current mobile to {variable_name}")
    context.mobile = context.mobiles[variable_name]


@step('Install app "(?P<apk_file_name>.*?)"')
@done('Install app "{apk_file_name}"')
def install_app(context, apk_file_name):
    context.STEP_TYPE = "MOBILE"
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


@step('Tap on element with "{selector_type}" "{selector_value}"')
@done('Tap on element with "{selector_type}" "{selector_value}"')
def tap_on_element(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Initiating tap action on element with {selector_type}: {selector_value}",
    )
    logger.debug(f"Attempting to tap on element with {selector_type}: {selector_value}")
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    actions = ActionChains(context.mobile["driver"])
    actions.click(element).perform()
    send_step_details(
        context, f"Tapped on element with {selector_type}: {selector_value}"
    )


@step('Long press element with "{selector_type}" "{selector_value}"')
@done('Long press element with "{selector_type}" "{selector_value}"')
def long_press_on_element(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Initiating long press action on element with {selector_type}: {selector_value}",
    )
    logger.debug(
        f"Attempting to long press on element with {selector_type}: {selector_value}"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    actions = ActionChains(context.mobile["driver"])
    actions.click_and_hold(element).pause(2).release().perform()
    send_step_details(
        context, f"Long pressed on element with {selector_type}: {selector_value}"
    )


@step('Double tap on element with "{selector_type}" "{selector_value}"')
@done('Double tap on element with "{selector_type}" "{selector_value}"')
def double_tap_on_element(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Initiating double tap action on element with {selector_type}: {selector_value}",
    )
    logger.debug(
        f"Attempting to double tap on element with {selector_type}: {selector_value}"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    actions = ActionChains(context.mobile["driver"])
    actions.double_click(element).perform()
    send_step_details(
        context, f"Double tapped on element with {selector_type}: {selector_value}"
    )


@step('Swipe left on element with "{selector_type}" "{selector_value}"')
@done('Swipe left on element with "{selector_type}" "{selector_value}"')
def swipe_left_on_element(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Initiating swipe left action on element with {selector_type}: {selector_value}",
    )
    logger.debug(
        f"Attempting to swipe left on element with {selector_type}: {selector_value}"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    actions = ActionChains(context.mobile["driver"])
    actions.move_to_element(element).click_and_hold().move_by_offset(
        -200, 0
    ).release().perform()
    send_step_details(
        context, f"Swiped left on element with {selector_type}: {selector_value}"
    )


@step('Swipe right on element with "{selector_type}" "{selector_value}"')
@done('Swipe right on element with "{selector_type}" "{selector_value}"')
def swipe_right_on_element(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Initiating swipe right action on element with {selector_type}: {selector_value}",
    )
    logger.debug(
        f"Attempting to swipe right on element with {selector_type}: {selector_value}"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    actions = ActionChains(context.mobile["driver"])
    actions.move_to_element(element).click_and_hold().move_by_offset(
        200, 0
    ).release().perform()
    send_step_details(
        context, f"Swiped right on element with {selector_type}: {selector_value}"
    )


@step('Swipe up on element with "{selector_type}" "{selector_value}"')
@done('Swipe up on element with "{selector_type}" "{selector_value}"')
def swipe_up_on_element(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Initiating swipe up action on element with {selector_type}: {selector_value}",
    )
    logger.debug(
        f"Attempting to swipe up on element with {selector_type}: {selector_value}"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    actions = ActionChains(context.mobile["driver"])
    actions.move_to_element(element).click_and_hold().move_by_offset(
        0, -200
    ).release().perform()
    send_step_details(
        context, f"Swiped up on element with {selector_type}: {selector_value}"
    )


@step('Swipe down on element with "{selector_type}" "{selector_value}"')
@done('Swipe down on element with "{selector_type}" "{selector_value}"')
def swipe_down_on_element(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Initiating swipe down action on element with {selector_type}: {selector_value}",
    )
    logger.debug(
        f"Attempting to swipe down on element with {selector_type}: {selector_value}"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    actions = ActionChains(context.mobile["driver"])
    actions.move_to_element(element).click_and_hold().move_by_offset(
        0, 200
    ).release().perform()
    send_step_details(
        context, f"Swiped down on element with {selector_type}: {selector_value}"
    )


@step('Set value "{text}" on element with "{selector_type}" "{selector_value}"')
@done('Set value "{text}" on element with "{selector_type}" "{selector_value}"')
def set_value_on_element(context, text, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Setting value '{text}' on element with {selector_type}: {selector_value}",
    )
    logger.debug(
        f"Setting value '{text}' on element with {selector_type}: {selector_value}"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    element.clear()
    element.send_keys(text)
    send_step_details(
        context, f"Value '{text}' set on element with {selector_type}: {selector_value}"
    )


@step('Take screenshot and save as "{filename}"')
@done('Take screenshot and save as "{filename}"')
def take_screenshot(context, filename):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Taking screenshot and saving as {filename}")
    logger.debug(f"Taking screenshot and saving as {filename}")
    screenshot_path = f"/path/to/save/{filename}"  # Replace with actual path
    context.mobile["driver"].save_screenshot(screenshot_path)
    send_step_details(context, f"Screenshot saved at {screenshot_path}")


@step('Check if element with "{selector_type}" "{selector_value}" is visible')
@done('Check if element with "{selector_type}" "{selector_value}" is visible')
def check_if_element_visible(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector_type}: {selector_value} is visible",
    )
    logger.debug(
        f"Checking if element with {selector_type}: {selector_value} is visible"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    if not element.is_displayed():
        raise CustomError(
            f"Element with {selector_type}: {selector_value} is not visible"
        )
    send_step_details(
        context, f"Element with {selector_type}: {selector_value} is visible"
    )
    return True


@step('Check if element with "{selector_type}" "{selector_value}" is not visible')
@done('Check if element with "{selector_type}" "{selector_value}" is not visible')
def check_if_element_not_visible(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector_type}: {selector_value} is not visible",
    )
    logger.debug(
        f"Checking if element with {selector_type}: {selector_value} is not visible"
    )
    try:
        WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until_not(
            EC.visibility_of_element_located(
                waitSelector(context, selector_type, selector_value)
            )
        )
        send_step_details(
            context, f"Element with {selector_type}: {selector_value} is not visible"
        )
        return True
    except:
        raise CustomError(
            f"Element with {selector_type}: {selector_value} is still visible"
        )


@step('Check if element with "{selector_type}" "{selector_value}" is enabled')
@done('Check if element with "{selector_type}" "{selector_value}" is enabled')
def check_if_element_enabled(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector_type}: {selector_value} is enabled",
    )
    logger.debug(
        f"Checking if element with {selector_type}: {selector_value} is enabled"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    if not element.is_enabled():
        raise CustomError(
            f"Element with {selector_type}: {selector_value} is not enabled"
        )
    send_step_details(
        context, f"Element with {selector_type}: {selector_value} is enabled"
    )
    return True


@step('Check if element with "{selector_type}" "{selector_value}" is not enabled')
@done('Check if element with "{selector_type}" "{selector_value}" is not enabled')
def check_if_element_not_enabled(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector_type}: {selector_value} is not enabled",
    )
    logger.debug(
        f"Checking if element with {selector_type}: {selector_value} is not enabled"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector_value=selector_value
    )
    if element.is_enabled():
        raise CustomError(
            f"Element with {selector_type}: {selector_value} is still enabled"
        )
    send_step_details(
        context, f"Element with {selector_type}: {selector_value} is not enabled"
    )
    return True


@step(
    'Check if element with "{selector_type}" "{selector_value}" contains text "{text}"'
)
@done(
    'Check if element with "{selector_type}" "{selector_value}" contains text "{text}"'
)
def check_if_element_contains_text(context, selector_type, selector_value, text):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector_type}: {selector_value} contains text: {text}",
    )
    logger.debug(
        f"Checking if element with {selector_type}: {selector_value} contains text: {text}"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    element_text = element.text
    if text not in element_text:
        raise CustomError(
            f"Element with {selector_type}: {selector_value} does not contain text '{text}'"
        )
    send_step_details(
        context,
        f"Element with {selector_type}: {selector_value} contains text '{text}'",
    )
    return True


@step(
    'Check if element with "{selector_type}" "{selector_value}" does not contain text "{text}"'
)
@done(
    'Check if element with "{selector_type}" "{selector_value}" does not contain text "{text}"'
)
def check_if_element_not_contains_text(context, selector_type, selector_value, text):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector_type}: {selector_value} does not contain text: {text}",
    )
    logger.debug(
        f"Checking if element with {selector_type}: {selector_value} does not contain text: {text}"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    element_text = element.text
    if text in element_text:
        raise CustomError(
            f"Element with {selector_type}: {selector_value} contains text '{text}'"
        )
    send_step_details(
        context,
        f"Element with {selector_type}: {selector_value} does not contain text '{text}'",
    )
    return True


@step('Validate if current screen contains "{object_name}"')
@done('Validate if current screen contains "{object_name}"')
def validate_if_screen_contains_object(context, object_name):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Validating if current screen contains '{object_name}'")
    logger.debug(f"Validating if current screen contains '{object_name}'")
    screen_text = context.mobile["driver"].page_source
    if object_name not in screen_text:
        raise CustomError(f"'{object_name}' did not appear on the screen")
    send_step_details(context, f"Current screen contains '{object_name}'")
    return True


@step('Switch to frame with id "{frame_id}"')
@done('Switch to frame with id "{frame_id}"')
def switch_to_frame_by_id(context, frame_id):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Switching to frame with id: {frame_id}")
    logger.debug(f"Switching to frame with id: {frame_id}")
    try:
        context.mobile["driver"].switch_to.frame(
            context.mobile["driver"].find_element_by_id(frame_id)
        )
        send_step_details(context, f"Switched to frame with id: {frame_id}")
    except Exception as e:
        raise CustomError(f"Could not switch to frame with id {frame_id}: {str(e)}")


@step('Open URL "{url}" in mobile browser')
@done('Open URL "{url}" in mobile browser')
def open_url_in_mobile_browser(context, url):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Opening URL {url} in mobile browser")
    logger.debug(f"Opening URL {url} in mobile browser")
    try:
        context.mobile["driver"].get(url)
        send_step_details(context, f"URL {url} opened successfully")
    except Exception as e:
        raise CustomError(f"Could not open URL {url}: {str(e)}")


@step("Close the mobile application")
@done("Close the mobile application")
def close_mobile_application(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Closing the mobile application")
    logger.debug("Closing the mobile application")
    try:
        context.mobile["driver"].close_app()
        send_step_details(context, "Mobile application closed successfully")
    except Exception as e:
        raise CustomError(f"Could not close the mobile application: {str(e)}")


@step('Install app "{app_package}" on device "{device_name}"')
@done('Install app "{app_package}" on device "{device_name}"')
def install_app_on_device(context, app_package, device_name):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Installing app {app_package} on device {device_name}")
    logger.debug(f"Installing app {app_package} on device {device_name}")
    try:
        context.mobile["driver"].install_app(app_package)
        send_step_details(
            context, f"App {app_package} installed successfully on device {device_name}"
        )
    except Exception as e:
        raise CustomError(
            f"Could not install app {app_package} on device {device_name}: {str(e)}"
        )


@step('Uninstall app "{app_package}" from device "{device_name}"')
@done('Uninstall app "{app_package}" from device "{device_name}"')
def uninstall_app_from_device(context, app_package, device_name):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context, f"Uninstalling app {app_package} from device {device_name}"
    )
    logger.debug(f"Uninstalling app {app_package} from device {device_name}")
    try:
        context.mobile["driver"].remove_app(app_package)
        send_step_details(
            context,
            f"App {app_package} uninstalled successfully from device {device_name}",
        )
    except Exception as e:
        raise CustomError(
            f"Could not uninstall app {app_package} from device {device_name}: {str(e)}"
        )


@step('Launch mobile browser and navigate to "{url}"')
@done('Launch mobile browser and navigate to "{url}"')
def launch_mobile_browser_and_navigate(context, url):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Launching mobile browser and navigating to {url}")
    logger.debug(f"Launching mobile browser and navigating to {url}")
    try:
        context.mobile["driver"].get(url)
        send_step_details(context, f"Navigated to {url} successfully")
    except Exception as e:
        raise CustomError(f"Could not navigate to {url}: {str(e)}")


@step('Tap on coordinates "{x}, {y}"')
@done('Tap on coordinates "{x}, {y}"')
def tap_on_coordinates(context, x, y):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Tapping on coordinates {x}, {y}")
    logger.debug(f"Tapping on coordinates {x}, {y}")
    try:
        actions = TouchAction(context.mobile["driver"])
        actions.tap(x=int(x), y=int(y)).perform()
        send_step_details(context, f"Tapped on coordinates {x}, {y} successfully")
    except Exception as e:
        raise CustomError(f"Could not tap on coordinates {x}, {y}: {str(e)}")


@step('Pinch to zoom in on element with id "{element_id}"')
@done('Pinch to zoom in on element with id "{element_id}"')
def pinch_to_zoom_in(context, element_id):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Pinching to zoom in on element with id {element_id}")
    logger.debug(f"Pinching to zoom in on element with id {element_id}")
    try:
        element = waitSelector(
            context=context, selector_type="id", selector_value=element_id
        )
        actions = TouchAction(context.mobile["driver"])
        actions.pinch(element).perform()
        send_step_details(context, f"Zoomed in on element with id {element_id}")
    except Exception as e:
        raise CustomError(
            f"Could not zoom in on element with id {element_id}: {str(e)}"
        )


@step('Pinch to zoom out on element with id "{element_id}"')
@done('Pinch to zoom out on element with id "{element_id}"')
def pinch_to_zoom_out(context, element_id):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Pinching to zoom out on element with id {element_id}")
    logger.debug(f"Pinching to zoom out on element with id {element_id}")
    try:
        element = waitSelector(
            context=context, selector_type="id", selector_value=element_id
        )
        actions = TouchAction(context.mobile["driver"])
        actions.zoom(element).perform()
        send_step_details(context, f"Zoomed out on element with id {element_id}")
    except Exception as e:
        raise CustomError(
            f"Could not zoom out on element with id {element_id}: {str(e)}"
        )


@step("Rotate screen to landscape mode")
@done("Rotate screen to landscape mode")
def rotate_screen_to_landscape(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Rotating screen to landscape mode")
    logger.debug("Rotating screen to landscape mode")
    try:
        context.mobile["driver"].orientation = "LANDSCAPE"
        send_step_details(context, "Screen rotated to landscape mode successfully")
    except Exception as e:
        raise CustomError(f"Could not rotate screen to landscape mode: {str(e)}")


@step("Rotate screen to portrait mode")
@done("Rotate screen to portrait mode")
def rotate_screen_to_portrait(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Rotating screen to portrait mode")
    logger.debug("Rotating screen to portrait mode")
    try:
        context.mobile["driver"].orientation = "PORTRAIT"
        send_step_details(context, "Screen rotated to portrait mode successfully")
    except Exception as e:
        raise CustomError(f"Could not rotate screen to portrait mode: {str(e)}")


@step('Check if app "{app_package}" is installed on device "{device_name}"')
@done('Check if app "{app_package}" is installed on device "{device_name}"')
def check_if_app_installed(context, app_package, device_name):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context, f"Checking if app {app_package} is installed on device {device_name}"
    )
    logger.debug(f"Checking if app {app_package} is installed on device {device_name}")
    try:
        is_installed = context.mobile["driver"].is_app_installed(app_package)
        if not is_installed:
            raise CustomError(
                f"App {app_package} is not installed on device {device_name}"
            )
        send_step_details(
            context, f"App {app_package} is installed on device {device_name}"
        )
    except Exception as e:
        raise CustomError(
            f"Could not check if app {app_package} is installed on device {device_name}: {str(e)}"
        )


@step('Check if app "{app_package}" is running on device "{device_name}"')
@done('Check if app "{app_package}" is running on device "{device_name}"')
def check_if_app_running(context, app_package, device_name):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context, f"Checking if app {app_package} is running on device {device_name}"
    )
    logger.debug(f"Checking if app {app_package} is running on device {device_name}")
    try:
        # Appium does not have a direct method to check if the app is running.
        # This might need a custom implementation based on platform-specific commands.
        raise CustomError(
            f"App running status for {app_package} on {device_name} requires platform-specific handling."
        )
    except Exception as e:
        raise CustomError(
            f"Could not check if app {app_package} is running on device {device_name}: {str(e)}"
        )


@step("Capture logs from mobile device")
@done("Capture logs from mobile device")
def capture_logs_from_mobile_device(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Capturing logs from mobile device")
    logger.debug("Capturing logs from mobile device")
    try:
        logs = context.mobile["driver"].get_log("logcat")
        send_step_details(context, f"Captured logs from mobile device: {logs}")
        return logs
    except Exception as e:
        raise CustomError(f"Could not capture logs from mobile device: {str(e)}")


@step("Get current device orientation")
@done("Get current device orientation")
def get_current_device_orientation(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Getting current device orientation")
    logger.debug("Getting current device orientation")
    try:
        orientation = context.mobile["driver"].orientation
        send_step_details(context, f"Current device orientation is {orientation}")
        return orientation
    except Exception as e:
        raise CustomError(f"Could not get current device orientation: {str(e)}")


@step('Change device orientation to "{orientation}"')
@done('Change device orientation to "{orientation}"')
def change_device_orientation(context, orientation):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Changing device orientation to {orientation}")
    logger.debug(f"Changing device orientation to {orientation}")
    try:
        context.mobile["driver"].orientation = orientation.upper()
        send_step_details(context, f"Device orientation changed to {orientation}")
    except Exception as e:
        raise CustomError(
            f"Could not change device orientation to {orientation}: {str(e)}"
        )


@step("Lock the screen")
@done("Lock the screen")
def lock_screen(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Locking the screen")
    logger.debug("Locking the screen")
    try:
        context.mobile["driver"].lock()
        send_step_details(context, "Screen locked successfully")
    except Exception as e:
        raise CustomError(f"Could not lock the screen: {str(e)}")


@step("Unlock the screen")
@done("Unlock the screen")
def unlock_screen(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Unlocking the screen")
    logger.debug("Unlocking the screen")
    try:
        context.mobile["driver"].unlock()
        send_step_details(context, "Screen unlocked successfully")
    except Exception as e:
        raise CustomError(f"Could not unlock the screen: {str(e)}")


@step("Check network status of mobile device")
@done("Check network status of mobile device")
def check_network_status(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Checking network status of mobile device")
    logger.debug("Checking network status of mobile device")
    try:
        network_status = context.mobile["driver"].get_network_connection()
        send_step_details(context, f"Network status of mobile device: {network_status}")
        return network_status
    except Exception as e:
        raise CustomError(f"Could not check network status of mobile device: {str(e)}")


@step('Switch to mobile app context "{context}"')
@done('Switch to mobile app context "{context}"')
def switch_to_mobile_app_context(context, app_context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Switching to mobile app context {app_context}")
    logger.debug(f"Switching to mobile app context {app_context}")
    try:
        context.mobile["driver"].switch_to.context(app_context)
        send_step_details(
            context, f"Switched to mobile app context {app_context} successfully"
        )
    except Exception as e:
        raise CustomError(
            f"Could not switch to mobile app context {app_context}: {str(e)}"
        )


@step('Check if element with text "{text}" is visible')
@done('Check if element with text "{text}" is visible')
def check_if_element_with_text_is_visible(context, text):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Checking if element with text '{text}' is visible")
    logger.debug(f"Checking if element with text '{text}' is visible")
    try:
        element = waitSelector(
            context=context,
            selector_type="xpath",
            selector_value=f"//*[contains(text(),'{text}')]",
        )
        if not element.is_displayed():
            raise CustomError(f"Element with text '{text}' is not visible")
        send_step_details(context, f"Element with text '{text}' is visible")
    except Exception as e:
        raise CustomError(
            f"Could not check visibility of element with text '{text}': {str(e)}"
        )


@step('Perform drag and drop from "{start_element}" to "{end_element}"')
@done('Perform drag and drop from "{start_element}" to "{end_element}"')
def perform_drag_and_drop(context, start_element, end_element):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context, f"Performing drag and drop from '{start_element}' to '{end_element}'"
    )
    logger.debug(f"Performing drag and drop from '{start_element}' to '{end_element}'")
    try:
        start = waitSelector(
            context=context, selector_type="id", selector_value=start_element
        )
        end = waitSelector(
            context=context, selector_type="id", selector_value=end_element
        )
        actions = TouchAction(context.mobile["driver"])
        actions.long_press(start).move_to(end).release().perform()
        send_step_details(
            context,
            f"Drag and drop from '{start_element}' to '{end_element}' completed successfully",
        )
    except Exception as e:
        raise CustomError(f"Could not perform drag and drop: {str(e)}")


@step('Perform multi-touch on element with id "{element_id}"')
@done('Perform multi-touch on element with id "{element_id}"')
def perform_multi_touch_on_element(context, element_id):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context, f"Performing multi-touch on element with id '{element_id}'"
    )
    logger.debug(f"Performing multi-touch on element with id '{element_id}'")
    try:
        element = waitSelector(
            context=context, selector_type="id", selector_value=element_id
        )
        action1 = TouchAction(context.mobile["driver"]).tap(element)
        action2 = TouchAction(context.mobile["driver"]).tap(element)
        multi_action = MultiAction(context.mobile["driver"])
        multi_action.add(action1, action2)
        multi_action.perform()
        send_step_details(
            context,
            f"Multi-touch on element with id '{element_id}' performed successfully",
        )
    except Exception as e:
        raise CustomError(
            f"Could not perform multi-touch on element with id '{element_id}': {str(e)}"
        )


@step('Wait for element with "{selector_type}" "{selector_value}" to appear')
@done('Wait for element with "{selector_type}" "{selector_value}" to appear')
def wait_for_element_to_appear(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context, f"Waiting for element with {selector_type}: {selector_value} to appear"
    )
    logger.debug(
        f"Waiting for element with {selector_type}: {selector_value} to appear"
    )
    try:
        waitSelector(
            context=context, selector_type=selector_type, selector_value=selector_value
        )
        send_step_details(
            context, f"Element with {selector_type}: {selector_value} appeared"
        )
    except Exception as e:
        raise CustomError(
            f"Element with {selector_type}: {selector_value} did not appear: {str(e)}"
        )


@step('Wait for element with "{selector_type}" "{selector_value}" to disappear')
@done('Wait for element with "{selector_type}" "{selector_value}" to disappear')
def wait_for_element_to_disappear(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Waiting for element with {selector_type}: {selector_value} to disappear",
    )
    logger.debug(
        f"Waiting for element with {selector_type}: {selector_value} to disappear"
    )
    try:
        WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until_not(
            EC.presence_of_element_located((selector_type, selector_value))
        )
        send_step_details(
            context, f"Element with {selector_type}: {selector_value} disappeared"
        )
    except Exception as e:
        raise CustomError(
            f"Element with {selector_type}: {selector_value} did not disappear: {str(e)}"
        )


@step('Tap on "{element}"')
@done('Tap on "{element}"')
def tap_on_element(context, element):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Tapping on element '{element}'")
    logger.debug(f"Tapping on element '{element}'")
    try:
        elem = waitSelector(context=context, selector_type="id", selector_value=element)
        actions = TouchAction(context.mobile["driver"])
        actions.tap(elem).perform()
        send_step_details(context, f"Tapped on element '{element}' successfully")
    except Exception as e:
        raise CustomError(f"Could not tap on element '{element}': {str(e)}")


@step('Validate text "{text}" on mobile screen')
@done('Validate text "{text}" on mobile screen')
def validate_text_on_mobile_screen(context, text):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Validating text '{text}' on mobile screen")
    logger.debug(f"Validating text '{text}' on mobile screen")
    try:
        element = waitSelector(
            context=context,
            selector_type="xpath",
            selector_value=f"//*[contains(text(),'{text}')]",
        )
        if text not in element.text:
            raise CustomError(f"Text '{text}' not found on mobile screen")
        send_step_details(context, f"Text '{text}' validated on mobile screen")
    except Exception as e:
        raise CustomError(
            f"Could not validate text '{text}' on mobile screen: {str(e)}"
        )


@step("Capture device performance metrics")
@done("Capture device performance metrics")
def capture_device_performance_metrics(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Capturing device performance metrics")
    logger.debug("Capturing device performance metrics")
    try:
        performance_metrics = context.mobile["driver"].get_performance_data(
            "system", "cpuinfo", 5
        )
        send_step_details(
            context, f"Device performance metrics captured: {performance_metrics}"
        )
        return performance_metrics
    except Exception as e:
        raise CustomError(f"Could not capture device performance metrics: {str(e)}")


@step('Fetch mobile device details and store in the "{variable}"')
@done('Fetch mobile device details and store in the "{variable}"')
def fetch_mobile_device_details(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Fetching mobile device details")
    logger.debug("Fetching mobile device details")
    try:
        device_details = context.mobile["driver"].desired_capabilities
        send_step_details(context, f"Mobile device details: {device_details}")
        return device_details
    except Exception as e:
        raise CustomError(f"Could not fetch mobile device details: {str(e)}")


@step('Set geolocation to "{latitude}, {longitude}"')
@done('Set geolocation to "{latitude}, {longitude}"')
def set_geolocation(context, latitude, longitude):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Setting geolocation to {latitude}, {longitude}")
    logger.debug(f"Setting geolocation to {latitude}, {longitude}")
    try:
        context.mobile["driver"].set_location(float(latitude), float(longitude), 0)
        send_step_details(
            context, f"Geolocation set to {latitude}, {longitude} successfully"
        )
    except Exception as e:
        raise CustomError(
            f"Could not set geolocation to {latitude}, {longitude}: {str(e)}"
        )


@step('Set mobile timezone to "{timezone}"')
@done('Set mobile timezone to "{timezone}"')
def set_mobile_timezone(context, timezone):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Setting mobile device timezone to {timezone}")
    logger.debug(f"Setting mobile device timezone to {timezone}")
    try:
        context.mobile["driver"].execute_script(
            "mobile: shell",
            {"command": "settings", "args": ["put", "global", "time_zone", timezone]},
        )
        send_step_details(
            context, f"Mobile device timezone set to {timezone} successfully"
        )
    except Exception as e:
        raise CustomError(
            f"Could not set mobile device timezone to {timezone}: {str(e)}"
        )


@step('Check if element with "{selector_type}" "{selector_value}" is visible')
@done('Check if element with "{selector_type}" "{selector_value}" is visible')
def check_if_element_visible(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector_type}: {selector_value} is visible",
    )
    logger.debug(
        f"Checking if element with {selector_type}: {selector_value} is visible"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    if not element.is_displayed():
        raise CustomError(
            f"Element with {selector_type}: {selector_value} is not visible"
        )
    send_step_details(
        context, f"Element with {selector_type}: {selector_value} is visible"
    )
    return True


@step('Check if element with "{selector_type}" "{selector_value}" is not visible')
@done('Check if element with "{selector_type}" "{selector_value}" is not visible')
def check_if_element_not_visible(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector_type}: {selector_value} is not visible",
    )
    logger.debug(
        f"Checking if element with {selector_type}: {selector_value} is not visible"
    )
    try:
        WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until_not(
            EC.visibility_of_element_located(
                waitSelector(context, selector_type, selector_value)
            )
        )
        send_step_details(
            context, f"Element with {selector_type}: {selector_value} is not visible"
        )
        return True
    except:
        raise CustomError(
            f"Element with {selector_type}: {selector_value} is still visible"
        )


@step('Check if element with "{selector_type}" "{selector_value}" is enabled')
@done('Check if element with "{selector_type}" "{selector_value}" is enabled')
def check_if_element_enabled(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector_type}: {selector_value} is enabled",
    )
    logger.debug(
        f"Checking if element with {selector_type}: {selector_value} is enabled"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    if not element.is_enabled():
        raise CustomError(
            f"Element with {selector_type}: {selector_value} is not enabled"
        )
    send_step_details(
        context, f"Element with {selector_type}: {selector_value} is enabled"
    )
    return True


@step('Check if element with "{selector_type}" "{selector_value}" is not enabled')
@done('Check if element with "{selector_type}" "{selector_value}" is not enabled')
def check_if_element_not_enabled(context, selector_type, selector_value):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector_type}: {selector_value} is not enabled",
    )
    logger.debug(
        f"Checking if element with {selector_type}: {selector_value} is not enabled"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector_value=selector_value
    )
    if element.is_enabled():
        raise CustomError(
            f"Element with {selector_type}: {selector_value} is still enabled"
        )
    send_step_details(
        context, f"Element with {selector_type}: {selector_value} is not enabled"
    )
    return True


@step(
    'Check if element with "{selector_type}" "{selector_value}" contains text "{text}"'
)
@done(
    'Check if element with "{selector_type}" "{selector_value}" contains text "{text}"'
)
def check_if_element_contains_text(context, selector_type, selector_value, text):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector_type}: {selector_value} contains text: {text}",
    )
    logger.debug(
        f"Checking if element with {selector_type}: {selector_value} contains text: {text}"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    element_text = element.text
    if text not in element_text:
        raise CustomError(
            f"Element with {selector_type}: {selector_value} does not contain text '{text}'"
        )
    send_step_details(
        context,
        f"Element with {selector_type}: {selector_value} contains text '{text}'",
    )
    return True


@step(
    'Check if element with "{selector_type}" "{selector_value}" does not contain text "{text}"'
)
@done(
    'Check if element with "{selector_type}" "{selector_value}" does not contain text "{text}"'
)
def check_if_element_not_contains_text(context, selector_type, selector_value, text):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector_type}: {selector_value} does not contain text: {text}",
    )
    logger.debug(
        f"Checking if element with {selector_type}: {selector_value} does not contain text: {text}"
    )
    element = waitSelector(
        context=context, selector_type=selector_type, selector=selector_value
    )
    element_text = element.text
    if text in element_text:
        raise CustomError(
            f"Element with {selector_type}: {selector_value} contains text '{text}'"
        )
    send_step_details(
        context,
        f"Element with {selector_type}: {selector_value} does not contain text '{text}'",
    )
    return True


@step('Validate if current screen contains "{object_name}"')
@done('Validate if current screen contains "{object_name}"')
def validate_if_screen_contains_object(context, object_name):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Validating if current screen contains '{object_name}'")
    logger.debug(f"Validating if current screen contains '{object_name}'")
    screen_text = context.mobile["driver"].page_source
    if object_name not in screen_text:
        raise CustomError(f"'{object_name}' did not appear on the screen")
    send_step_details(context, f"Current screen contains '{object_name}'")
    return True

import base64
import time
import logging
import json
import sys, traceback
import sys, requests, re, json

import jq
from appium import webdriver as mobile_driver
from selenium.webdriver.remote.webelement import WebElement
from appium.options.android import UiAutomator2Options
from appium.options.ios import XCUITestOptions
from appium.options.common.base import AppiumOptions

from appium.webdriver.common.appiumby import AppiumBy
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.actions.wheel_input import ScrollOrigin

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

from behave import step, use_step_matcher

sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")

from utility.functions import *
from tools.exceptions import *
from tools.common import send_step_details, decryptFile, waitSelector
from tools.common_functions import *
from tools.service_manager import ServiceManager
from .utils.mobile_actions_utils import upload_file_to_appium_container, perform_swipe

# setup logging
logger = logging.getLogger("FeatureExecution")

use_step_matcher("parse")

# Start a mobile emulator with specified capabilities and reference it to a variable
# Example: Start mobile "Android_Emulator" use capabilities """{"platformName": "Android", "app": "/path/to/app.apk"} """ reference to "myMobile"
@step(u'Start mobile "{mobile_name}" use capabilities "{capabilities}" reference to "{variable_name}"')
@done(u'Start mobile "{mobile_name}" use capabilities "{capabilities}" reference to "{variable_name}"')
def start_mobile_and_application(context, mobile_name, capabilities="{}", variable_name=None):
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
    # service_manager.prepare_emulator_service_configuration(
    #     image=mobile_configuration["mobile_json"]["image"]
    # )
    # send_step_details(context, "Starting mobile container")
    # service_details = service_manager.create_service()
    # logger.debug(f"Service created with Id {service_details['Id']}")
    
    
    new_container_data = {'image': mobile_configuration['mobile_id'], 'service_type': 'Emulator', 'department_id': 1, 'shared': False, 'created_by': 1, 'do_not_create_container': True}
    
    response = call_backend(method="POST", path="/api/container_service/", body=new_container_data)
    
    if not response.status_code == 201:
        raise CustomError(f"Could not store the container information in the backend for mobile, status_code : {response.status_code}")

    service_id = response.json()['service_id']
    logger.debug("Service ID")
    
    service_details = service_manager.inspect_service(service_name_or_id=service_id)
    
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
        # Upload apk file in the emulator container 
        file_name = upload_file_to_appium_container(
            context, service_details["Id"], mobile_configuration["capabilities"]["app"]
        )
        mobile_configuration["capabilities"]["app"] = f"/tmp/{file_name}"

    mobile_configuration["capabilities"]["is_test"] = True
    
    if context.record_video:
        mobile_configuration["capabilities"]["record_video"] = True 
    
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
        "mobile_configuration": mobile_configuration,
    }
    if context.record_video:
        logger.info("Video recordig enabled")
        mobile_info['session_id'] = new_mobile.session_id[0].replace('-','')
        
    # Save in the list of mobile
    context.mobiles[variable_name if variable_name else "default"] = mobile_info
    # Save in the list of mobile to use it without iterating
    context.mobile = mobile_info
    
    data = {
        "feature_result_id": int(context.FEATURE_RESULT_ID),
        "mobile": [
            {   
                "name": key,
                "is_started_by_test": True,
                "container_service_details": mobile['container_service_details'],
                "mobile_configuration": mobile['mobile_configuration'],
                "session_id": mobile['session_id'] if context.record_video else "",
                "video_recording": f"/videos/{mobile['session_id']}.mp4" if context.record_video else ""
            } for key, mobile in context.mobiles.items()
        ],
    }

    call_backend(method="PATCH", path="/api/feature_results/", body=data)

# Connect to an existing mobile device with specified capabilities and reference it to a variable
# Example: Connect to mobile "Android_1234" use capabilities """
# {
#   "platformName": "Android",
#   "noReset": true
# }
# """ reference to "connectedMobile"
@step(u'Connect to mobile "{mobile_code}" use capabilities "{capabilities}" reference to "{variable_name}"')
@done(u'Connect to mobile "{mobile_code}" use capabilities "{capabilities}" reference to "{variable_name}"')
def connect_mobile_and_application(context, mobile_code, capabilities={}, variable_name=None):
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
        
    mobile_configuration["capabilities"]["is_test"] = True

    if context.record_video:
        mobile_configuration["capabilities"]["record_video"] = True
    
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
        "mobile_configuration": mobile_configuration,
    }
    if context.record_video:
        logger.info("Video recordig enabled")
        mobile_info['session_id'] = new_mobile.session_id.replace('-','')
    # Save in the list of mobile
    context.mobiles[variable_name if variable_name else "default"] = mobile_info
    # Save in the list of mobile to use it without iterating
    context.mobile = mobile_info
    
    data = {
        "feature_result_id": int(context.FEATURE_RESULT_ID),
        "mobile": [
            {
                "name": key,
                "is_started_by_test": False,
                "container_service_details": mobile['container_service_details'],
                "mobile_configuration": mobile['mobile_configuration'],
                "session_id": mobile['session_id'] if context.record_video else "",
                "video_recording": f"/videos/{mobile['session_id']}.mp4" if context.record_video else ""
            } for key, mobile in context.mobiles.items()
        ],
    }

    call_backend(method="PATCH", path="/api/feature_results/", body=data)

# Switch the current mobile context to a different mobile device
# Example: Switch mobile to "fd12345d12a1"
@step('Switch mobile to "{variable_name}"')
@done('Switch mobile to "{variable_name}"')
def switch_mobile(context, variable_name):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Changing current mobile to {variable_name}")
    context.mobile = context.mobiles[variable_name]

# Install an APK file on the mobile device
# Example: Install app "new_app.apk"
@step('Install app "{apk_file_path}" on mobile')
@done('Install app "{apk_file_path}" on mobile')
def install_app(context, apk_file_path):
    context.STEP_TYPE = "MOBILE"
    # select the upload element to send the filenames to
    # get the target file or files
    service_id = context.mobile["container_service_details"]["Id"]
    file_name = upload_file_to_appium_container(context, service_id, apk_file_path)

    logger.debug(f"Installing app")
    send_step_details(context, f"Installing app")
    service_manager = ServiceManager()
    result, message = service_manager.install_apk(
        service_name_or_id=service_id, apk_file_name=file_name
    )
    if not result:
        raise CustomError(message)


# Tap on a mobile element identified by XPath selector
# Example: On mobile tap on "//android.widget.TextView[@text="Next"]"
@step('On mobile tap on "{selector}"')  
@done('On mobile tap on "{selector}"')
def tap_on_element(context, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Initiating tap action on element with {selector}",
    )
    logger.debug(f"Attempting to tap on element with {selector}")
    elements = waitSelector(
        context=context, selector_type="xpath", selector=selector
    )    
    # waitSelector method might also return the list of webelement
    if not isinstance(elements, WebElement):
        elements = elements[0]
        
    actions = ActionChains(context.mobile["driver"])
    actions.click(elements).perform()
    send_step_details(
        context, f"Tapped on element with {selector}"
    )


# Performs a long press on an element for a specified duration
# Example: Long press element "//*[@id='button']"
@step('On mobile long press "{selector}" for "{time}" seconds')
@done('On mobile long press "{selector}" for "{time}" seconds')
def long_press_on_element(context, selector, time=2):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Initiating long press action on element with {selector}",
    )
    logger.debug(
        f"Attempting to long press on element with {selector}"
    )
    elements = waitSelector(
        context=context, selector_type="xpath", selector=selector
    )
    # waitSelector method might also return the list of webelement
    if not isinstance(elements, WebElement):
        elements = elements[0]
    
    time = int(time)
    actions = ActionChains(context.mobile["driver"])
    actions.click_and_hold(elements).pause(time).release().perform()
    send_step_details(
        context, f"Long pressed on element with {selector}"
    )

# Performs a double tap on an element
# Example: Double tap on element "//*[@id='button']"
@step('On mobile double tap on "{selector}"')
@done('On mobile double tap on "{selector}"')
def double_tap_on_element(context, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Initiating double tap action on element with {selector}",
    )
    logger.debug(
        f"Attempting to double tap on element with {selector}"
    )
    elements = waitSelector(
        context=context, selector_type="xpath", selector=selector
    )
    # waitSelector method might also return the list of webelement
    if not isinstance(elements, WebElement):
        elements = elements[0]
        
    actions = ActionChains(context.mobile["driver"])
    actions.double_click(elements).perform()
    send_step_details(
        context, f"Double tapped on element with {selector}"
    )

# Performs a swipe to the right on an element by specified pixels
# Example: Swipe right on element "//*[@id='slider']" by "300"
@step(u'On mobile swipe right "{selector}" by "{default_200}"px')
@done(u'On mobile swipe right "{selector}" by "{default_200}"px')
def swipe_right_on_element(context, selector, default_200=200):
    context.STEP_TYPE = "MOBILE"
    px = int(default_200) if default_200 else 200  # Set default swipe distance if `px` is not provided
    perform_swipe(context, selector, x_offset=px, y_offset=0, direction="right")


# Performs a swipe to the left on an element by specified pixels
# Example: Swipe left on element "//*[@id='slider']" by "300"
@step(u'On mobile swipe left "{selector}" by "{default_200}"px')
@done(u'On mobile swipe left "{selector}" by "{default_200}"px')
def swipe_left_on_element(context, selector, default_200=200):
    context.STEP_TYPE = "MOBILE"
    px = int(default_200) if default_200 else 200
    perform_swipe(context, selector, x_offset=-px, y_offset=0, direction="left")


# Performs a swipe up on an element by specified pixels
# Example: Swipe up on element "//*[@id='list']" by "400"
@step(u'On mobile swipe up "{selector}" by "{default_200}"px')
@done(u'On mobile swipe up "{selector}" by "{default_200}"px')
def swipe_up_on_element(context, selector, default_200=200):
    context.STEP_TYPE = "MOBILE"
    px = int(default_200) if default_200 else 200
    perform_swipe(context, selector, x_offset=0, y_offset=-px, direction="up")


# Performs a swipe down on an element by specified pixels
# Example: Swipe down on element "//*[@id='list']" by "400"
@step(u'On mobile swipe down "{selector}" by "{default_200}"px')
@done(u'On mobile swipe down "{selector}" by "{default_200}"px')
def swipe_down_on_element(context, selector, default_200=200):
    context.STEP_TYPE = "MOBILE"
    px = int(default_200) if default_200 else 200
    perform_swipe(context, selector, x_offset=0, y_offset=px, direction="down")


# Performs a swipe between two specific coordinates
# Example: Swipe from coordinate "100,200" to "300,400"
@step(u'On mobile swipe from coordinate "{start_x},{start_y}" to "{end_x},{end_y}"')
@done(u'On mobile swipe from coordinate "{start_x},{start_y}" to "{end_x},{end_y}"')
def swipe_using_coordinate(context, start_x,start_y, end_x, end_y):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Swiping from coordinate '({start_x},{start_y})' to coordinate '({end_x},{end_y})'",
    )
    logger.debug(
        f"Swiping from coordinate '({start_x},{start_y})' to coordinate '({end_x},{end_y})'",
    )
    # Use W3C Actions API to perform the swipe
    actions = ActionChains(context.mobile["driver"])
    actions.w3c_actions.pointer_action.move_to_location(start_x, start_y)
    actions.w3c_actions.pointer_action.pointer_down()
    actions.w3c_actions.pointer_action.move_to_location(end_x, end_y)
    actions.w3c_actions.pointer_action.release()
    actions.perform()
    send_step_details(
        context, f"Swiped from coordinate '({start_x},{start_y})' to coordinate '({end_x},{end_y})'",
    )

# Sets the value of a mobile input element identified by the provided selector
# Example: Set value "Hello World" on the mobile element "//*[@id='input']"
@step('On mobile set value "{text}" on "{selector}"')
@done('On mobile set value "{text}" on "{selector}"')
def set_value_on_element(context, text, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Setting value '{text}' on element with {selector}",
    )
    logger.debug(
        f"Setting value '{text}' on element with {selector}"
    )
    elements = waitSelector(
        context=context, selector_type="xpath", selector=selector
    )
    # waitSelector method might also return the list of webelement
    if not isinstance(elements, WebElement):
        elements = elements[0]
    elements.send_keys(text)
    send_step_details(
        context, f"Value '{text}' set on element with {selector}"
    )

# Clears the content of a textbox identified by the provided selector
# Example: Clear textbox "//*[@id='input']"
@step('On mobile clear textbox "{selector}"')
@done('On mobile clear textbox "{selector}"')
def set_value_on_element(context, text, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Clearing textbox with element with {selector}",
    )
    logger.debug(
         f"Clearing textbox with element with {selector}",
    )
    elements = waitSelector(
        context=context, selector_type="xpath", selector=selector
    )
    # waitSelector method might also return the list of webelement
    if not isinstance(elements, WebElement):
        elements = elements[0]
    elements.clear(text)
    send_step_details(
        context, f"Textbox cleared"
    )

# Checks if an element is not visible on the screen
# Example: Check if element "//*[@id='popup']" is not visible
@step('On mobile assert if "{selector}" is not visible')
@done('On mobile assert if "{selector}" is not visible')
def check_if_element_not_visible(context, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector} is not visible",
    )
    logger.debug(
        f"Checking if element with {selector} is not visible"
    )
    try:
        WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until_not(
            EC.visibility_of_element_located(
                waitSelector(context, selector)
            )
        )
        send_step_details(
            context, f"Element with {selector} is not visible"
        )
        return True
    except:
        raise CustomError(
            f"Element with {selector} is still visible"
        )

# Checks if an element is enabled on the screen
# Example: Check if element "//*[@id='submit']" is enabled
@step('On mobile assert if "{selector}" is enabled')
@done('On mobile assert if "{selector}" is enabled')
def check_if_element_enabled(context, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector} is enabled",
    )
    logger.debug(
        f"Checking if element with {selector} is enabled"
    )
    elements = waitSelector(
        context=context, selector_type="xpath", selector=selector
    )
    # waitSelector method might also return the list of webelement
    if not isinstance(elements, WebElement):
        elements = elements[0]
        
    if not elements.is_enabled():
        raise CustomError(
            f"Element with {selector} is not enabled"
        )
    send_step_details(
        context, f"Element with {selector} is enabled"
    )
    return True


# Checks if an element is not enabled on the screen
# Example: Check if element "//*[@id='submit']" is not enabled
@step('On mobile assert if "{selector}" is not enabled')
@done('On mobile assert if "{selector}" is not enabled')
def check_if_element_not_enabled(context, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector} is not enabled",
    )
    logger.debug(
        f"Checking if element with {selector} is not enabled"
    )
    elements = waitSelector(
        context=context, selector_type="xpath", selector=selector
    )
    # waitSelector method might also return the list of webelement
    if not isinstance(elements, WebElement):
        elements = elements[0]
        
    if elements.is_enabled():
        raise CustomError(
            f"Element with {selector} is enabled"
        )
    send_step_details(
        context, f"Element with {selector} is not enabled"
    )
    return True


# Checks if an element contains the specified text
# Example: Check if element "//*[@id='message']" contains text "Welcome"
@step('On mobile assert if "{selector}" contains text "{text}"')
@done('On mobile assert if "{selector}" contains text "{text}"')
def check_if_element_contains_text(context, selector, text):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector} contains text: {text}",
    )
    logger.debug(
        f"Checking if element with {selector} contains text: {text}"
    )
    elements = waitSelector(
        context=context, selector_type="xpath", selector=selector
    )
    # waitSelector method might also return the list of webelement
    if not isinstance(elements, WebElement):
        elements = elements[0]
        
    element_text = elements.text
    if text not in element_text:
        raise CustomError(
            f"Element with {selector} does not contain text '{text}'"
        )
    send_step_details(
        context,
        f"Element with {selector} contains text '{text}'",
    )
    return True


# Checks if an element does not contain the specified text
# Example: Check if element "//*[@id='message']" does not contain text "Error"
@step('On mobile assert if "{selector}" does not contain text "{text}"')
@done('On mobile assert if "{selector}" does not contain text "{text}"')
def check_if_element_not_contains_text(context, selector, text):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector} does not contain text: {text}",
    )
    logger.debug(
        f"Checking if element with {selector} does not contain text: {text}"
    )
    elements = waitSelector(
        context=context, selector_type="xpath", selector=selector
    )
    # waitSelector method might also return the list of webelement
    if not isinstance(elements, WebElement):
        elements = elements[0]
    element_text = elements.text
    if text in element_text:
        raise CustomError(
            f"Element with {selector} contains text '{text}'"
        )
    send_step_details(
        context,
        f"Element with {selector} does not contain text '{text}'",
    )
    return True


# Validates if the current screen contains the specified object (text or element)
# Example: Validate if current screen contains "Welcome"
@step('On mobile assert if screen contains "{object_name}"') 
@done('On mobile assert if screen contains "{object_name}"')
def validate_if_screen_contains_object(context, object_name):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Validating if current screen contains '{object_name}'")
    logger.debug(f"Validating if current screen contains '{object_name}'")
    screen_text = context.mobile["driver"].page_source
    if object_name not in screen_text:
        raise CustomError(f"'{object_name}' did not appear on the screen")
    send_step_details(context, f"Current screen contains '{object_name}'")
    return True


# Switches to the specified frame using its ID
# Example: Switch to frame with id "frame1"
@step('On mobile switch to frame with id "{frame_id}"')
@done('On mobile switch to frame with id "{frame_id}"')
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



# Starts the specified mobile app using its package and activity name
# Example: Start the mobile app "com.example.app" "com.example.app.MainActivity"
@step('On mobile start app "{app_package}" "{app_activity}"')
@done('On mobile start app "{app_package}" "{app_activity}"')
def start_mobile_app(context, app_package, app_activity):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Starting the mobile app")
    logger.debug("Starting the mobile app")
    try:
        try:
            context.mobile["driver"].start_activity(app_package, app_activity)
        except:
            context.mobile["driver"].execute_script("mobile: shell", {
                "command": "am start",
                "args": ["-n", f"{app_package}/{app_activity}"],
                "includeStderr": True,
                "timeout": 5000
            })
        send_step_details(context, "Mobile app started successfully")
    except Exception as e:
        raise CustomError(f"Could not start the mobile application: {str(e)}")
    

# Closes the mobile app using its package name
# Example: Close the mobile app "com.example.apk"
@step('On mobile close app "{app_package}"')
@done('On mobile close app "{app_package}"')
def close_mobile_application(context, app_package):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Closing the mobile application")
    logger.debug("Closing the mobile application")
    try:
                # Try using close_app() if available
        if hasattr(context.mobile["driver"], "close_app"):
            context.mobile["driver"].close_app()
        else:
            # Fallback to terminate_app()
            context.mobile["driver"].terminate_app(app_package)
        send_step_details(context, "Mobile application closed successfully")
    except Exception as e:
        raise CustomError(f"Could not close the mobile application: {str(e)}")
    

# Uninstalls the specified app from the device
# Example: Uninstall app "com.example.apk" with "Do not fail"
@step('On mobile uninstall app "{app_package}" with "{option}"')
@done('On mobile uninstall app "{app_package}" with "{option}"')
def uninstall_app_from_device(context, app_package, option):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context, f"Uninstalling app {app_package}"
    )
    logger.debug(f"Uninstalling app {app_package}")
    try:
        context.mobile["driver"].remove_app(app_package)
        send_step_details(
            context,
            f"App {app_package} uninstalled successfully",
        )
    except Exception as e:
        if not option=="Do not fail":
            raise CustomError(
                f"Could not uninstall app {app_package}: {str(e)}"
            )

# Taps on the given screen coordinates (x, y)
# Example: Tap on coordinates "100, 200"
@step(u'On mobile tap on coordinates "{x}, {y}"')
@done(u'On mobile tap on coordinates "{x}, {y}"')
def tap_on_coordinates(context, x, y):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Tapping on coordinates {x}, {y}")
    logger.debug(f"Tapping on coordinates {x}, {y}")
    try:
        actions = ActionChains(context.mobile["driver"])
        actions.w3c_actions.pointer_action.move_to_location(int(x), int(y))
        actions.w3c_actions.pointer_action.pointer_down()
        actions.w3c_actions.pointer_action.pointer_up()
        actions.perform()
        send_step_details(context, f"Tapped on coordinates {x}, {y} successfully")
    except Exception as e:
        raise CustomError(f"Could not tap on coordinates {x}, {y}: {str(e)}")

# Pinches to zoom in on the element identified by the given selector
# Example: Pinch to zoom in on element with "//*[@id='zoomable-element']"
@step(u'On mobile pinch to zoom in with "{selector}"')
@done(u'On mobile pinch to zoom in with "{selector}"')
def pinch_to_zoom_in(context, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Pinch to zoom in on element with selector: {selector}")
    logger.debug(f"Pinching to zoom in on element with selector: {selector}")
    try:
        element = waitSelector(context=context, selector_type="xpath", selector=selector)
        
        width = element.size['width']
        height = element.size['height']
        center_x = element.location['x'] + width / 2
        center_y = element.location['y'] + height / 2

        # Initial positions for pinch
        actions = ActionChains(context.mobile["driver"])
        actions.w3c_actions.pointer_action.move_to_location(center_x - 50, center_y - 50)
        actions.w3c_actions.pointer_action.pointer_down()
        actions.w3c_actions.pointer_action.move_to_location(center_x - 10, center_y - 10)
        actions.w3c_actions.pointer_action.pointer_up()

        actions.w3c_actions.pointer_action.move_to_location(center_x + 50, center_y + 50)
        actions.w3c_actions.pointer_action.pointer_down()
        actions.w3c_actions.pointer_action.move_to_location(center_x + 10, center_y + 10)
        actions.w3c_actions.pointer_action.pointer_up()
        actions.perform()

        send_step_details(context, f"Zoomed in on element with selector {selector}")
    except Exception as e:
        raise CustomError(f"Could not zoom in on element with selector {selector}: {str(e)}")

# Pinches to zoom out on the element identified by the given selector
# Example: Pinch to zoom out on element with "//*[@id='zoomable-element']"
@step(u'On mobile pinch to zoom out with "{selector}"')
@done(u'On mobile pinch to zoom out with "{selector}"')
def pinch_to_zoom_out(context, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Pinch to zoom out on element with selector: {selector}")
    logger.debug(f"Pinching to zoom out on element with selector: {selector}")
    try:
        element = waitSelector(context=context, selector_type="xpath", selector=selector)

        width = element.size['width']
        height = element.size['height']
        center_x = element.location['x'] + width / 2
        center_y = element.location['y'] + height / 2

        # Initial positions for zoom out
        actions = ActionChains(context.mobile["driver"])
        actions.w3c_actions.pointer_action.move_to_location(center_x - 10, center_y - 10)
        actions.w3c_actions.pointer_action.pointer_down()
        actions.w3c_actions.pointer_action.move_to_location(center_x - 50, center_y - 50)
        actions.w3c_actions.pointer_action.pointer_up()

        actions.w3c_actions.pointer_action.move_to_location(center_x + 10, center_y + 10)
        actions.w3c_actions.pointer_action.pointer_down()
        actions.w3c_actions.pointer_action.move_to_location(center_x + 50, center_y + 50)
        actions.w3c_actions.pointer_action.pointer_up()
        actions.perform()

        send_step_details(context, f"Zoomed out on element with selector {selector}")
    except Exception as e:
        raise CustomError(f"Could not zoom out on element with selector {selector}: {str(e)}")

# Rotates the mobile device screen to landscape mode
# Example: Rotate screen to landscape mode
@step('On mobile rotate screen to landscape mode')
@done('On mobile rotate screen to landscape mode')
def rotate_screen_to_landscape(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Rotating screen to landscape mode")
    logger.debug("Rotating screen to landscape mode")
    try:
        context.mobile["driver"].orientation = "LANDSCAPE"
        send_step_details(context, "Screen rotated to landscape mode successfully")
    except Exception as e:
        raise CustomError(f"Could not rotate screen to landscape mode: {str(e)}")

# Rotates the mobile device screen to portrait mode
# Example: Rotate screen to portrait mode
@step('On mobile rotate screen to portrait mode')
@done('On mobile rotate screen to portrait mode')
def rotate_screen_to_portrait(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Rotating screen to portrait mode")
    logger.debug("Rotating screen to portrait mode")
    try:
        context.mobile["driver"].orientation = "PORTRAIT"
        send_step_details(context, "Screen rotated to portrait mode successfully")
    except Exception as e:
        raise CustomError(f"Could not rotate screen to portrait mode: {str(e)}")

# Checks if the specified app is installed on the given device
# Example: Check if app "com.example.apk" is installed on device "device_1"
@step('On mobile check if app "{app_package}" is installed on device "{device_name}"')
@done('On mobile check if app "{app_package}" is installed on device "{device_name}"')
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

# # Checks if the specified app is currently running on the given device.
# # Example: Check if app "com.example.app" is running on device "device_1"
# @step('On mobile check if app "(?P<app_package>.+?)" is running on device "(?P<device_name>.+?)"')
# @done('On mobile check if app "{app_package}" is running on device "{device_name}"')
# def check_if_app_running(context, app_package, device_name):
#     context.STEP_TYPE = "MOBILE"
#     send_step_details(
#         context, f"Checking if app {app_package} is running on device {device_name}"
#     )
#     logger.debug(f"Checking if app {app_package} is running on device {device_name}")
#     try:
#         # Appium does not have a direct method to check if the app is running.
#         # This might need a custom implementation based on platform-specific commands.
#         raise CustomError(
#             f"App running status for {app_package} on {device_name} requires platform-specific handling."
#         )
#     except Exception as e:
#         raise CustomError(
#             f"Could not check if app {app_package} is running on device {device_name}: {str(e)}"
#         )

# Captures logs from the mobile device and stores them in a specified variable
# Example: Capture logs from mobile device and store in the "mobile_logs"
@step('Capture logs from mobile device and store in the "{variable}"')
@done('Capture logs from mobile device and store in the "{variable}"')
def capture_logs_from_mobile_device(context, variable):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Capturing logs from mobile device")
    logger.debug("Capturing logs from mobile device")
    try:
        logs = context.mobile["driver"].get_log("logcat")
        send_step_details(context, f"Captured logs from mobile device")
        addTestRuntimeVariable(context, variable, logs)
        return logs
    except Exception as e:
        raise CustomError(f"Could not capture logs from mobile device: {str(e)}")

# Get the current device orientation and store it in a specified variable
# Example: Get current device orientation and store in the "orientation_variable"
@step('On mobile get device orientation and store in the "{variable}"')
@done('On mobile get device orientation and store in the "{variable}"')
def get_current_device_orientation(context, variable):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Getting current device orientation")
    logger.debug("Getting current device orientation")
    try:
        orientation = context.mobile["driver"].orientation
        addTestRuntimeVariable(context, variable, orientation, save_to_step_report=True)
        send_step_details(context, f"Current device orientation is {orientation}")
        return orientation
    except Exception as e:
        raise CustomError(f"Could not get current device orientation: {str(e)}")
  
# Change the device orientation to the specified orientation (e.g., PORTRAIT or LANDSCAPE)
# Example: Change device orientation to "LANDSCAPE"
@step('On mobile change device orientation to "{orientation}"')
@done('On mobile change device orientation to "{orientation}"')
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

  
# Lock the mobile device screen
# Example: Lock the screen
@step('On mobile lock the screen')
@done('On mobile lock the screen')
def lock_screen(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Locking the screen")
    logger.debug("Locking the screen")
    try:
        context.mobile["driver"].lock()
        send_step_details(context, "Screen locked successfully")
    except Exception as e:
        raise CustomError(f"Could not lock the screen: {str(e)}")


# Unlock the mobile device screen
# Example: Unlock the screen
@step('On mobile unlock the screen')
@done('On mobile unlock the screen')
def unlock_screen(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Unlocking the screen")
    logger.debug("Unlocking the screen")
    try:
        context.mobile["driver"].unlock()
        send_step_details(context, "Screen unlocked successfully")
    except Exception as e:
        raise CustomError(f"Could not unlock the screen: {str(e)}")


# @step('Check network status of mobile device store in the "(?P<variable>.+?)"')
# @done('Check network status of mobile device store in the "{variable}"')
# def check_network_status(context, variable):
#     context.STEP_TYPE = "MOBILE"
#     send_step_details(context, "Checking network status of mobile device")
#     logger.debug("Checking network status of mobile device")
#     try:
#         network_status = context.mobile["driver"].get_network_connection()
#         addTestRuntimeVariable(context, variable, network_status)
#         send_step_details(context, f"Network status of mobile device: {network_status}")
#         return network_status
#     except Exception as e:
#         raise CustomError(f"Could not check network status of mobile device: {str(e)}")


# Switch the context to a specified mobile app context
# Example: Switch to mobile app context "WEBVIEW_com.example.apk"
@step('On mobile switch to app context "{context}"')
@done('On mobile switch to app context "{context}"')
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


# Simulate pressing the back button on the mobile device
# Example: Go back
@step('On mobile go back')
@done('On mobile go back')
def go_back(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Going back")
    logger.debug("Going back")
    try:
        context.mobile["driver"].back()  
    except Exception as e:
        raise CustomError(
            f"Could not Go back : {str(e)}"
        )

 
# Go to the home screen of the mobile device
# Example: Go to Home
@step('On mobile go to home')
@done('On mobile go to home')
def go_to_home(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Going back")
    logger.debug("Going back")
    try:
        context.mobile["driver"].press_keycode(3)  # 3 is the keycode for the HOME button
    except Exception as e:
        raise CustomError(
            f"Could not Go home page : {str(e)}"
        )

# Open the recent apps screen on the mobile device
# Example: Open recent apps
@step('On mobile open recent apps')
@done('On mobile open recent apps')
def go_to_home(context):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, "Going back")
    logger.debug("Going back")
    try:
        context.mobile["driver"].press_keycode(187)  # 3 is the keycode for the HOME button
    except Exception as e:
        raise CustomError(
            f"Could not Go home page : {str(e)}"
        )

 
# Perform a drag and drop action from a specified start element to an end element
# Example: Perform drag and drop from "source_element_id" to "target_element_id"
@step('On mobile perform drag and drop from "{start_element}" to "{end_element}"')
@done('On mobile perform drag and drop from "{start_element}" to "{end_element}"')
def perform_drag_and_drop(context, start_element, end_element):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context, f"Performing drag and drop from '{start_element}' to '{end_element}'"
    )
    logger.debug(f"Performing drag and drop from '{start_element}' to '{end_element}'")
    try:
        start = waitSelector(
            context=context, selector_type= "id", selector=start_element
        )
        end = waitSelector(
            context=context, selector_type="id", selector=end_element
        )
        actions = TouchAction(context.mobile["driver"])
        actions.long_press(start).move_to(end).release().perform()
        send_step_details(
            context,
            f"Drag and drop from '{start_element}' to '{end_element}' completed successfully",
        )
    except Exception as e:
        raise CustomError(f"Could not perform drag and drop: {str(e)}")


# @step('Perform multi-touch on element with "(?P<selector>.+?)"')
# @done('Perform multi-touch on element with "{selector}"')
# def perform_multi_touch_on_element(context, selector):
#     context.STEP_TYPE = "MOBILE"
#     send_step_details(
#         context, f"Performing multi-touch on element with id '{selector}'"
#     )
#     logger.debug(f"Performing multi-touch on element with id '{selector}'")
#     try:
#         element = waitSelector(
#             context=context, selector_type="id", selector=selector
#         )
#         action1 = TouchAction(context.mobile["driver"]).tap(element)
#         action2 = TouchAction(context.mobile["driver"]).tap(element)
#         multi_action = MultiAction(context.mobile["driver"])
#         multi_action.add(action1, action2)
#         multi_action.perform()
#         send_step_details(
#             context,
#             f"Multi-touch on element with id '{element_id}' performed successfully",
#         )
#     except Exception as e:
#         raise CustomError(
#             f"Could not perform multi-touch on element with id '{element_id}': {str(e)}"
#         )
 
# Wait for a specified element to appear on the mobile screen
# Example: On mobile wait for "//android.widget.TextView[@text='Welcome']" to appear
@step('On mobile wait for "{selector}" to appear')
@done('On mobile wait for "{selector}" to appear')
def wait_for_element_to_appear(context, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context, f"Waiting for element with {selector} to appear"
    )
    logger.debug(
        f"Waiting for element with {selector} to appear"
    )
    try:
        waitSelector(
            context=context, selector_type="xpath", selector=selector
        )
        send_step_details(
            context, f"Element with {selector} appeared"
        )
    except Exception as e:
        raise CustomError(
            f"Element with {selector} did not appear: {str(e)}"
        )

 
# Wait for a specified element to disappear from the mobile screen
# Example: On mobile wait for "//android.widget.ProgressBar" to disappear
@step('On mobile wait for "{selector}" to disappear')
@done('On mobile wait for "{selector}" to disappear')
def wait_for_element_to_disappear(context, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Waiting for element with {selector} to disappear",
    )
    logger.debug(
        f"Waiting for element with {selector} to disappear"
    )
    try:
        WebDriverWait(context.mobile["driver"], EXPLICIT_WAIT_TIME).until_not(
            EC.presence_of_element_located((selector))
        )
        send_step_details(
            context, f"Element with {selector} disappeared"
        )
    except Exception as e:
        raise CustomError(
            f"Element with {selector} did not disappear: {str(e)}"
        )

@step('On mobile assert if "{text}" appeared on screen')
@done('On mobile assert if "{text}" appeared on screen')
def validate_text_on_mobile_screen(context, text):
    context.STEP_TYPE = "MOBILE"
    send_step_details(context, f"Validating text '{text}' on mobile screen")
    logger.debug(f"Validating text '{text}' on mobile screen")
    try:
        element = waitSelector(
            context=context,
            selector_type="xpath",
            selector=f"//*[contains(text(),'{text}')]",
        )
        if text not in element.text:
            raise CustomError(f"Text '{text}' not found on mobile screen")
        send_step_details(context, f"Text '{text}' validated on mobile screen")
    except Exception as e:
        raise CustomError(
            f"Could not validate text '{text}' on mobile screen: {str(e)}"
        )


# @step('Capture device performance metrics and store in the "(?P<variable>.+?)"')
# @done('Capture device performance metrics and store in the "{variable}"')
# def capture_device_performance_metrics(context, variable):
#     context.STEP_TYPE = "MOBILE"
#     send_step_details(context, "Capturing device performance metrics")
#     logger.debug("Capturing device performance metrics")
#     try:
#         performance_metrics = context.mobile["driver"].get_performance_data(
#             "system", "cpuinfo", 5
#         )
#         send_step_details(
#             context, f"Device performance metrics captured: {performance_metrics}"
#         )
#         addTestRuntimeVariable(context, variable, performance_metrics)
#         return performance_metrics
    
#     except Exception as e:
#         raise CustomError(f"Could not capture device performance metrics: {str(e)}")

# Set the device geolocation to specific latitude and longitude coordinates
# Example: Set geolocation to "37.7749, -122.4194"
# @step('On mobile set geolocation to "(?P<latitude>.+?), (?P<longitude>.+?)"')
@step('On mobile set geolocation to "{latitude}, {longitude}"')
@done('On mobile set geolocation to "{latitude}, {longitude}"')
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

# Set the mobile device timezone to a specific value
# Example: Set mobile timezone to "Europe/Berlin"
# @step('On mobile set timezone to "(?P<timezone>.+?)"')
@step('On mobile set timezone to "{timezone}"')
@done('On mobile set timezone to "{timezone}"')
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

# Check if a specific element is visible on the screen
# Example: On mobile assert "//android.widget.Button[@text='Submit']" is visible
@step('On mobile assert "{selector}" is visible')
@done('On mobile assert "{selector}" is visible')
def assert_if_element_visible(context, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector} is visible",
    )
    logger.debug(
        f"Checking if element with {selector} is visible"
    )
    element = waitSelector(
        context=context, selector_type="xpath", selector=selector
    )
    assert element.is_displayed(), f"Element with {selector} is not visible"
    send_step_details(
        context, f"Element with {selector} is visible"
    )




# Check if a specific element is present on the screen
# Example: On mobile assert "//android.widget.Button[@text='Submit']" is visible
@step('On mobile assert "{selector}" is present')
@done('On mobile assert "{selector}" is present')
def assert_if_element_present(context, selector):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector} is visible",
    )
    logger.debug(
        f"Checking if element with {selector} is visible"
    )
    element = waitSelector(
        context=context, selector_type="xpath", selector=selector
    )
    assert element is not None, f"Element with {selector} is not visible"
    send_step_details(
        context, f"Element with {selector} is visible"
    )

    


use_step_matcher("parse")

# Check if a specific element is present on the screen and save the result to a variable
# Example: Check if element "//android.widget.Button[@text='Submit']" is visible
@step('On mobile validate if "{selector}" is present and save result in "{variable}"')
@done('On mobile validate if "{selector}" is present and save result in "{variable}"')
def check_if_element_present(context, selector, variable):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector} is visible",
    )
    try:
        element = waitSelector(
            context=context, selector_type="xpath", selector=selector
        )
        result = element is not None  # If element, it's present
        send_step_details(context, f"Selector '{selector}' is present: {result}")
    except Exception as e:
        result = False  # If an exception occurs, the element is not present
        logger.debug(f"Exception while checking presence of '{selector}': {e}")
    
    # Save the result to the variable
    addTestRuntimeVariable(context, variable, str(result), save_to_step_report=True)
    send_step_details(context, f"Presence validation result for '{selector}' saved to variable '{variable}': {result}")
    


# Check if a specific element is visible on the screen and save the result to a variable
# Example: On mobile assert if "//android.widget.Button[@text='Submit']" is visible and save result in "is_visible"
# @step('On mobile validate if "(?P<selector>.+?)" is visible and save result in "{variable}"')
@step('On mobile validate if "{selector}" is visible and save result in "{variable}"')
@done('On mobile validate if "{selector}" is visible and save result in "{variable}"')
def check_if_element_visible(context, selector, variable):
    context.STEP_TYPE = "MOBILE"
    send_step_details(
        context,
        f"Checking if element with {selector} is visible",
    )
    try:
        element = waitSelector(
            context=context, selector_type="xpath", selector=selector
        )
            # waitSelector method might also return the list of webelement
        if not isinstance(element, WebElement):
            element = element[0]
        result = element.is_displayed()  # If element is returned, it's present
        send_step_details(context, f"Selector '{selector}' is present: {result}")
    except Exception as e:
        result = False  # If an exception occurs, the element is not present
        logger.debug(f"Exception while checking presence of '{selector}': {e}")
    
    # Save the result to the variable
    addTestRuntimeVariable(context, variable, str(result), save_to_step_report=True)
    send_step_details(context, f"Visibility validation result for '{selector}' saved to variable '{variable}': {result}")
    
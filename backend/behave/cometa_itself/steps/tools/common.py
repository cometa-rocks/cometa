import time
import signal
import logging
import requests
import json
import os
import sys
import re

from .exceptions import *
from .variables import *
from functools import wraps
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.common.by import By
from selenium.common.exceptions import (
    InvalidSelectorException,
    NoSuchElementException,
    WebDriverException,
    TimeoutException,
    ElementClickInterceptedException
)
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import time, requests, json, os, datetime, sys, subprocess, re, shutil, random, string

sys.path.append("/opt/code/behave_django")

from utility.config_handler import *
from utility.common import *
from utility.cometa_logger import CometaLogger
from utility.configurations import ConfigurationManager

# setup logging
logging.setLoggerClass(CometaLogger)
logger = logging.getLogger("FeatureExecution")

"""
Python library with common utility functions
"""

# Lazy imports for Healenium to avoid circular dependencies
_healenium_imports = {}

def _lazy_import_healenium():
    """Lazy import Healenium modules to avoid startup overhead"""
    global _healenium_imports
    if not _healenium_imports:
        try:
            parent_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
            if parent_dir not in sys.path:
                sys.path.insert(0, parent_dir)
            
            from ee.cometa_itself.healenium_client import (
                HealeniumClient, 
                healenium_context
            )
            _healenium_imports = {
                'HealeniumClient': HealeniumClient,
                'healenium_context': healenium_context
            }
        except ImportError:
            _healenium_imports = None
    return _healenium_imports


def _handle_healing_check(context, selector_type, selector, find_start_time):
    """Store healing data in context for later saving after step_result creation"""
    if not getattr(context, 'healenium_enabled', False) or not hasattr(context, 'healenium_client'):
        return
    
    healenium = _lazy_import_healenium()
    if not healenium:
        return
        
    try:
        # Get healing data from Healenium
        selector_type_str = selector_type.name.lower() if hasattr(selector_type, 'name') else str(selector_type).lower()
        healing_info = context.healenium_client.get_healing_data_from_db(selector_type_str, selector, find_start_time - 5)
        
        if healing_info:
            # Just store in context for later saving
            context.healing_data = healing_info
            logger.info(f"Healing detected: {selector} -> {healing_info['healed_selector']['value']} (score: {healing_info['score']})")
    except Exception as e:
        logger.debug(f"Failed to check for healing: {str(e)}")


class CometaTimeoutException(Exception):
    pass


class CometaMaxTimeoutReachedException(Exception):
    pass


# timeout error
# throws an CustomError exception letting user know about the issue
def timeoutError(signum, frame, context, timeout=MAX_STEP_TIMEOUT, error=None):
    
    if context.step_exception and isinstance(context.step_exception, CometaElementNotFoundError):
        raise context.step_exception
    
    if error is None:
        error = f"Step took more than configured time: {timeout}s."
    raise CometaTimeoutException(error)


# DEPRECATED:
def timeout(*_args, **_kwargs):
    def decorator(func):
        @wraps(func)
        def execute(*args, **kwargs):
            # get current step timeout or default from MAXRETRIES
            timeout = int(getattr(args[0], "step_data", {}).get("timeout", MAXRETRIES))
            # replace <seconds> in text
            try:
                text = _args[0].replace("<seconds>", str(timeout))
            except:
                text = (
                    "Step took more than %ds. Please try a different configuration for the step or contact a system administrator to help you with the issue."
                    % timeout
                )
            # start the timeout
            signal.signal(
                signal.SIGALRM,
                lambda signum, frame, waitedFor=timeout, error=text: timeoutError(
                    signum, frame, waitedFor, error
                ),
            )
            # added +1 as a quick fix when user executes a sleep for 1 second step and set 1s to step timeout,
            # step is failed since the function takes additional microseconds.
            signal.alarm(timeout + 1)
            # run the requested function
            result = func(*args, **kwargs)
            # if step executed without running into timeout cancel the timeout
            signal.alarm(0)
            # return the result
            return result

        return execute

    return decorator

# Helper function to detect selector type
def detect_selector_type(selector):
    # Remove leading/trailing whitespace
    selector = selector.strip()
    selector_type = None
 
        # FIXME this regular expression needs to be implemented
        # # Regular expressions for common selector patterns
        # patterns = {
        #     "id": r"^#[a-zA-Z0-9\-_:]+$",  # e.g., #login, #hello:world
        #     "class": r"^\.[a-zA-Z0-9\-_]+$",  # e.g., .login-button
        #     "css": r"^((\w+)?(\[.*\])|(\w+\.\w+)|(\w+ > \w+)|(\w+:.*)|(\w+\[.*\]))",  # Complex CSS: div.login, input[type='text'], div > p
        #     "xpath": r"^//.*$",  # e.g., //div[@class='login']
        #     "name": r"^name=[a-zA-Z0-9\-_]+$",  # e.g., name=username
        #     "tag_name": r"^[a-zA-Z0-9]+$",  # e.g., div, button
        #     "link_text": r"^[A-Za-z\s]+$",  # e.g., "Sign In" (text with letters and spaces)
        #     "accessibility_id": r"^[a-zA-Z0-9\-_]+$",  # Mobile: alphanumeric with hyphens/underscores
        #     "partial_text": r".*".encode('unicode_escape').decode('utf-8'),  # Mobile: any text for partial match
        # }

        # if not selector_type:
        #     # Check each pattern to determine the selector type
        #     for selector_type, pattern in patterns.items():
        #         if re.match(pattern, selector):
        #             # Special handling for class: remove leading dot
        #             if selector_type == "class":
        #                 return selector_type, selector.lstrip(".")
        #             # Special handling for id: remove leading hash
        #             elif selector_type == "id":
        #                 return selector_type, selector.lstrip("#")
        #             # For CSS, check if it looks like a single class (e.g., .login-button)
        #             elif selector_type == "css" and selector.startswith("."):
        #                 # If it looks like a single class, prefer class selector
        #                 if re.match(r"^\.[a-zA-Z0-9\-_]+$", selector):
        #                     return "class", selector.lstrip(".")
        
        # if selector_type: 
            # selector_type = 
        
    
    selectorWords = selector.split(" ")
    
    first_selector_word = selectorWords[0]
    logger.debug(f"Found first word of locator {first_selector_word}")
    
    if (selector_type == "css" and first_selector_word.startswith("#") and ":" in first_selector_word):
        # Remove hash
        first_selector_word = first_selector_word.replace("#", "")
        # Split using ':'
        first_selector_word = first_selector_word.split(":")
        # Map values to id safe attributes
        orig = ""
        for val in first_selector_word:
            orig += '[id*="' + str(val) + '"]'
        # Join values to string
        first_selector_word = orig
        selectorWords[0] = first_selector_word
        selector = selectorWords[0].join(" ")
        selector_type = By.CSS_SELECTOR
        
    elif first_selector_word.startswith("#"):
        selector_type = By.ID
        selector = selector[1:]
    elif first_selector_word.startswith("."):
        selector_type = By.CLASS_NAME
    elif first_selector_word.startswith("//") or first_selector_word.startswith("(//"):
        selector_type = By.XPATH
    
    if selector_type:
        return selector_type, selector
    
    # If using above logic locator type was not found check if user have provided the locator using format 
    # locator_type@@locator_value
    selector_type_and_selector = selector.split("@@", 1)
    
    # if the value is greater than 1, process the selector type
    if len(selector_type_and_selector) > 1:
        selector_type_str = selector_type_and_selector[0].lower()
        selector = selector_type_and_selector[1]
        
        # Map string selector types to By enums
        type_mapping = {
            'id': By.ID,
            'css': By.CSS_SELECTOR,
            'xpath': By.XPATH,
            'name': By.NAME,
            'class': By.CLASS_NAME,
            'tag_name': By.TAG_NAME,
            'link_text': By.LINK_TEXT,
            'partial_link_text': By.PARTIAL_LINK_TEXT
        }
        
        selector_type = type_mapping.get(selector_type_str)
        if selector_type:
            return selector_type, selector
    
    return None, None
    
    if selector_type == "name":
        selector_type = By.NAME
    elif selector_type == "css":
        selector_type = By.CSS_SELECTOR
    elif selector_type == "id":
        selector_type = By.ID
    elif selector_type == "class":
        selector_type = By.CLASS_NAME
    elif selector_type == "xpath":
        selector_type = By.XPATH
    elif selector_type == "link_text":
        selector_type = By.LINK_TEXT
    elif selector_type == "partial_text":
        selector_type = By.PARTIAL_LINK_TEXT
    elif selector_type == "accessibility_id":
        selector_type = By.ACCESSIBILITY_ID
    elif selector_type == "tag_name":
        selector_type = By.TAG_NAME
    
    # Default to CSS selector if no specific pattern matches
    return selector_type, selector



def waitSelector(context, selector_type, selector, max_timeout=None):
    element = waitSelectorNew(context, selector, max_timeout)
    if element:
        return element
    return waitSelectorOld(context, selector_type, selector, max_timeout)
    


"""
    A new implementation of element waiting strategy that uses Selenium's WebDriverWait for more reliable element detection.
    
    This method:
    1. Handles special cases for CSS selectors with IDs containing colons
    2. Supports multiple selector types (ID, CLASS_NAME, XPATH, etc.)
    3. Uses explicit waits for both presence and visibility of elements
    4. Provides better timeout handling and logging
    
    Args:
        context: Object containing the webdriver context (browser or mobile driver)
        selector_type: Type of selector to use (css, id, xpath, etc.)
        selector: The actual selector string to find the element
        max_timeout: Maximum time to wait for the element in seconds (default: 7200s/2hours)
    
    Returns:
        WebElement: The found element if successful
        
    Raises:
        CometaTimeoutException: If element is not found within the timeout period
        False: If selector type cannot be determined
"""
def waitSelectorNew(context, selector, max_timeout=None):
    logger.debug("Checking with new selector strategy")
    start_time = time.time()

    if not selector.strip():
        raise CustomError("Please provide valid selector")
    
    selector_type, selector = detect_selector_type(selector=selector)
    if selector_type is None:
        logger.debug("Could not determine selector type with new method, will try with old")
        return False
    
    device_driver = context.mobile["driver"] if context.STEP_TYPE == 'MOBILE' else context.browser
    max_timeout = max_timeout or context.step_data["timeout"]
    
    # Determine find method based on selector type
    use_find_element = selector_type in [By.ID, By.NAME]
    
    retry_count = 0
    healing_attempted = False
    healed_selector = None
    healed_selector_type = None
    
    while time.time() - start_time < max_timeout:
        if retry_count % 10 == 0:
            logger.debug(f"Trying to find element with selector_type '{selector_type}', selector '{selector}' max_timeout : {max_timeout}")
        
        try:
            # Use healed selector if available
            current_selector = healed_selector or selector
            current_selector_type = healed_selector_type or selector_type
            
            # Update method if using healed selector
            if healed_selector and healed_selector_type:
                use_find_element = healed_selector_type in [By.ID, By.NAME]
            
            # Find element(s)
            find_start_time = time.time()
            method = device_driver.find_element if use_find_element else device_driver.find_elements
            elements = method(current_selector_type, current_selector)
            
            # Check if element(s) found
            if isinstance(elements, WebElement) or (isinstance(elements, list) and elements):
                # Check for healing
                _handle_healing_check(context, selector_type, selector, find_start_time)
                
                # Return elements in consistent format
                return [elements] if isinstance(elements, WebElement) else elements
            else:
                raise CometaElementNotFoundError(f"Element not found for selector: {current_selector}")
            
        except Exception as err:
            context.step_exception = err
            
            # Log healing status on repeated failures
            if (not healing_attempted and 
                getattr(context, 'healenium_enabled', False) and 
                hasattr(context, 'healenium_client') and
                context.healenium_client.is_proxy_ready() and
                retry_count > 10):  # After 10 failed attempts (1 second)
                
                logger.info(f"Element '{selector}' not found after {retry_count} attempts - Healenium proxy is active and should heal if possible")
                healing_attempted = True
        
        retry_count += 1
        time.sleep(0.1)
    
    # Raise the exception
    raise context.step_exception


# ---
# Wrapper function to wait until an element, selector, id, etc is present
# ... if first try for defined selector is not found
# ... then it starts looping over the 6 different selectors type (e.g. css, id, xpath, ... )
# ... until found or max tries is reached, between each loop wait for 1 second
# ---
# @author Alex Barba
# @param context - Object containing the webdriver context
# @param selector_type: string - Type of selector to use, see below code for possible types
# @param selector: string - Selector to use
# @timeout("Waited for <seconds> seconds but unable to find specified element.")
def waitSelectorOld(context, selector_type, selector, max_timeout=None):
    logger.debug("Checking with old selector strategy")
    # set the start time for the step
    start_time = time.time()
    # 2288 - Split : id values into a valid css selector
    # example: "#hello:world" --> [id*=hello][id*=world]
    selectorWords = selector.split(" ")
    if (
        selector_type == "css"
        and selectorWords[0].startswith("#")
        and ":" in selectorWords[0]
    ):
        # Remove hash
        selectorWords[0] = selectorWords[0].replace("#", "")
        # Split using ':'
        selectorWords[0] = selectorWords[0].split(":")
        # Map values to id safe attributes
        orig = ""
        for val in selectorWords[0]:
            orig += '[id*="' + str(val) + '"]'
        # Join values to string
        selectorWords[0] = orig
        selector = selectorWords.join(" ")
    counter = 0
    # Switch selector type
    device = 'mobile["driver"]' if context.STEP_TYPE == 'MOBILE' else 'browser'
        
    types = {
        "css": f"context.{device}.find_elements(By.CSS_SELECTOR, selector)",
        "id": f"context.{device}.find_element(By.ID, selector)",
        "link_text": f"context.{device}.find_elements(By.LINK_TEXT, selector)",
        "xpath": f"context.{device}.find_elements(By.XPATH, selector)",
        "name": f"context.{device}.find_element(By.NAME, selector)",
        "tag_name": f"context.{device}.find_elements(By.TAG_NAME, selector)",
        "class": f"context.{device}.find_elements(By.CLASS_NAME, selector)",
    }
    
    if context.STEP_TYPE == 'MOBILE':     
        # FIXME Not By.ACCESSIBILITY_ID have some issue, need to investigate and fix 
        types["accessibility_id"] = f"context.mobile['driver'].find_element(By.ACCESSIBILITY_ID, selector)"
        value = f'//*[contains(@text,"{selector}")]'
        types["partial_text"] = f"context.mobile['driver'].find_element(By.XPATH, '{value}')"
        logger.debug(f"partial_text Selector Value : {value}")
        
    # place selector_type on the top
    selector_type_value = types.pop(selector_type, "css")
    # new types variables
    types_new = {}
    # add the selector_type value first and then the rest of the values
    types_new[selector_type] = selector_type_value
    types_new.update(types)
    logger.debug("Starting loop")
    # Loop until maxtries is reached and then exit with exception
    while time.time() - start_time < max_timeout if max_timeout is not None else True:
        for selec_type in list(types_new.keys()):
            try:
                elements = eval(types_new.get(selec_type, "css"))
                # Check if it returned at least 1 element
                if isinstance(elements, WebElement) or len(elements) > 0:
                    # Check for healing after successful element find
                    _handle_healing_check(context, selec_type, selector, start_time)
                    return elements
            except CustomError as err:
                logger.error(
                    "Custom Error Exception occured during the selector find, will exit the search."
                )
                logger.exception(err)
                raise
            except CometaTimeoutException as err:
                logger.error(
                    "Timeout Exception occured during the selector find, will exit the search."
                )
                logger.exception(err)
                # Max retries exceeded, raise error
                raise
            except InvalidSelectorException as err:
                logger.debug(
                    f"Invalid Selector Exception: Selector Type: {selec_type}, Selector: {selector}."
                )
            except NoSuchElementException as err:
                logger.debug(
                    f"No Such Element Exception: Selector Type: {selec_type}, Selector: {selector}."
                )
            except WebDriverException as err:
                logger.debug(
                    f"WebDriverException for Selector Type: {selec_type}, Selector: {selector}."
                )
            except KeyError:
                raise
            except Exception as err:
                # logger.error("Exception occured during the selector find, will continue looking for the element.")
                # logger.exception(err)
                logger.error(
                    "Exception raised during the element search. No need to panic, will look with other type of selectors. More details in debug mode."
                )
                logger.debug(f"Selector: {selector}")
                logger.debug(f"Selector Type: {selec_type}")
                logger.exception(err)
        # give page some time to render the search
        time.sleep(0.1)
    logger.debug("Loop Over")
    raise CometaMaxTimeoutReachedException(
        f"Programmed to find the element in {max_timeout} seconds, max timeout reached."
    )


def element_has_class(element, classname):
    """
    Returns true if the given element has the given classname
    """
    return str(classname) in element.get_attribute("class").split()


def escapeSingleQuotes(text):
    """
    Safely escapes single quotes
    """
    return str(text).replace("'", "\\'")


def escapeDoubleQuotes(text):
    """
    Safely escapes double quotes
    """
    return str(text).replace('"', '\\"')


def load_parameters(parameters):
    """
    Converts a keyvalue based string(foo:bar;foo2:bar2) into dict based parameters
    """
    params = {}
    # Split the string by ";"
    param_list = parameters.split(";")
    # Iterate over each item in list
    for parameter in param_list:
        # Check if parameter is empty
        if not parameter:
            continue
        # Split each parameter by ":"
        keys, value = parameter.split(":")
        # Trim whitespaces from key and value if any
        keys = keys.strip().split("|")
        value = value.strip()
        for key in keys:
            # Set key value pair
            params[key] = value
    return params


def send_step_details(context, text):
    logger.debug('Sending websocket with detailed step ... [%s] ' % text)
    requests.post(f'{get_cometa_socket_url()}/feature/%s/stepDetail' % context.feature_id, data={
        "user_id": context.PROXY_USER['user_id'],
        'browser_info': json.dumps(context.browser_info),
        "run_id": os.environ['feature_run'],
        'step_index': context.counters['index'],
        'datetime': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'belongs_to': context.step_data['belongs_to'],
        'info': text
    })

def send_step_screen_shot_details(feature_id, feature_result_id, user_id, browser_info, counters_index, step_data_belongs_to, websocket_screen_shot_details):
    logger.debug('Sending websocket with screenshot details ... [%s] ' % websocket_screen_shot_details)
    
    data_to_send = {
        "user_id": user_id,
        'browser_info': json.dumps(browser_info),
        "run_id": os.environ['feature_run'],
        'step_index': counters_index,
        'datetime': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'belongs_to': step_data_belongs_to,
        'feature_result_id': feature_result_id,
        'screenshots': json.dumps(websocket_screen_shot_details) if websocket_screen_shot_details else "{}"  
    }
    logger.debug(f"Sending data {data_to_send}")
    
    response = requests.post(f'{get_cometa_socket_url()}/feature/%s/stepDetail' % feature_id, data=data_to_send)
    
    logger.debug(f"response : {response} {response.text}")


def get_element_using_common_selector_and_click(context, selector_value, selector_type="css", start_time=None):
    # start_time is used to calculate the remaining time for the step to complete
    # if start_time is not provided, it will be calculated using time.time() 
    # considering that step have not used any time before calling this method
    start_time = time.time() if start_time is None else start_time
    elements = waitSelector(context, selector_type, selector_value)
    element = elements[0]
    step_timeout = context.step_data.get('timeout', 30)

    # 1. Wait for the element to be displayed using EC.visibility_of
    elapsed = time.time() - start_time
    remaining_time = max(0.5, step_timeout - elapsed)
    logger.debug(f"Waiting for element to be displayed, remaining time {remaining_time}")
    try:
        wait_displayed = WebDriverWait(context.browser, remaining_time)
        wait_displayed.until(EC.visibility_of(element))
    except TimeoutException:
        raise CometaTimeoutException(f"Element with css selector '{selector_value}' was not displayed after {remaining_time:.1f} seconds")
    elapsed = time.time() - start_time
    remaining_time = max(0.5, step_timeout - elapsed)
    click_on_element_with_retry(context, element, selector_value, remaining_time, start_time, step_timeout)  


# This function is used to get an element using a selector type and value
# it waits for the element for the step timeout using given selector type 
# unlike waitSelector which uses all selector type
def get_element_using_selector_type_and_click(context, selector_type, selector_value, start_time=None):
    # start_time is used to calculate the remaining time for the step to complete
    # if start_time is not provided, it will be calculated using time.time() 
    # considering that step have not used any time before calling this method
    start_time = time.time() if start_time is None else start_time
    step_timeout = context.step_data.get('timeout', 60)

    # 1. Wait for the element to be displayed using EC.visibility_of
    logger.debug(f"Waiting for element to be displayed, remaining time {step_timeout}")
    try:
        wait_displayed = WebDriverWait(context.browser, step_timeout)
        element = wait_displayed.until(EC.visibility_of_element_located(by=selector_type, value=selector_value))
    except TimeoutException:
        raise CometaTimeoutException(f"Element '{selector_type}:{selector_value}' was not displayed after {remaining_time:.1f} seconds")
    
    # total elapsed time to complete above logic
    elapsed = time.time() - start_time
    # total time remaining to complete click action
    remaining_time = max(0.5, step_timeout - elapsed)
    click_on_element_with_retry(context, element, selector_value, remaining_time, start_time, step_timeout)  



# This function is used to click on an element with a selector type and value
# it handles the retry logic for the click operation and avoids ElementClickInterceptedException
# by retrying the click operation with a delay of 0.5 seconds
# this method should be used to perform click operation on an element
def click_on_element_with_retry(context, element, selector_value, remaining_time, start_time, step_timeout):
    error = None
    while remaining_time > 0:
        try:
            WebDriverWait(context.browser, max(0.5, remaining_time)).until(EC.element_to_be_clickable(element))
            logger.debug(f"Clicking element '{selector_value}', remaining time {remaining_time:.1f}s")
            element.click()
            return  # success
        except ElementClickInterceptedException as e:
            logger.debug(f"Click intercepted on '{selector_value}', retrying...")
            error = e
            time.sleep(0.5)
        except Exception as e:
            logger.debug(f"Unhandled exception when clicking '{selector_value}'")
            error = e
            break

        elapsed = time.time() - start_time
        remaining_time = step_timeout - elapsed

    # Raise the last encountered error if retries fail
    raise error if error else Exception(f"Failed to click element '{selector_value}' after {step_timeout}s")


def click_element(context, element):
    if element.is_displayed():
        element.click()


def tempFile(source):
    # file ext
    # generate a random string of 10 characters and add it to the filename to avoid parallel execution file name conflict
    random_string = ''.join(random.choices(string.ascii_lowercase + string.digits, k=10))
    filename = os.path.basename(source).split("/")[-1]
    target = f"/tmp/{random_string}_{filename}"

    # check if file exists
    if os.path.exists(target):
        # try removing the file
        logger.debug(f"{target} file exists, trying to remove it.")
        try:
            os.remove(target)
        except Exception as err:
            logger.error("Unable to remove the file.")
            logger.exception(err)

            # get the timestamp and add more random text
            ts = time.time()
            logger.debug(f"Setting a different filename: /tmp/{ts}_{filename}")
            target = f"/tmp/{ts}_{filename}"

    logger.info(f"TMP file will be created at {target} for {source}.")

    return target


def decryptFile(source):
    # get target file for the source
    target = tempFile(source)

    COMETA_UPLOAD_ENCRYPTION_PASSPHRASE = ConfigurationManager.get_configuration(
        "COMETA_UPLOAD_ENCRYPTION_PASSPHRASE", ""
    )

    logger.debug(f"Decrypting source {source}")

    try:
        result = subprocess.run(
            [
                "bash",
                "-c",
                f"gpg --output {target} --batch --passphrase {COMETA_UPLOAD_ENCRYPTION_PASSPHRASE} -d {source}",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if result.returncode > 0:
            # get the error
            errOutput = result.stderr.decode("utf-8")
            logger.error(errOutput)
            raise Exception(
                "Failed to decrypt the file, please contact an administrator."
            )
        return target
    except Exception as err:
        raise Exception(str(err))


def encryptFile(source, target):
    
    COMETA_UPLOAD_ENCRYPTION_PASSPHRASE = ConfigurationManager.get_configuration(
        "COMETA_UPLOAD_ENCRYPTION_PASSPHRASE", ""
    )

    logger.debug(f"Encrypting source {source} to {target}")
    try:
        result = subprocess.run(
            [
                "bash",
                "-c",
                f"gpg --output {target} --batch --yes --passphrase {COMETA_UPLOAD_ENCRYPTION_PASSPHRASE} --symmetric --cipher-algo AES256 {source}",
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if result.returncode > 0:
            # get the error
            errOutput = result.stderr.decode("utf-8")
            logger.error(errOutput)
            raise Exception(
                "Failed to encypt the file, please contact an administrator."
            )
        return target
    except Exception as err:
        raise Exception(str(err))


def uploadFileTarget(context, source):
    logger.debug(f"Source before processing: {source}")
    files = source.split(";")
    processedFiles = []
    for file in files:
        # throw error in case no downloads is found
        if "downloads" not in file.lower() and "uploads" not in file.lower():
            raise CustomError(
                "Unknown file path, please use uploads/ or downloads/ to define where the file is located at."
            )

        logger.debug(f"Getting complete path for {file}")
        filePath = re.sub(
            "(?:D|d)ownloads\/", f"{context.downloadDirectoryOutsideSelenium}/", file
        )
        filePath = re.sub(
            "(?:U|u)ploads\/", f"{context.uploadDirectoryOutsideSelenium}/", filePath
        )
        logger.debug(f"Final path for {file}: {filePath}")

        # check if file exists
        if not os.path.exists(filePath):
            raise CustomError(
                f"{file} does not exist, if this error persists please contact an administrator."
            )

        if "downloads" in filePath:
            # get temp file
            target = tempFile(filePath)

            # copy the file to the target
            shutil.copy2(filePath, target)
        elif "uploads" in filePath:
            # decrypt the file and get the target
            target = decryptFile(filePath)

        # append the target to the context for later processing and cleaning
        context.tempfiles.append(target)
        # append to processed files as well
        processedFiles.append(target)

    return processedFiles if len(processedFiles) > 1 else processedFiles.pop()


def updateSourceFile(context, source, target):
    logger.debug(f"Source before processing: {source}")
    target = re.sub(
        "(?:D|d)ownloads\/", f"{context.downloadDirectoryOutsideSelenium}/", target
    )
    target = re.sub(
        "(?:U|u)ploads\/", f"{context.uploadDirectoryOutsideSelenium}/", target
    )

    if "downloads" in target:
        # copy the file to the target
        shutil.copy2(source, target)
    elif "uploads" in target:
        # decrypt the file and get the target
        target = encryptFile(source, target)


def call_backend(method, path, parameters=None, headers=None, body=None):
    
    headers= {"Content-type": "application/json", "Host": "cometa.local"} if headers==None else headers.update({"Host": "cometa.local"}) 
    request_data = {
        'method': method,
        'url': f'http://django:8000{path}',
    }
    
    if body:
        request_data['json'] = body

    if parameters:
        request_data['params'] = parameters
        
    if headers:
        request_data['headers'] = headers
    # logger.debug( f"Calling django request with request_data {request_data} ")
    response = requests.Session().request(**request_data)
    if not (response.status_code>=200 and response.status_code<=299):
        raise CustomError(f"Can not update information in the backend, api request failed with STATUS_CODE : {response.status_code}")
    return response
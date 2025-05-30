import time
import logging
import traceback
import base64
from behave import *
import time
import sys
import os, glob
import os.path
import shutil
import subprocess
import shlex
import requests
import json
import re
import csv
import datetime
import signal
import logging
import traceback
import urllib.parse
import random
from concurrent.futures import ThreadPoolExecutor
import cv2
import numpy as np

# import PIL
from subprocess import call, run
from selenium.common.exceptions import WebDriverException, NoAlertPresentException, ElementNotInteractableException, TimeoutException, StaleElementReferenceException
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.select import Select
from selenium.webdriver.common.keys import Keys
from functools import wraps
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.actions.wheel_input import ScrollOrigin
from selenium.webdriver.remote.file_detector import LocalFileDetector
# Import utilities
sys.path.append(os.path.dirname(os.path.realpath(__file__)))
from tools.cognos import *
from tools.common import *
from tools.exceptions import *
from tools.variables import *
from slugify import slugify
from html_diff import diff
from bs4 import BeautifulSoup

# pycrypto imports
from Crypto import Random
from Crypto.Cipher import AES
import base64
base64.encodestring = base64.encodebytes
from hashlib import md5
from pathlib import Path
from tools import expected_conditions as CEC
import sys

from utility.functions import toWebP, toWebP_from_data
from utility.encryption import *
from tools.models import check_if_step_should_execute, get_step_status

# setup logging
logger = logging.getLogger("FeatureExecution")

from utility.configurations import ConfigurationManager

SCREENSHOT_PREFIX = ConfigurationManager.get_configuration(
    "COMETA_SCREENSHOT_PREFIX", ""
)

# initialize a thread‐pool for background HTTP posts
_executor = ThreadPoolExecutor(max_workers=4)

def _async_post(url, headers=None, json=None):
    def _task():
        try:
            logger.debug(f"Async POST to {url} with headers: {headers}")
            requests.post(url, headers=headers, json=json)
        except Exception as e:
            logger.error(f"Async POST to {url} failed: {e}")
    _executor.submit(_task)


def takeScreenshot(device_driver):
    try:
        device_driver.switch_to.alert
        logger.debug(
            "Alert found ... if we take a screenshot now the alert box will be ignored..."
        )
        return None
        
    except Exception as err:
        # create the screenshot
        logger.debug("Saving screenshot to file")
        try:
            # device_driver.save_screenshot(final_screenshot_file)
            return device_driver.get_screenshot_as_png()
        except Exception as err:
            logger.error(f"Unable to take screenshot ...{(str(err))}")
            return None
#
# some usefull functions
#
# def takeScreenshot(device_driver, screenshots_step_path):
    # pass
    
        

def convert_image_to_decoded_bytes(image_path):

    with open(image_path, "rb") as image_file:
        # Read the image file in binary format
        image_decoded_bytes = base64.b64encode(image_file.read()).decode("utf-8")
    return image_decoded_bytes


def get_screenshot_bytes_from_screen(context):
    logger.debug(f"context.PREVIOUS_STEP_TYPE : {context.PREVIOUS_STEP_TYPE}")
    try:
        if context.PREVIOUS_STEP_TYPE=='MOBILE':
            logger.debug("Taking screenshot from mobile")
            screenshot_bytes = context.mobile['driver'].get_screenshot_as_png()
        else:
            logger.debug("Taking screenshot from browser")
            screenshot_bytes = context.browser.get_screenshot_as_png()
        logger.debug("Converting to bytes")
        return base64.b64encode(screenshot_bytes).decode("utf-8")
    except Exception as exception:
        logger.error(exception)
        return None


def getVariable(context, variable_name):
    # get the variables from the context
    env_variables = json.loads(context.VARIABLES)
    # check if variable_name is in the env_variables
    index = [
        i for i, _ in enumerate(env_variables) if _["variable_name"] == variable_name
    ]

    if len(index) == 0:
        raise CustomError("No variable found with name: %s" % variable_name)

    # get variable value from the variables
    variable_value = env_variables[index[0]]["variable_value"]

    return variable_value


def is_valid_variable(value):
    """Check if value is a valid type (dict, list, number, string, bool, None)."""
    return isinstance(value, (dict, list, int, float, str, bool))

def addStepVariableToContext(context, variable, save_to_step_report=False):
    """Assign variable to context only if variable_value is of an allowed type."""
    if is_valid_variable(variable.get("variable_value", None)):
        value = variable.get("variable_value", None)
        if save_to_step_report:        
            new_variable = {
                    "variable_name": variable['variable_name'],
                    "variable_value": value,
                    "variable_type" : type(value).__name__
            }
            if context.LAST_STEP_VARIABLE_AND_VALUE is not None and isinstance(context.LAST_STEP_VARIABLE_AND_VALUE, list):
                context.LAST_STEP_VARIABLE_AND_VALUE.append(new_variable)
            elif context.LAST_STEP_VARIABLE_AND_VALUE is not None:
                context.LAST_STEP_VARIABLE_AND_VALUE = [
                    context.LAST_STEP_VARIABLE_AND_VALUE,
                    new_variable
                ]
            else:    
                context.LAST_STEP_VARIABLE_AND_VALUE = new_variable
            
    elif isinstance(variable, list) or isinstance(variable, dict):
        if save_to_step_report:
            context.LAST_STEP_VARIABLE_AND_VALUE = variable
    else:
        logger.warning(f"Warning: Skipping assignment. Value '{variable['variable_value']}' is not JSON-serializable.")
    

# variables added using this method will not be saved in the database
def addTestRuntimeVariable(context, variable_name, variable_value, save_to_step_report=False):
    # get the variables from the context
    env_variables = json.loads(context.VARIABLES)
    # check if variable_name is in the env_variables
    index = [
        i for i, _ in enumerate(env_variables) if _["variable_name"] == variable_name
    ]

    if len(index) > 0:  # update the variable
        index = index[0]
        logger.debug("Patching existing variable")
        env_variables[index]["variable_value"] = variable_value
        addStepVariableToContext(context, env_variables[index], save_to_step_report)

    else:
        logger.debug("Adding new variable")
        new_variable = {
            "variable_name": variable_name,
            "variable_value": variable_value,
            "encrypted": False,
        }
        env_variables.append(new_variable)
        addStepVariableToContext(context, new_variable, save_to_step_report)

    context.VARIABLES = json.dumps(env_variables)


def addVariable(context, variable_name, result, encrypted=False, save_to_step_report=False):
    # get the variables from the context
    env_variables = json.loads(context.VARIABLES)
    # check if variable_name is in the env_variables
    index = [
        i for i, _ in enumerate(env_variables) if _["variable_name"] == variable_name
    ]

    if len(index) > 0:  # update the variable
        index = index[0]
        logger.debug("Patching existing variable")
        env_variables[index]["variable_value"] = result
        env_variables[index]["encrypted"] = encrypted
        env_variables[index]["updated_by"] = context.PROXY_USER["user_id"]
        addStepVariableToContext(context,env_variables[index], save_to_step_report)
        # do not update if scope is data-driven
        if (
            "scope" in env_variables[index]
            and env_variables[index]["scope"] == "data-driven"
        ):
            logger.info(
                "Will not send request to update the variable in co.meta since we are in 'data-driven' scope."
            )
        else:
            # make the request to cometa_django and add the environment variable
            response = requests.patch(               
                f"{get_cometa_backend_url()}/api/variables/"
                + str(env_variables[index]["id"]) 
                + "/",
                headers={"Host": "cometa.local"},
                json=env_variables[index],
            )
            if response.status_code == 200:
                env_variables[index] = response.json()["data"]
    else:  # create new variable
        logger.debug("Creating variable")
        # create data to send to django
        update_data = {
            "environment": int(context.feature_info["environment_id"]),
            "department": int(context.feature_info["department_id"]),
            "feature": int(context.feature_id),
            "variable_name": variable_name,
            "variable_value": result,
            "based": "environment",
            "encrypted": encrypted,
            "created_by": context.PROXY_USER["user_id"],
            "updated_by": context.PROXY_USER["user_id"],
        }
        addStepVariableToContext(context, {
                "variable_name": variable_name,
                "variable_value": result,
                "encrypted": encrypted,
            },
            save_to_step_report
        )
        # make the request to cometa_django and add the environment variable
        response = requests.post(
            f"{get_cometa_backend_url()}/api/variables/",
            headers={"Host": "cometa.local"},
            json=update_data,
        )

        if response.status_code == 201:
            env_variables.append(response.json()["data"])

    # send a request to websockets about the environment variables update
    requests.post(
        f"{get_cometa_socket_url()}/sendAction",
        json={
            "type": "[Variables] Get All",
            "departmentId": int(context.feature_info["department_id"]),
        },
    )
    # update variables inside context
    context.VARIABLES = json.dumps(env_variables)


# check if encrypted
def returnDecrypted(value):
    # encrypted string start

    if value.startswith(ENCRYPTION_START):
        value = decrypt(value)
        # append value to be masked in logger
        if value.strip():
            logger.updateMaskWords(value)

    return value


def dynamicDateGenerator(content: str):
    # date pattern to look for
    pattern = r"#today;?(?P<format>[^;\n]+)?;?(?P<expression>(?:days|weeks|hours|minutes|seconds)=)?(?P<operation>-|\+)?(?P<amount>[0-9]+)?\b"  # looks for ;format & ;daysDelta which are optional
    # match pattern to the paramerters value
    match = re.search(pattern, str(content))
    # if match was found
    if match:
        # get all the matches
        groups = match.groupdict()
        # will always be today
        dateObject = datetime.datetime.today()
        # set daysDelta to add or substract from the dateObject to default value if none is provided
        groups["amount"] = 0 if groups["amount"] is None else groups["amount"]
        # set the arithmetic operations like + (default in case not specified) or -
        groups["operation"] = (
            "+" if groups["operation"] is None else groups["operation"]
        )
        # set default expression to days= if none is provided
        groups["expression"] = (
            "days=" if groups["expression"] is None else groups["expression"]
        )
        # evaluate final date
        dateObject = eval(
            "dateObject %s datetime.timedelta(%s%s)"
            % (groups["operation"], groups["expression"], str(groups["amount"]))
        )
        # get the format from the match
        groups["format"] = "%Y-%m-%d" if groups["format"] is None else groups["format"]
        # finally format the object if format is not set, use "%Y-%m-%d" as default
        finalDate = dateObject.strftime(groups["format"])
        # replace the parameter
        content = re.sub(pattern, finalDate, content)
    return content




def reset_element_highlight(context):
    try:
        if "highlighted_element" in context:
            element = context.highlighted_element["element"]
            send_step_details(context, "Resetting Highlighted element")
            context.browser.execute_script(
                """
            const element = arguments[0];
            element.style.outline = window.cometa.oldOutlineValue;
            element.style.outlineOffset = window.cometa.oldOutlineOffsetValue;
            """,
                element,
            )
            del context.highlighted_element
    except Exception as err:
        logger.exception(err)

    try:
        if "highlighted_text" in context:
            send_step_details(context, "Resetting Highlighted text")
            context.browser.execute_script(
                """
            if (window.getSelection) {
                if (window.getSelection().empty) {  // Chrome
                    window.getSelection().empty();
                } else if (window.getSelection().removeAllRanges) {  // Firefox
                    window.getSelection().removeAllRanges();
                }
            } else if (document.selection) {  // IE?
                document.selection.empty();
            }
            """
            )
            # context.browser.execute_script('''
            # const element = document.body;
            # const pattern = new RegExp(`<mark data-by=(?:\'|\")co.meta(?:\'|\")>(.*?)</mark>`, 'gi');
            # element.innerHTML = element.innerHTML.replaceAll(pattern, "$1");
            # ''')
            del context.highlighted_text
    except Exception as err:
        logger.exception(err)



# ########################################################################## #
# decorator to ease up making of steps ##################################### #
# this decorator will reduce the code ###################################### #
# of steps and also help save to database ################################## #
# without us having to manually set it in ################################## #
# the step implementation ################################################## #
# ########################################################################## #
# Simple explanation about the function #################################### #
# *_args & **_kwargs are the values passed in @done(...) ################### #
# the decorator method holds the function that will be executed ############ #
# @wraps(func) helps us to execute the function we want in case ############ #
# there are more than one decorator applied to the function ################ #
# and *args & **kwargs are the arguments passed in the step_imp(...) method! #
# ########################################################################## #
def done(*_args, **_kwargs):
    def decorator(func):
        @wraps(func)
        def execute(*args, **kwargs):

            # args[0] = context

            # get EnvironmentVariables
            env_variables = json.loads(args[0].VARIABLES)
            # job parametes
            job_parameters = json.loads(args[0].PARAMETERS)

            # message that will be saved in database once the code has been executed!
            save_message = _args[0].format(**kwargs)
            # start timer to get how log it takes to run the step
            start_time = time.time()

            # run the step inside try/except syntax to avoid crashes
            try:
                # reset the step_error field in context
                if hasattr(args[0], "step_error"):
                    del args[0].step_error
                logger.debug(f"Values of kwargs : {kwargs}")
                # replace variables in kwargs
                # Got here the parameter list
                
                for parameter in kwargs:
                    parameter_value = kwargs[parameter]
                    if not parameter_value:
                        continue

                    # Match $VAR, ${VAR}, and %index only
                    found_vars = re.findall(r'(\$[a-zA-Z_][a-zA-Z0-9_]*|\$\{[a-zA-Z_][a-zA-Z0-9_]*\}|%index)', parameter_value)
                    if args[0].text:
                        found_vars_in_text = re.findall(r'(\$[a-zA-Z_][a-zA-Z0-9_]*|\$\{[a-zA-Z_][a-zA-Z0-9_]*\}|%index)', args[0].text)
                        logger.debug(f"args[0].text {args[0].text}")
                        found_vars.extend(found_vars_in_text)
                    logger.debug(f"Found variables for {parameter_value} value {found_vars}")
                    for raw_var in found_vars:
                        logger.debug(f"Iterating for {raw_var}")
                        if raw_var.startswith('%'):
                            # Handle only %index
                            if raw_var != '%index':
                                continue
                            variable_name = 'index'
                        else:
                            # Clean $VAR and ${VAR}
                            variable_name = raw_var.strip('${}$')

                        # Find the variable in the env_variables list
                        logger.debug(f"Trying to find value for variable {variable_name}")
                        logger.debug(f"env_variables {variable_name}")
                        index = [
                            i for i, _ in enumerate(env_variables)
                            if _["variable_name"] == variable_name
                        ]
                        if not index:
                            logger.debug(f"Variable not found {variable_name}")
                            continue  # Variable not found

                        env_var = env_variables[index[0]]
                        logger.debug(f"found variable {env_var}")

                        decrypted_value = returnDecrypted(str(env_var["variable_value"]))

                        # Regex pattern: match both $VAR and ${VAR}, or just %index
                        if raw_var.startswith('%'):
                            pattern = r'%index'
                        else:
                            pattern = r"\${?%s(?:}|\b)" % re.escape(variable_name)

                        # Replace in args[0].text if not inside a loop
                        if args[0].text and "Loop" not in save_message:
                            args[0].text = re.sub(pattern, decrypted_value, args[0].text)

                        # Replace in kwargs[parameter]
                        if re.search(pattern, parameter_value):
                            kwargs[parameter] = re.sub(pattern, decrypted_value, parameter_value)

                            # kwargs[parameter] = kwargs[parameter].replace(("$%s" % variable_name), returnDecrypted(variable_value))
                    # replace job parameters
                    for (
                        parameter_key
                    ) in (
                        job_parameters.keys()
                    ):  # we do not want to replace all the parameters inside the loop sub-steps
                        if args[0].text and "Loop" not in save_message:
                            args[0].text = re.sub(
                                r"%%%s\b" % parameter_key,
                                returnDecrypted(str(job_parameters[parameter_key])),
                                args[0].text,
                            )
                        if re.search(r"%%%s\b" % parameter_key, kwargs[parameter]):
                            kwargs[parameter] = kwargs[parameter].replace(
                                ("%%%s" % parameter_key),
                                str(job_parameters[parameter_key]),
                            )
                    # decrypt the value incase it was not a varaible
                    kwargs[parameter] = returnDecrypted(kwargs[parameter])

                    # update using dynamic date
                    kwargs[parameter] = dynamicDateGenerator(kwargs[parameter])

                # update dates inside the text
                args[0].text = dynamicDateGenerator(args[0].text)

                # set a step timeout
                step_timeout = args[0].step_data["timeout"]
                if step_timeout > MAX_STEP_TIMEOUT:
                    logger.warn(
                        "Configured step timeout is higher than the max timeout value, will cap the value to: %d"
                        % MAX_STEP_TIMEOUT
                    )
                    step_timeout = MAX_STEP_TIMEOUT
                context = args[0]
                # start the timeout
                logger.debug(f"Setting timeout on step to: {step_timeout}")
                signal.signal(
                    signal.SIGALRM,
                    lambda signum, frame, timeout=step_timeout, ctx=context: timeoutError(
                        signum, frame, ctx, timeout
                    ),
                )
                signal.alarm(step_timeout)
                # set page load timeout
                args[0].browser.set_page_load_timeout(step_timeout)
                # run the requested function
                # Check if step should execute, It should not lies in the If else conditions    
                should_execute_the_step = check_if_step_should_execute(args[0])   
                # logger.debug(f"should_execute_the_step '{should_execute_the_step}'")  
                result = None
                # condition_step_status is required to handle edge cases i.e
                # 1. condition is False but else section is not active yet and if step need to be marked as skipped
                # 2. condition is True but else section is active and else step need to marked as skipped
                if should_execute_the_step:
                    result = func(*args, **kwargs)
                    # context.CURRENT_STEP_STATUS = Skipped is assigned by the step 'End If' 
                    # CURRENT_STEP_STATUS is already set to Skipped then do not change it
                    if not args[0].CURRENT_STEP_STATUS == "Skipped":
                        condition_step_status = get_step_status(args[0])
                        # logger.debug(f"condition_step_status '{condition_step_status}'")
                        args[0].CURRENT_STEP_STATUS = condition_step_status
                else:
                    args[0].CURRENT_STEP_STATUS = "Skipped"
                    logger.debug(f"######################### Skipping the step \" {args[0].CURRENT_STEP.name} \"#########################") 
    
                # if step executed without running into timeout cancel the timeout
                signal.alarm(0)
                # save the result to database
                saveToDatabase(
                    save_message, (time.time() - start_time) * 1000, 0, True, args[0]
                )
                # return True meaning everything went as expected
                return result
            except Exception as err:
                args[0].CURRENT_STEP_STATUS = "Failed"
                # reset timeout incase of exception in function
                signal.alarm(0)
                # print stack trace
                logger.exception(err, stack_info=True)
                # Set step exception to be saved in the database, 
                # As timeout exception does not give idea about what happed with the application
                # set the error message to the step_error inside context so we can pass it through websockets!
                args[0].step_error = logger.mask_values(str(err))
                try:
                    # save the result to databse as False since the step failed
                    saveToDatabase(
                        save_message,
                        (time.time() - start_time) * 1000,
                        0,
                        False,
                        args[0]
                    )
                except Exception as err:
                    logger.error(
                        "Exception raised while trying to save step data to database."
                    )
                    logger.exception(err)

                # check if feature was aborted
                aborted = str(err) == "'aborted'"
                logger.debug("Checking if feature was aborted: " + str(aborted))

                # check the continue on failure hierarchy
                continue_on_failure = False  # default value
                continue_on_failure = (
                    args[0]
                    .PROXY_USER["settings"]
                    .get("continue_on_failure", False)  # check user settings
                    or args[0]
                    .department["settings"]
                    .get("continue_on_failure", False)  # check department settings
                    or args[0].feature_continue_on_failure  # check feature settings
                    or args[0].step_data.get(
                        "continue_on_failure", False
                    )  # check step settings
                )

                # check if continue on failure is set
                if continue_on_failure and not aborted:
                    logger.debug(
                        "Not failing on %s because continue on failure is checked."
                        % args[0].step_data["step_content"]
                    )
                    logger.error("Error: %s" % str(err))
                else:
                    # fail the feature
                    raise AssertionError(str(err))
            finally:
                # reset element highligh is any
                reset_element_highlight(args[0])
            # if the user gets here means that something went wrong somewhere.
            return False

        return execute

    return decorator


def saveToDatabase(
    step_name="", execution_time=0, pixel_diff=0, success=False, context=None
):  
    start_time = time.time()  # Add timing start
    logger.debug("Starting execution of saveToDatabase")
    logger.debug(f"Step Status: {context.CURRENT_STEP_STATUS}")
    screenshots = os.environ["SCREENSHOTS"].split(".")
    compares = os.environ["COMPARES"].split(".")
    feature_id = context.feature_id
    feature_result_id = os.environ["feature_result_id"]
    notes_data = context.step_data.get("notes", {})
    
    if notes_data=={} and context.LAST_STEP_DB_QUERY_RESULT is not None:
        notes_data = {
            "title": "Query Output",
            "content": json.dumps(context.LAST_STEP_DB_QUERY_RESULT)
        }
    elif notes_data=={} and context.LAST_STEP_VARIABLE_AND_VALUE is not None:
        notes_data = {
            "title": "Created Variables Value",
            "content": json.dumps(context.LAST_STEP_VARIABLE_AND_VALUE)
        }
              
    data = {
        "feature_result_id": feature_result_id,
        "step_name": step_name,
        # "relative_execution_time": context.previous_step_relative_time+int(execution_time),
        "execution_time": int(execution_time),
        "pixel_diff": float(pixel_diff),
        "success": success,
        "status": context.CURRENT_STEP_STATUS,
        "belongs_to": context.step_data["belongs_to"],
        "rest_api_id": context.step_data.get("rest_api", None),
        "notes": notes_data,
        "database_query_result": context.LAST_STEP_DB_QUERY_RESULT,
        "current_step_variables_value": context.LAST_STEP_VARIABLE_AND_VALUE,
        "step_execution_sequence": context.counters['step_sequence']
    }
    
    #     logger.debug("Updating the values after processing the screenshot")
    #     data.update(values)
        
    # except Exception as e:
    #     logger.exception("Exception while processing the screenshots",e)
    #     traceback.print_exc()
        
    # add custom error if exists
    if "custom_error" in context.step_data:
        data["error"] = context.step_data["custom_error"]
    elif hasattr(context, "step_error"):
        data["error"] = context.step_error
    # add files
    try:
        data["files"] = json.dumps(context.downloadedFiles[context.counters["index"]])
    except:
        data["files"] = json.dumps([])

    log_file = open("output.txt", "w")
    # Since it contains the network logs data which sometime contains the images, logging image in the console make it very hard to read logs
    # removing variables 
    data_logger = data.copy()
    data_logger['current_step_variables_value'] = {"variable_hidden_message":"Since it contains the network logs data which sometime contains the images, logging image in the console make it very hard to read logs, removing variables "}
    log_file.write("Data -> ")
    log_file.write(str(data_logger))
    log_file.write("\n")
    logger.debug("Saving data to feature_result")
    try:
        _async_post(
            f"{get_cometa_backend_url()}/api/feature_results/"
            + str(feature_id)
            + "/step_results/"
            + str(feature_result_id)
            + "/",
            headers={"Host": "cometa.local"},
            json=data,
        )
        logger.debug(f"feature_result backend request completed")
        context.step_result = json.dumps({"success": success})
        logger.debug(f"Step Result Context: {context.step_result}")

        logger.debug("feature_result async request enqueued")
        log_file.write("Async request enqueued\n")
        log_file.close()
        logger.debug("feature result response writen in the log_file")
        
    except Exception as e:
        logger.exception("*** An error occurred: ")
        logger.exception(str(e))
        traceback.print_exc()

    
    take_screenshot_and_process(context=context, step_name=step_name, success=success, 
                                             step_execution_sequence=context.counters['step_sequence'],
                                             feature_result_id=feature_result_id
                                             )         
       
    # Calculate and log total execution time
    total_time = (time.time() - start_time) * 1000  # Convert to milliseconds
    logger.debug(f"saveToDatabase took {total_time:.2f}ms to execute")


# Get the device driver during step execution
# Plan is to improve this method to execute this testcase when there is no browser/mobile required 
# In that case do not take the screenshot 
def get_device_driver(context):
    
    driver = None
    if context.STEP_TYPE=='MOBILE':
        if len(context.mobiles)>0:
            driver = context.mobile['driver']
    else: 
        driver = context.browser
        
    return driver

import os, shutil, requests, threading

    
# This method should not be called with async because we need to take the screenshot right after the step is executed
# calling it with async makes next step to executed which takes the screenshot of other step
def take_screenshot_and_process(context, step_name, success, step_execution_sequence, feature_result_id):
    # Some steps shouldn't be allowed to take screenshots and compare, as some can cause errors
    excluded = ["Close the browser"]
    
    start_time = time.time()  # Add timing start
    logger.debug("Starting execution of saveToDatabase")
    
    # Exclude banned steps
    if step_name in excluded:
        return
    
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")  # Format: YYYYMMDD_HHMMSS_microseconds
    screenshots_step_path = os.path.join(context.SCREENSHOTS_PATH, timestamp)
    logger.debug(f"step_screenshot_path : {screenshots_step_path} ")
    # Check if feature needs screenshot - see #3014 for change to webp format
    if context.step_data["screenshot"] or not success:
        # Create current step result folder ... only create, if needed
        Path(screenshots_step_path).mkdir(parents=True, exist_ok=True)
        # Take actual screenshot
        logger.debug(f"Taking screenshot for step")
        # This step can be executed on Mobile or Browser get the driver accordingly
        current_step_device_driver = get_device_driver(context=context)
        
        if not current_step_device_driver:
            logger.debug("No driver found skipping screenshot")
            return
        
        screenshot_file_name = SCREENSHOT_PREFIX + "current.png"
        logger.debug("Screenshot filename: %s" % screenshot_file_name)
        final_screenshot_file = os.path.join(screenshots_step_path, screenshot_file_name)
        logger.debug("Final screenshot filename and path: %s" % final_screenshot_file)
        logger.debug(f"Screenshot taken for step")
        screenshot_data = takeScreenshot(current_step_device_driver)  
      
        if final_screenshot_file is None:
            return
        
        logger.debug(f"Started the screenshot prcessing step thread for step {context.counters['index']}")
        _async_process_screen_shot(
                  step_execution_sequence, 
                  feature_result_id,
                  context.step_data["compare"],
                  screenshot_data,
                  screenshot_file_name,
                  final_screenshot_file,
                  screenshots_step_path,
                  context.TEMPLATES_PATH,
                  context.SCREENSHOTS_ROOT,
                  SCREENSHOT_PREFIX,
                  context.counters["index"],
                  context.feature_id,
                  context.PROXY_USER["user_id"],
                  context.browser_info,
                  context.step_data["belongs_to"],
                  context.browser_hash,
                #   current_step_device_driver
                ) 
        
    
    # Calculate and log total execution time
    total_time = (time.time() - start_time) * 1000  # Convert to milliseconds
    logger.debug(f"take_screenshot_and_process took {total_time:.2f}ms to execute")
    

def _async_process_screen_shot(
    step_execution_sequence,
    feature_result_id,
    compare,
    screenshot_data,
    screenshot_file,
    final_screenshot_file,
    screenshots_step_path,
    templates_path,
    screenshots_root,
    screenshot_prefix,
    index_counter,
    feature_id, 
    user_id,
    browser_info, 
    step_data_belongs_to, 
    browser_hash,
    # current_step_device_driver
):
    
    def _task():
        try:
            backend_screenshot_data = {}
            websocket_screenshot_data = {}
        
            # time.sleep(0.1)
            logger.debug("Converting %s to webP" % final_screenshot_file)
            # Convert screenshot to WebP
            toWebP_from_data(screenshot_data, final_screenshot_file)
            logger.debug("Converting screenshot done")
        
            if compare:
                logger.debug("Starting the image comparison")
                
                compare_image = os.path.join(screenshots_step_path, screenshot_file).replace(".png", ".webp")
                style_image = os.path.join(templates_path, f"{screenshot_prefix}template_{index_counter}.webp")
                style_image_copy_to_show = os.path.join(screenshots_step_path, f"{screenshot_prefix}style.webp")
                diff_image = os.path.join(screenshots_step_path, f"{screenshot_prefix}difference.png")

                migrateOldStyles(feature_id, index_counter, browser_hash, screenshots_root, style_image)  # You may need to modify this helper too

                if not os.path.isfile(style_image):
                    logger.debug(f"StyleImage not found, copying {compare_image} to {style_image}")
                    shutil.copy2(compare_image, style_image)

                if not os.path.isfile(style_image_copy_to_show):
                    logger.debug(f"StyleImageToShow not found - copying {style_image} to {style_image_copy_to_show}")
                    shutil.copy2(style_image, style_image_copy_to_show)

                logger.debug("Comparing image")
                pixel_diff = highlight_pixel_differences(compare_image, style_image, diff_image)

                if pixel_diff is None:
                    raise CustomError("Compare tool returned NoneType")

                toWebP(diff_image)
                backend_screenshot_data["pixel_diff"] = pixel_diff
                # pixel_diff_counter += pixel_diff
            else:
                # This when code executed and there is no baseline 
                compare_image = os.path.join(screenshots_step_path, screenshot_file).replace(".png", ".webp")
                style_image = style_image_copy_to_show = diff_image = None

            db_current_screenshot = (
                removePrefix(compare_image, screenshots_root).replace(".png", ".webp")
                if compare_image else ""
            )
            
            logger.debug(f"DB_CURRENT_SCREENSHOT {db_current_screenshot}")
            
            if db_current_screenshot:
                backend_screenshot_data["screenshot_current"] = db_current_screenshot
                
                # FIXME Need to check how to avoid this
                websocket_screenshot_data['current'] = db_current_screenshot

                if style_image_copy_to_show:
                    backend_screenshot_data["screenshot_style"] = (
                        removePrefix(style_image_copy_to_show, screenshots_root).replace(".png", ".webp")
                    )

                if diff_image:
                    backend_screenshot_data["screenshot_difference"] = (
                        removePrefix(diff_image, screenshots_root).replace(".png", ".webp")
                    )
                    websocket_screenshot_data['difference'] = backend_screenshot_data["screenshot_difference"]

                if style_image:
                    backend_screenshot_data["screenshot_template"] = (
                        removePrefix(style_image, screenshots_root)
                    )
                    websocket_screenshot_data['template'] = backend_screenshot_data["screenshot_template"]

                addTimestampToImage(db_current_screenshot, path=screenshots_root)

                logger.debug(f"Sending screenshot details to the backend {backend_screenshot_data}")

                send_step_screen_shot_details(feature_id, feature_result_id, user_id, browser_info, index_counter, step_data_belongs_to, websocket_screenshot_data)
                
                requests.post(
                    f"{get_cometa_backend_url()}/steps/{feature_result_id}/{step_execution_sequence}/update/",
                    headers={"Host": "cometa.local"},
                    json=backend_screenshot_data,
                )
                
        except Exception as e:
            logger.exception(f"screenshot processing failed",e)
    
    _executor.submit(_task)

    # return backend_screenshot_data, websocket_screenshot_data

# add timestamp to the image using the imagemagic cli
def addTimestampToImage(image, path=None):
    logger.debug(f"Adding timestamp to: {path}/{image}")
    cmd = f"convert {path}/{image} -pointsize 20 -font DejaVu-Sans-Mono -fill 'RGBA(255,255,255,1.0)' -gravity SouthEast -annotate +20+20 \"$(date)\" {path}/{image}"
    status = subprocess.call(cmd, shell=True, env={})
    if status != 0:
        logger.error("Something happend during the timestamp watermark.")


# Automatically checks if there's still old styles and moves them to current path
# Due to change in new images structure we have to check if the old style image is still there,
# # if it is we copy it to style image path and delete the old one
def migrateOldStyles(feature_id, counter_index, browser_hash, screenshot_root, style_image):
    # Second style format used with feature id, step index and browser hash
    old_style_2 = (
        screenshot_root
        + SCREENSHOT_PREFIX
        + "%s_%d_%s_style.png"
        % (feature_id, counter_index, browser_hash)
    )
    # First style format used with only feature id and step index as key
    old_style_1 = (
        screenshot_root
        + SCREENSHOT_PREFIX
        + "%s_%d_style.png" % (feature_id, counter_index)
    )
    # Check for existing second style first
    if os.path.isfile(old_style_2):
        # Old style was found with most recent format, move it as style image
        shutil.move(old_style_2, style_image)
        # We still need to check if the old_style_1 exists, and delete it if exists as we no longer need it (we have old_style_2)
        if os.path.isfile(old_style_1):
            os.remove(old_style_1)
    elif os.path.isfile(old_style_1):
        # Old style was found with oldest format, move it as style image
        shutil.move(old_style_1, style_image)


# ----------- 
# Function to automatically take an HTML Snapshot of current page source
# and save it to HTML file with current step index
# -----------
def takeHTMLSnapshot(context, step_id):
    start = datetime.datetime.now()
    # Take snapshot of HTML
    context.SOURCE_HTML = context.browser.page_source
    # Set filename of current HTML without extension
    context.COMPARE_HTML_FILE = "%s%s%d" % (
        context.HTML_PATH,
        SCREENSHOT_PREFIX,
        step_id,
    )
    # Same with extension
    context.COMPARE_HTML_FILE_EXT = context.COMPARE_HTML_FILE + ".html"
    # Save Snapshot to HTML File
    with open(context.COMPARE_HTML_FILE_EXT, "w") as html_file:
        html_file.write(context.SOURCE_HTML)
    end = datetime.datetime.now()
    logger.debug(
        "HTML Snapshot took: %dms" % ((end - start).total_seconds() * 1000)
    )  # Max 20ms


# -----------
# Function to compare HTML differences between previous state and current,
# it first makes sure the previous state exists (by clonning current),
# then executes the comparison and finally return if they are different
# -----------
def compareHTML(params):
    try:
        start = datetime.datetime.now()
        # Compose path for previous HTML snapshot of current step
        TEMPLATE_HTML_FILE = (
            params["HTML_PATH"]
            + SCREENSHOT_PREFIX
            + "%s_%d_style.html" % (params["feature_id"], params["counters"]["index"])
        )
        # Copy current HTML to template HTML if not found
        if os.path.isfile(TEMPLATE_HTML_FILE):
            # Read Template HTML content
            with open(TEMPLATE_HTML_FILE, "r") as content:
                TEMPLATE_HTML_CONTENT = content.read()
        else:
            shutil.copy2(params["COMPARE_HTML_FILE_EXT"], TEMPLATE_HTML_FILE)
            # Copy current HTML as template HTML
            TEMPLATE_HTML_CONTENT = params["SOURCE_HTML"]
        # Compare HTML
        html_diff = diff(TEMPLATE_HTML_CONTENT, params["SOURCE_HTML"])
        # Output HTML Difference to Diff file
        DIFF_HTML_FILE = "%s_diff.html" % params["COMPARE_HTML_FILE"]
        with open(DIFF_HTML_FILE, "w") as html_file:
            html_file.write(html_diff)
        end = datetime.datetime.now()
        logger.debug(
            "HTML Compare took: %dms" % ((end - start).total_seconds() * 1000)
        )  # Min 200ms
        # Return if there was a difference or not
        different = TEMPLATE_HTML_CONTENT != params["SOURCE_HTML"]
        requests.post(
            f"{get_cometa_backend_url()}/steps/" + str(params["step_id"]) + "/update/",
            json={"different_html": different},
            headers={"Host": "cometa.local"},
        )
    except Exception as err:
        logger.info("Something went wrong while comparing HTML snapshots.")
        logger.error(str(err))

# -----------
# Function to compare HTML differences between previous state and current,
# it first makes sure the previous state exists (by clonning current),
# then executes the comparison and finally return if they are different
# -----------
def highlight_pixel_differences(image1_path, image2_path, output_path):
    img1 = cv2.imread(image1_path)
    img2 = cv2.imread(image2_path)

    # Resize if needed
    if img1.shape != img2.shape:
        img2 = cv2.resize(img2, (img1.shape[1], img1.shape[0]))

    # Compute absolute pixel differences
    diff = cv2.absdiff(img1, img2)

    # Convert the diff to grayscale
    gray_diff = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)

    # Threshold to detect actual changes
    _, mask = cv2.threshold(gray_diff, 30, 255, cv2.THRESH_BINARY)

    # Count the number of different pixels
    diff_pixel_count = cv2.countNonZero(mask)
    print(f"Number of different pixels: {diff_pixel_count}")

    # Create a copy of the first image for visualization
    highlighted = img1.copy()

    # Apply red color where there are differences
    highlighted[mask == 255] = [0, 0, 255]  # Red color (BGR)

    # Save the highlighted output
    cv2.imwrite(output_path, highlighted)
    print(f"Highlighted difference image saved as: {output_path}")

    return diff_pixel_count


def compareImage(context):
    try:
        """
        see https://stackoverflow.com/questions/25198558/matching-image-to-images-collection
        magick compare -verbose screenshots/images/style-guide/search-result/search-result/chrome~ref.png screenshots/style-guide/search-result/search-result/chrome.png diff.png
        """
     
        # Retrieve image vars from context
        actimg = context.COMPARE_IMAGE
        styleimg = context.STYLE_IMAGE
        diff = context.DIFF_IMAGE
        # Get current directory path
        pwd = os.getcwd()
        feature_data = json.loads(os.environ["FEATURE_DATA"])
        metricFile = "%s/metrics/%s_%s_%s.metric" % (
            pwd,
            slugify(feature_data["feature_name"]),
            str(context.feature_id),
            context.browser_hash,
        )
        with open(metricFile, "w+") as metric:
            # Run compare command
            cmd = "/usr/bin/compare -fuzz 10%% -channel all -metric AE  %s %s %s" % (
                actimg,
                styleimg,
                diff,
            )
            logger.debug("Before executing command: %s" % cmd)
            # FIXME: without this print throws error on arguments length too long.
            logger.debug("Command length: %d" % len(cmd))
            status = subprocess.call(
                cmd, stdout=metric, stderr=metric, shell=True, env={}
            )
            # Status codes for ImageMagick Compare: (https://www.imagemagick.org/discourse-server/viewtopic.php?t=22451&start=15)
            #   0 = Success
            #   1 = Found different sized images but ImageMagick was able to make a difference metric and create the diff image
            #   2 = Dissimilarity Threshold value too high, ImageMagick wasn't able to do the job
            if status == 1:
                logger.info("Compared images with low dissimilarity threshold value")
            if status == 2:
                logger.info(
                    "Unable to compare images, showing empty image with custom text"
                )
                subprocess.call(
                    '/usr/bin/convert -size 2400x1200 xc:White -gravity Center -font /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf -weight 700 -pointsize 50 -annotate 0 "Resolution of the images is different,\nplease delete the template image or check the browser resolution in testplan." '
                    + diff,
                    shell=True,
                )
                # Return very high pixel difference
                return 111968
        # Parse Diff number
        lines = waitMetric(metricFile)
        return int(lines[0])
        for line in lines:
            if "all" in line:
                reg = re.compile("all: (.*) ?(?:.*)?")
                match = reg.search(line)
                diff = match.group(1)
                return str(float(diff))
    except Exception as e:
        logger.error(str(e))
        traceback.print_exc()


# @timeout("Unable to retrieve compare metric content in <seconds> seconds.")
def waitMetric(metricFile):
    """
    Waits for the given metric file to contain some content and returns the lines array
    """
    while True:
        with open(metricFile, "r") as metric:
            lines = metric.readlines()
            if len(lines) > 0:
                return [x.strip() for x in lines]
        time.sleep(1)
    return []


def clear_html_page_source(page_source):
    # parse html content
    soup = BeautifulSoup(page_source, "html.parser")

    for data in soup(["style", "script"]):
        # Remove tags
        data.decompose()

    # return the HTML and minify it
    return re.sub(r"\n", "", str(soup))


def mySafeToFile(filename, myString):
    text_file = open(filename, "w")
    text_file.write(myString)
    text_file.close()


# waitFor(something,pageContext) .... waits until seeing or maxtries; returns true if found
# ... FIXME ... also look in iFrames
# @timeout("Unable to find specified text in <seconds> seconds.")
def waitFor(context, something):
    while True:
        if something in context.browser.page_source:
            return True
        time.sleep(1)
    return False


# check if string can be converted to integer
def isINT(string):
    try:
        int(string)
        return True
    except:
        return False


# Automatically detects if the passed variables contains a given type prefix
# Available prefixes:
#  - index:
#  - value: (default)
def getVariableType(variable):
    # Remove possible spaces on start and end
    variable = variable.strip()
    # Check is index
    if variable.startswith("index:"):
        # Remove prefix
        variable = variable[6:]
        # Check valid index
        if isINT(variable):
            variable = int(variable)
            return variable
        else:
            raise CustomError("Index %s is not a valid number" % str(variable))
    # Check is value (default)
    if variable.startswith("value:"):
        # Remove prefix
        variable = variable[6:]
    return variable

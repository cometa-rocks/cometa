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

from utility.functions import toWebP
from utility.encryption import *
from tools.models import check_if_step_should_execute

# setup logging
logger = logging.getLogger("FeatureExecution")

from utility.configurations import ConfigurationManager

SCREENSHOT_PREFIX = ConfigurationManager.get_configuration(
    "COMETA_SCREENSHOT_PREFIX", ""
)

#
# some usefull functions
#
def takeScreenshot(context, step_id):
    # prepare a screenshot name
    logger.debug("Taking screenshot")
    start_time = time.time()  # prepare a screenshot name
    DATETIMESTRING = time.strftime("%Y%m%d-%H%M%S")  # LOOKS LIKE IS NOT USED
    context.SCREENSHOT_FILE = SCREENSHOT_PREFIX + "current.png"
    context.MOBILE_SCREENSHOT_FILE = "Mobile_"+SCREENSHOT_PREFIX + "current.png"
    logger.debug("Screenshot filename: %s" % context.SCREENSHOT_FILE)
    final_screenshot_file = context.SCREENSHOTS_STEP_PATH + context.SCREENSHOT_FILE
    logger.debug("Final screenshot filename and path: %s" % final_screenshot_file)

    # check if an alert box exists
    try:
        context.browser.switch_to.alert
        logger.debug(
            "Alert found ... if we take a screenshot now the alert box will be ignored..."
        )
    except Exception as err:
        # create the screenshot
        logger.debug("Saving screenshot to file")
        try:
            if context.STEP_TYPE=='MOBILE':
               context.mobile['driver'].save_screenshot(final_screenshot_file)
            else: 
                context.browser.save_screenshot(final_screenshot_file)

        except Exception as err:
            logger.error("Unable to take screenshot ...")
            logger.exception(err)

    # transfer saved image name to context.COMPARE_IMAGE
    context.COMPARE_IMAGE = final_screenshot_file
    # sleep just 100ms so we can be sure the file has been created
    time.sleep(0.1)
    logger.debug("Converting %s to webP" % context.SCREENSHOT_FILE)
    # Convert screenshot to WebP
    toWebP(final_screenshot_file)
    logger.debug("Converting screenshot done")
    return final_screenshot_file


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


# variables added using this method will not be saved in the database
def addTestRuntimeVariable(context, variable_name, variable_value):
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
        context.LAST_STEP_VARIABLE_AND_VALUE = env_variables[index]
    else:
        logger.debug("Adding new variable")
        new_variable = {
            "variable_name": variable_name,
            "variable_value": variable_value,
            "encrypted": False,
        }
        env_variables.append(new_variable)
        context.LAST_STEP_VARIABLE_AND_VALUE = new_variable

    context.VARIABLES = json.dumps(env_variables)


def addVariable(context, variable_name, result, encrypted=False):
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
        context.LAST_STEP_VARIABLE_AND_VALUE = env_variables[index]
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
        context.LAST_STEP_VARIABLE_AND_VALUE = {
                "variable_name": variable_name,
                "variable_value": result,
                "encrypted": encrypted,
            }
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

                # replace variables in kwargs
                for parameter in kwargs:
                    if not kwargs[parameter]:
                        continue
                    # replace variables
                    for key in env_variables:
                        variable_name = key["variable_name"]
                        variable_value = str(key["variable_value"])
                        pattern = r"\${?%s(?:}|\b)" % variable_name
                        if (
                            args[0].text and "Loop" not in save_message
                        ):  # we do not want to replace all the variables inside the loop sub-steps
                            # Replace in step description for multiline step values
                            args[0].text = re.sub(
                                pattern, returnDecrypted(variable_value), args[0].text
                            )
                            # ###
                            # variable was not being replaced correctly if variable contained another variable name in itself.
                            # ###
                            # args[0].text = args[0].text.replace(("$%s" % variable_name), returnDecrypted(variable_value))
                        if re.search(pattern, kwargs[parameter]):
                            # Replace in step content
                            kwargs[parameter] = re.sub(
                                pattern,
                                returnDecrypted(variable_value),
                                kwargs[parameter],
                            )
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

                # start the timeout
                logger.debug(f"Setting timeout on step to: {step_timeout}")
                signal.signal(
                    signal.SIGALRM,
                    lambda signum, frame, timeout=step_timeout: timeoutError(
                        signum, frame, timeout
                    ),
                )
                signal.alarm(step_timeout)
                # set page load timeout
                args[0].browser.set_page_load_timeout(step_timeout)
                # run the requested function
                # Check if step should execute, It should not lies in the If else conditions    
                should_execute_the_step = check_if_step_should_execute(args[0])     
                result = None

                if should_execute_the_step:
                    result = func(*args, **kwargs)
                    args[0].CURRENT_STEP_STATUS = "Success"
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
    status = context.CURRENT_STEP_STATUS 
    screenshots = os.environ["SCREENSHOTS"].split(".")
    compares = os.environ["COMPARES"].split(".")
    feature_id = context.feature_id
    feature_result_id = os.environ["feature_result_id"]
    data = {
        "feature_result_id": feature_result_id,
        "step_name": step_name,
        "execution_time": int(execution_time),
        "pixel_diff": float(pixel_diff),
        "success": success,
        "status": status,
        "belongs_to": context.step_data["belongs_to"],
        "rest_api_id": context.step_data.get("rest_api", None),
        "notes": context.step_data.get("notes", {}),
        "database_query_result": context.LAST_STEP_DB_QUERY_RESULT,
        "current_step_variables_value": context.LAST_STEP_VARIABLE_AND_VALUE,

    }
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
    log_file.write("Data -> ")
    log_file.write(str(data))
    log_file.write("\n")
    try:
        response = requests.post(
            f"{get_cometa_backend_url()}/api/feature_results/"
            + str(feature_id)
            + "/step_results/"
            + str(feature_result_id)
            + "/",
            headers={"Host": "cometa.local"},
            json=data,
        )
        context.step_result = json.dumps(response.json())
        step_id = response.json()["step_result_id"]
        log_file.write("Response Content: " + str(response.content))
        json_success = {"success": success}
    except Exception as e:
        logger.error("An error occured: ")
        logger.error(str(e))

    log_file.close()
    # Some steps shouldn't be allowed to take screenshots and compare, as some can cause errors
    excluded = ["Close the browser"]
    # Exclude banned steps
    if step_name not in excluded:
        # Construct current step result path
        context.SCREENSHOTS_STEP_PATH = context.SCREENSHOTS_PATH + str(step_id) + "/"
        # Create current step result folder
        Path(context.SCREENSHOTS_STEP_PATH).mkdir(parents=True, exist_ok=True)
        # Check if feature needs screenshot - see #3014 for change to webp format
        if context.step_data["screenshot"] or not success:
            # Take actual screenshot
            takeScreenshot(context, step_id)
            # Take actual HTML
            # takeHTMLSnapshot(context, step_id)
        # Check if feature needs compare
        if context.step_data["compare"]:
            # --------------------
            # Compare images
            # --------------------
            # Construct current screenshot path
            context.COMPARE_IMAGE = (
                context.SCREENSHOTS_STEP_PATH + context.SCREENSHOT_FILE
            ).replace(".png", ".webp")
            # Construct template screenshot path
            context.STYLE_IMAGE = (
                context.TEMPLATES_PATH
                + SCREENSHOT_PREFIX
                + "template_%d.webp" % context.counters["index"]
            )
            # Construct the style copy image path only for the user to see it
            context.STYLE_IMAGE_COPY_TO_SHOW = (
                context.SCREENSHOTS_STEP_PATH + SCREENSHOT_PREFIX + "style.webp"
            )
            # Construct difference image path
            context.DIFF_IMAGE = (
                context.SCREENSHOTS_STEP_PATH + SCREENSHOT_PREFIX + "difference.png"
            )
            # Migrate old style images in disk
            migrateOldStyles(context)
            # Check if the style image already exists or not, if not, the current screenshot will be copied and used as style
            if not os.path.isfile(context.STYLE_IMAGE):
                # Check if we have
                logger.debug(
                    "StyleImage is not there ... copying %s to %s"
                    % (context.COMPARE_IMAGE, context.STYLE_IMAGE)
                )
                shutil.copy2(context.COMPARE_IMAGE, context.STYLE_IMAGE)
            # Check if the template to show is there ... if not copy it
            if not os.path.isfile(context.STYLE_IMAGE_COPY_TO_SHOW):
                # shutil.copy2(context.COMPARE_IMAGE, context.STYLE_IMAGE_COPY_TO_SHOW) # this is the old value for show image it copies the actual images and saves it as the comparable image which results in on front end we see the same image on actual and the style image
                logger.debug(
                    "StyleImageToShow is not there - copying %s to %s"
                    % (context.STYLE_IMAGE, context.STYLE_IMAGE_COPY_TO_SHOW)
                )
                shutil.copy2(context.STYLE_IMAGE, context.STYLE_IMAGE_COPY_TO_SHOW)
            # Compare the screenshots ... will results in AMVARA_difference.png in png format
            logger.debug("Comparing image")
            pixel_diff = compareImage(context)
            # Check compare image was successful
            if pixel_diff is None:
                raise CustomError("Compare tool returned NoneType")

            # Convert difference image to WebP
            toWebP(context.DIFF_IMAGE)

            data = {"pixel_diff": str(pixel_diff)}
            # Save Pixel Difference for calculating Total in after_all
            context.counters["pixel_diff"] += int(float(pixel_diff))
            logger.debug("Saveing pixel difference %s to database" % str(pixel_diff))
            requests.post(
                f"{get_cometa_backend_url()}/steps/" + str(step_id) + "/update/",
                json=data,
                headers={"Host": "cometa.local"},
            )

        # Format screenshots
        context.DB_CURRENT_SCREENSHOT = (
            removePrefix(context.COMPARE_IMAGE, context.SCREENSHOTS_ROOT).replace(
                ".png", ".webp"
            )
            if hasattr(context, "COMPARE_IMAGE")
            else ""
        )
        context.DB_STYLE_SCREENSHOT = (
            removePrefix(
                context.STYLE_IMAGE_COPY_TO_SHOW, context.SCREENSHOTS_ROOT
            ).replace(".png", ".webp")
            if hasattr(context, "STYLE_IMAGE_COPY_TO_SHOW")
            else ""
        )
        context.DB_DIFFERENCE_SCREENSHOT = (
            removePrefix(context.DIFF_IMAGE, context.SCREENSHOTS_ROOT).replace(
                ".png", ".webp"
            )
            if hasattr(context, "DIFF_IMAGE")
            else ""
        )
        context.DB_TEMPLATE = (
            removePrefix(context.STYLE_IMAGE, context.SCREENSHOTS_ROOT)
            if hasattr(context, "STYLE_IMAGE")
            else ""
        )
        data = {
            "screenshot_current": context.DB_CURRENT_SCREENSHOT,
            "screenshot_style": context.DB_STYLE_SCREENSHOT,
            "screenshot_difference": context.DB_DIFFERENCE_SCREENSHOT,
            "screenshot_template": context.DB_TEMPLATE,
        }
        logger.debug("Writing data %s to database" % json.dumps(data))
        requests.post(
            f"{get_cometa_backend_url()}/setScreenshots/%s/" % str(step_id),
            json=data,
            headers={"Host": "cometa.local"},
        )
        # add timestamps to the current image
        if context.DB_CURRENT_SCREENSHOT:
            addTimestampToImage(
                context.DB_CURRENT_SCREENSHOT, path=context.SCREENSHOTS_ROOT
            )
    return step_id


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
def migrateOldStyles(context):
    # Second style format used with feature id, step index and browser hash
    old_style_2 = (
        context.SCREENSHOTS_ROOT
        + SCREENSHOT_PREFIX
        + "%s_%d_%s_style.png"
        % (context.feature_id, context.counters["index"], context.browser_hash)
    )
    # First style format used with only feature id and step index as key
    old_style_1 = (
        context.SCREENSHOTS_ROOT
        + SCREENSHOT_PREFIX
        + "%s_%d_style.png" % (context.feature_id, context.counters["index"])
    )
    # Check for existing second style first
    if os.path.isfile(old_style_2):
        # Old style was found with most recent format, move it as style image
        shutil.move(old_style_2, context.STYLE_IMAGE)
        # We still need to check if the old_style_1 exists, and delete it if exists as we no longer need it (we have old_style_2)
        if os.path.isfile(old_style_1):
            os.remove(old_style_1)
    elif os.path.isfile(old_style_1):
        # Old style was found with oldest format, move it as style image
        shutil.move(old_style_1, context.STYLE_IMAGE)


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


def compareImage(context):
    try:
        """
        see https://stackoverflow.com/questions/25198558/matching-image-to-images-collection
        magick compare -verbose screenshots/images/style-guide/search-result/search-result/chrome~ref.png screenshots/style-guide/search-result/search-result/chrome.png diff.png
        """
        start_time = time.time()
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
        return str(float(lines[0]))
        for line in lines:
            if "all" in line:
                reg = re.compile("all: (.*) ?(?:.*)?")
                match = reg.search(line)
                diff = match.group(1)
                return str(float(diff))
    except Exception as e:
        logger.error(str(e))


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

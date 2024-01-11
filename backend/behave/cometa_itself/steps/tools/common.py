import time
import signal
import logging
from .exceptions import *
from .variables import *
from functools import wraps
from selenium.webdriver.remote.webelement import WebElement
from selenium.webdriver.common.by import By
from selenium.common.exceptions import InvalidSelectorException, NoSuchElementException
import time, requests, json, os, datetime, sys, subprocess, re, shutil
from src.backend.common import *
from src.backend.utility.cometa_logger import CometaLogger
sys.path.append("/code")
from secret_variables import COMETA_UPLOAD_ENCRYPTION_PASSPHRASE

# setup logging
logging.setLoggerClass(CometaLogger)
logger = logging.getLogger('FeatureExecution')

"""
Python library with common utility functions
"""

class CometaTimeoutException(Exception):
    pass

class CometaMaxTimeoutReachedException(Exception):
    pass

# timeout error
# throws an CustomError exception letting user know about the issue
def timeoutError(signum, frame, timeout=MAX_STEP_TIMEOUT, error=None):
    if error is None:
        error = f"Step took more than configured time: {timeout}s."
    raise CometaTimeoutException(error)

# DEPRECATED:
def timeout( *_args, **_kwargs ):
    def decorator(func):
        @wraps(func)
        def execute(*args, **kwargs):
            # get current step timeout or default from MAXRETRIES
            timeout = int(getattr(args[0], 'step_data', {}).get('timeout', MAXRETRIES))
            # replace <seconds> in text
            try:
                text = _args[0].replace('<seconds>', str(timeout))
            except:
                text = 'Step took more than %ds. Please try a different configuration for the step or contact a system administrator to help you with the issue.' % timeout
            # start the timeout
            signal.signal(signal.SIGALRM, lambda signum, frame, waitedFor=timeout, error=text: timeoutError(signum, frame, waitedFor, error))
            # added +1 as a quick fix when user executes a sleep for 1 second step and set 1s to step timeout,
            # step is failed since the function takes additional microseconds.
            signal.alarm(timeout+1)
            # run the requested function
            result = func(*args, **kwargs)
            # if step executed without running into timeout cancel the timeout
            signal.alarm(0)
            # return the result
            return result
        return execute
    return decorator

# ---
# Wrapper function to wait until an element, selector, id, etc is present
# ... if first try for defined selector is not found
# ... then it starts looping over the 6 different selectors type (e.g. css, id, xpath, ... )
# ... until found or max trys is reached, between each loop wait for 1 second
# ---
# @author Alex Barba
# @param context - Object containing the webdriver context
# @param selector_type: string - Type of selector to use, see below code for possible types
# @param selector: string - Selector to use
# @timeout("Waited for <seconds> seconds but unable to find specified element.")
def waitSelector(context, selector_type, selector, max_timeout=None):
    # set the start time for the step
    start_time = time.time()
    #2288 - Split : id values into a valid css selector
    # example: "#hello:world" --> [id*=hello][id*=world]
    selectorWords = selector.split(' ')
    if selector_type == "css" and selectorWords[0].startswith("#") and ":" in selectorWords[0]:
        # Remove hash
        selectorWords[0] = selectorWords[0].replace('#','')
        # Split using ':'
        selectorWords[0] = selectorWords[0].split(':')
        # Map values to id safe attributes
        orig = ''
        for val in selectorWords[0]:
            orig += '[id*="'+str(val)+'"]'
        # Join values to string
        selectorWords[0] = orig
        selector = selectorWords.join(' ')
    counter = 0
    # Switch selector type
    types = {
        "css": "context.browser.find_elements(By.CSS_SELECTOR, selector)",
        "id": "context.browser.find_element(By.ID, selector)",
        "link_text": "context.browser.find_elements(By.LINK_TEXT, selector)",
        "xpath": "context.browser.find_elements(By.XPATH, selector)",
        "name": "context.browser.find_element(By.NAME, selector)",
        "tag_name": "context.browser.find_elements(By.TAG_NAME, selector)",
        "class": "context.browser.find_elements(By.CLASS_NAME, selector)"
    }
    # place selector_type on the top
    selector_type_value = types.pop(selector_type, 'css')
    # new types variables
    types_new = {}
    # add the selector_type value first and then the rest of the values
    types_new[selector_type] = selector_type_value
    types_new.update(types)
    # Loop until maxtries is reached and then exit with exception
    while (time.time() - start_time < max_timeout if max_timeout is not None else True):
        for selec_type in list(types_new.keys()):
            try:
                elements = eval(types_new.get(selec_type, "css"))
                # Check if it returned at least 1 element
                if isinstance(elements, WebElement) or len(elements) > 0:
                    return elements
            except CustomError as err:
                logger.error("Custom Error Exception occured during the selector find, will exit the search.")
                logger.exception(err)
                raise
            except CometaTimeoutException as err:
                logger.error("Timeout Exception occured during the selector find, will exit the search.")
                logger.exception(err)
                # Max retries exceeded, raise error
                raise
            except InvalidSelectorException as err: 
                logger.debug(f"Invalid Selector Exception: Selector Type: {selec_type}, Selector: {selector}.")
            except NoSuchElementException as err:
                logger.debug(f"No Such Element Exception: Selector Type: {selec_type}, Selector: {selector}.")
            except KeyError:
                raise
            except Exception as err:
                # logger.error("Exception occured during the selector find, will continue looking for the element.")
                # logger.exception(err)
                logger.error("Exception raised during the element search. No need to panic, will look with other type of selectors. More details in debug mode.")
                logger.debug(f"Selector: {selector}")
                logger.debug(f"Selector Type: {selec_type}")
                logger.exception(err)
        # give page some time to render the search
        time.sleep(1)
    raise CometaMaxTimeoutReachedException(f"Programmed to find the element in {max_timeout} seconds, max timeout reached.")


def element_has_class(element, classname):
    """
    Returns true if the given element has the given classname
    """
    return str(classname) in element.get_attribute('class').split()

def escapeSingleQuotes(text):
    """
    Safely escapes single quotes
    """
    return str(text).replace("'", "\\'")

def escapeDoubleQuotes(text):
    """
    Safely escapes double quotes
    """
    return str(text).replace('"','\\"')

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
        keys = keys.strip().split('|')
        value = value.strip()
        for key in keys:
            # Set key value pair
            params[key] = value
    return params

def send_step_details(context, text):
    logger.debug('Sending websocket with detailed step ... [%s] ' % text)
    requests.post('http://cometa_socket:3001/feature/%s/stepDetail' % context.feature_id, data={
        "user_id": context.PROXY_USER['user_id'],
        'browser_info': json.dumps(context.browser_info),
        "run_id": os.environ['feature_run'],
        'step_index': context.counters['index'],
        'datetime': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'belongs_to': context.step_data['belongs_to'],
        'info': text
    })

def click_element_by_css(context, selector):
    elem = waitSelector(context, "css", selector)
    for el in elem:
        if el.is_displayed():
            el.click()
            break

def click_element(context, element):
    if element.is_displayed():
        element.click()

def tempFile(source):
    # file ext
    filename = os.path.basename(source).split('/')[-1]
    target = "/tmp/%s" % filename

    # check if file exists
    if os.path.exists(target):
        # try removing the file
        logger.debug(f"{target} file exists, trying to remove it.")
        try:
            os.remove(target)
        except Exception as err:
            logger.error("Unable to remove the file.")
            logger.exception(err)

            # get the timestamp
            ts = time.time()
            logger.debug(f"Setting a different filename: /tmp/{ts}-{filename}")
            target = f"/tmp/{ts}-{filename}"

    logger.info(f"TMP file will be created at {target} for {source}.")

    return target

def decryptFile(source):
        # get target file for the source
        target = tempFile(source)

        logger.debug(f"Decrypting source {source}")

        try:
            result = subprocess.run(["bash", "-c", f"gpg --output {target} --batch --passphrase {COMETA_UPLOAD_ENCRYPTION_PASSPHRASE} -d {source}"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode > 0:
                # get the error
                errOutput = result.stderr.decode('utf-8')
                logger.error(errOutput)
                raise Exception('Failed to decrypt the file, please contact an administrator.')
            return target
        except Exception as err:
            raise Exception(str(err))

def encryptFile(source, target):
        logger.debug(f"Encrypting source {source} to {target}")

        try:
            result = subprocess.run(["bash", "-c", f"gpg --output {target} --batch --yes --passphrase {COMETA_UPLOAD_ENCRYPTION_PASSPHRASE} --symmetric --cipher-algo AES256 {source}"], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if result.returncode > 0:
                # get the error
                errOutput = result.stderr.decode('utf-8')
                logger.error(errOutput)
                raise Exception('Failed to encypt the file, please contact an administrator.')
            return target
        except Exception as err:
            raise Exception(str(err))

def uploadFileTarget(context, source):
    logger.debug(f"Source before processing: {source}")
    files = source.split(";")
    processedFiles = []
    for file in files:
        # throw error in case no downloads is found
        if 'downloads' not in file.lower() and 'uploads' not in file.lower():
            raise CustomError('Unknown file path, please use uploads/ or downloads/ to define where the file is located at.')
        
        logger.debug(f"Getting complete path for {file}")
        filePath = re.sub("(?:D|d)ownloads\/", f"{context.downloadDirectoryOutsideSelenium}/", file)
        filePath = re.sub("(?:U|u)ploads\/", f"{context.uploadDirectoryOutsideSelenium}/", filePath)
        logger.debug(f"Final path for {file}: {filePath}")

        # check if file exists
        if not os.path.exists(filePath):
            raise CustomError(f"{file} does not exist, if this error persists please contact an administrator.")

        if 'downloads' in filePath:
            # get temp file
            target = tempFile(filePath)

            # copy the file to the target
            shutil.copy2(filePath, target)
        elif 'uploads' in filePath:
            # decrypt the file and get the target
            target = decryptFile(filePath)
        
        # append the target to the context for later processing and cleaning
        context.tempfiles.append(target)
        # append to processed files as well
        processedFiles.append(target)
    
    return processedFiles if len(processedFiles) > 1 else processedFiles.pop()

def updateSourceFile(context, source, target):
    logger.debug(f"Source before processing: {source}")
    target = re.sub("(?:D|d)ownloads\/", f"{context.downloadDirectoryOutsideSelenium}/", target)
    target = re.sub("(?:U|u)ploads\/", f"{context.uploadDirectoryOutsideSelenium}/", target)

    if 'downloads' in target:
        # copy the file to the target
        shutil.copy2(source, target)
    elif 'uploads' in target:
        # decrypt the file and get the target
        target = encryptFile(source, target)

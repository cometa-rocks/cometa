from selenium import webdriver

from selenium.webdriver.firefox.options import Options as FirefoxOptions

# for chromium based browsers like Chrome, Edge and Opera
from selenium.webdriver.chromium.options import ChromiumOptions

from selenium.webdriver.common.proxy import Proxy, ProxyType
import time, requests, json, os, datetime, xml.etree.ElementTree as ET, subprocess, traceback, signal, sys, itertools, glob, logging, re, threading

from pprint import pprint, pformat
from pathlib import Path
from slugify import slugify
import hashlib
import os, pickle
from selenium.common.exceptions import InvalidCookieDomainException
import copy
from concurrent.futures import ThreadPoolExecutor
from behave.model_core import Status

sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")
sys.path.append("/opt/code/ee/cometa_itself/steps")

from utility.config_handler import *
from utility.functions import *
from utility.cometa_logger import CometaLogger
from utility.common import *
from utility.encryption import *
from utility.configurations import ConfigurationManager, load_configurations
from modules.ai import AI
from tools.models import Condition
# from tools.kubernetes_service import KubernetesServiceManager

LOGGER_FORMAT = "\33[96m[%(asctime)s.%(msecs)03d][%(feature_id)s][%(current_step)s/%(total_steps)s][%(levelname)s][%(filename)s:%(lineno)d](%(funcName)s) -\33[0m %(message)s"


load_configurations()

from tools.service_manager import ServiceManager

# setup logging
logging.setLoggerClass(CometaLogger)
logger = logging.getLogger("FeatureExecution")
logger.setLevel(BEHAVE_DEBUG_LEVEL)
# create a formatter for the logger
formatter = logging.Formatter(LOGGER_FORMAT, LOGGER_DATE_FORMAT)
# create a stream logger
streamLogger = logging.StreamHandler()
# set the format of streamLogger to formatter
streamLogger.setFormatter(formatter)
# add the stream handle to logger
logger.addHandler(streamLogger)

BROWSERSTACK_USERNAME = ConfigurationManager.get_configuration(
    "COMETA_BROWSERSTACK_USERNAME", ""
)
BROWSERSTACK_PASSWORD = ConfigurationManager.get_configuration(
    "COMETA_BROWSERSTACK_PASSWORD", ""
)
PROXY_ENABLED = ConfigurationManager.get_configuration("COMETA_PROXY_ENABLED", False) == "True"
PROXY = ConfigurationManager.get_configuration("COMETA_PROXY", "")
NO_PROXY = ConfigurationManager.get_configuration("COMETA_NO_PROXY", "")
DOMAIN = ConfigurationManager.get_configuration("COMETA_DOMAIN", "")
S3ENABLED = ConfigurationManager.get_configuration("COMETA_S3_ENABLED", False) == "True"
ENCRYPTION_START = ConfigurationManager.get_configuration("COMETA_ENCRYPTION_START", "")
COMETA_AI_ENABLED =  ConfigurationManager.get_configuration("COMETA_FEATURE_AI_ENABLED", False) == "True"
COMETA_FEATURE_DATABASE_ENABLED =  ConfigurationManager.get_configuration("COMETA_FEATURE_DATABASE_ENABLED", False) == "True"
IS_KUBERNETES_DEPLOYMENT = ConfigurationManager.get_configuration("COMETA_DEPLOYMENT_ENVIRONMENT", "docker") == "kubernetes"
USE_COMETA_BROWSER_IMAGES = ConfigurationManager.get_configuration("USE_COMETA_BROWSER_IMAGES", "True") == "True"

if IS_KUBERNETES_DEPLOYMENT:
    # Since only cometa custom browser images are compatible with the kubernetes environment,
    # So if using kubernetes environment must use the cometa browser images from docker hub
    USE_COMETA_BROWSER_IMAGES = True

logger.debug(f'##################### Deployment environment {ConfigurationManager.get_configuration("COMETA_DEPLOYMENT_ENVIRONMENT", "docker")} ##############################')
# FIXME to take this value from department information.
REDIS_IMAGE_ANALYSYS_QUEUE_NAME = ConfigurationManager.get_configuration(
    "REDIS_IMAGE_ANALYSYS_QUEUE_NAME", "image_analysis"
)  # converting to seconds

DEPARTMENT_DATA_PATH = "/data/department_data"

TEST_LOG_DIRECTORY = "/opt/code/behave_logs"

# Global variable to track if feature was aborted
_feature_aborted = False

# handle SIGTERM when user stops the testcase
def stopExecution(signum, frame, context):
    global _feature_aborted
    logger.warn("SIGTERM Found, will stop the session")
    _feature_aborted = True
    raise Exception("'aborted'")


# check if context has a variable
def error_handling(*_args, **_kwargs):
    def decorator(fn):
        def decorated(*args, **kwargs):
            if (
                "FEATURE_FAILED" not in os.environ
                or os.environ["FEATURE_FAILED"] != "True"
            ):
                try:
                    # logger.debug(f"Decorated function: {fn.__name__} with args: {args} and kwargs: {kwargs}")
                    # if args and isinstance(args[0], object):
                    #     context_obj = args[0]
                    #     # Log all attributes of the Context object
                    #     context_attrs = {attr: getattr(context_obj, attr) for attr in dir(context_obj) if not attr.startswith('_')}
                    #     logger.debug(f"Context object attributes: {context_attrs}")
                        
                    #     # Log more detailed information about complex attributes
                    #     for attr, value in context_attrs.items():
                    #         if hasattr(value, "__dict__"):
                    #             try:
                    #                 attr_dict = value.__dict__
                    #                 logger.debug(f"Details of {attr}: {attr_dict}")
                    #             except:
                    #                 pass
                    #         # For specific attributes you're interested in, add more detailed logging
                    #         # For example, if you want to inspect a specific attribute in detail:
                    #         if attr in ["BEHAVE", "USER"]:
                    #             logger.debug(f"Detailed inspection of {attr}: {repr(value)}")
                        
                    #     # If you want to see properties or other instance data:
                    #     if hasattr(context_obj, "__dict__"):
                    #         logger.debug(f"Context __dict__: {context_obj.__dict__}")
                        
                    result = fn(*args, **kwargs)
                    return result
                except Exception as err:
                    # Check if this is an 'aborted' exception - if so, stop immediately
                    if str(err) == "'aborted'":
                        logger.warn("Feature was aborted, stopping execution immediately")
                        raise err
                    
                    # print the traceback
                    logger.exception(err)
                    logger.debug(
                        "Found an error @%s function, please check the traceback: "
                        % (fn.__name__)
                    )
                    logger.error(f"Error in {fn.__name__}: {str(err)}")
                    traceback.print_exc()
                    
                    # Delete the pod and service in case of any error in the before_all and after_all methods
                    if IS_KUBERNETES_DEPLOYMENT and fn.__name__ in ('before_all','after_all'):
                        # Delete all the services which were started during test
                        ServiceManager().remove_all_service(args[0].container_services)

                    # remove the feature_result if it was created
                    if "feature_result_id" in os.environ:
                        response = requests.delete(f'{get_cometa_backend_url()}/api/feature_results/%s' % os.environ['feature_result_id'],
                            headers={'Host': 'cometa.local'})

                    # let the front user know that the feature has been failed
                    logger.debug("Sending a error websocket....")
                    request = requests.post(f'{get_cometa_socket_url()}/feature/%s/error' % args[0].feature_id, data={
                        "browser_info": json.dumps(args[0].browser_info),
                        "feature_result_id": os.environ['feature_result_id'],
                        "run_id": os.environ['feature_run'],
                        "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
                        "error": str(err),
                        "user_id": args[0].PROXY_USER['user_id']
                    })

                    # let behave know that feature has been failed
                    os.environ["FEATURE_FAILED"] = "True"
                    args[0].failed = True

                    # fail the feature
                    raise AssertionError(str(err))
            else:
                logger.debug(
                    "Feature has already been failed please check the output above.."
                )

        return decorated

    return decorator


def parseVariables(text, variables):
    def decrypted_value(variable_name):
        variable = next(
            (var for var in variables if var["variable_name"] == variable_name), None
        )
        if not variable:
            return False
        if variable["variable_value"].startswith(
            ENCRYPTION_START
        ):  # encrypted variable.
            return "[ENCRYPTED]"  # return False in case we want to show the variable name it self.

        return variable["variable_value"]

    def replaceVariable(match):
        variable_found = match.group()
        variable_name = match.groups()[0]

        return decrypted_value(variable_name) or variable_found

    variable_pattern = r"\$\{?(.+?)(?:\}|\b)"
    return re.sub(variable_pattern, replaceVariable, text)

@error_handling()
def before_all(context):
    context.start_time = time.time()  # Add timing start
    # Create a logger for file handler
    fileHandle = logging.FileHandler(
        f"{TEST_LOG_DIRECTORY}/{os.environ['feature_result_id']}.log"
    )
    fileHandle.setFormatter(formatter)
    logger.addHandler(fileHandle)
    # handle SIGTERM signal
    signal.signal(
        signal.SIGTERM,
        lambda signum, frame, ctx=context: stopExecution(signum, frame, ctx),
    )

    # Initilize connection with AI if COMETA_AI_ENABLED
    # This will also start a new connection with redis
    context.COMETA_AI_ENABLED = COMETA_AI_ENABLED
    if COMETA_AI_ENABLED:
        context.ai = AI(
            REDIS_IMAGE_ANALYSYS_QUEUE_NAME=REDIS_IMAGE_ANALYSYS_QUEUE_NAME,
            logger=logger,
        )

    # get the data from the pickle file
    execution_data_file = os.environ.get("execution_data", None)
    if not execution_data_file:
        raise Exception("No data found ... no details about the feature provided.")

    with open(execution_data_file, "rb") as file:
        execution_data = pickle.load(file)

    # create index counter for steps
    context.counters = {
        "total": 0,
        "ok": 0,
        "nok": 0,
        "index": 0,
        "step_sequence": 0,
        "pixel_diff": 0,
    }  # failed and skipped can be found from the junit summary.
    logger.debug("context.counters set to: {}".format(pformat(context.counters)))
    # set feature file path
    context.filepath = os.environ["FEATURE_FILE"]
    logger.debug("context.filepath set to: {}".format(context.filepath))
    # server where the request is coming from Confidential or not
    X_SERVER = os.environ["X_SERVER"]
    # user who requested the feature execution
    context.PROXY_USER = json.loads(os.environ["PROXY_USER"])
    # proxy used from configuration.json, which is updated by django
    context.PROXY = PROXY
    # department where the feature belongs
    context.department = json.loads(os.environ["department"])
    # environment variables for the testcase
    context.VARIABLES = execution_data["VARIABLES"]
    # logger.debug(context.VARIABLES)
    # job parameters if executed using schedule step
    context.PARAMETERS = os.environ["PARAMETERS"]
    # telegram notification data if executed from telegram
    telegram_env = os.environ.get("telegram_notification", "{}")
    context.telegram_notification = json.loads(telegram_env)
    if telegram_env != "{}":
        logger.info(f"Telegram notification data loaded: {context.telegram_notification}")
    # context.browser_info contains '{"os": "Windows", "device": null, "browser": "edge", "os_version": "10", "real_mobile": false, "browser_version": "84.0.522.49"}'
    context.browser_info = json.loads(os.environ["BROWSER_INFO"])
    # get the connection URL for the browser
    context.network_logging_enabled = os.environ.get("NETWORK_LOGGING") == "Yes"
    # get the connection URL for the browser
    connection_url = os.environ["CONNECTION_URL"]
    context.connection_url = os.environ["CONNECTION_URL"]
    context.websocket_url = None
    context.step_exception = None
    context.playwright_browser = None
    # set loop settings
    context.insideLoop = False  # meaning we are inside a loop
    context.break_loop = False
    context.continue_loop = False
    context.current_loop = None
    context.websocket_screen_shot_details = {}
    context.jumpLoopIndex = (
        0  # meaning how many indexes we need to jump after loop is finished
    )
    context.executedStepsInLoop = 0  # how many steps have been executed inside a loop

    # Get MD5 from browser information - we preserve this piece of code to be able to migrate style images of previous version
    browser_code = "%s-%s" % (
        context.browser_info["browser"],
        context.browser_info["browser_version"],
    )
    context.browser_hash = hashlib.md5(browser_code.encode("utf-8")).hexdigest()[:10]

    # Construct browser key using browser_info object, same constructor as in Front
    context.BROWSER_KEY = getBrowserKey(context.browser_info)

    # load the feature file to data
    data = json.loads(os.environ["FEATURE_DATA"])
    feature_description = data.get("description", "")
    if feature_description:
        feature_description = parseVariables(
            feature_description, json.loads(context.VARIABLES)
        )

    # Prepare folders and paths for screenshots and templates
    # Screenshot images are saved in /<screenshots_dir>/<feature_id>/<feature_run>/<feature_result_id>/<rand_hash>/<step_result_id>/AMVARA_<current|style|difference>.png
    # Templates images are saved in /<screeshots_dir>/templates/<feature_id>/<browser_key>/AMVARA_template_<step_index>.png
    run_id = os.environ["feature_run"]
    # Retrieve run hash
    context.RUN_HASH = os.environ["RUN_HASH"]
    context.FEATURE_RESULT_ID = os.environ["feature_result_id"]
    # Set root folder of screenshots
    context.SCREENSHOTS_ROOT = "/data/screenshots/"
    # Construct screenshots path for saving images
    context.SCREENSHOTS_PATH = context.SCREENSHOTS_ROOT + "%s/%s/%s/%s/" % (
        str(data["feature_id"]),
        str(run_id),
        str(os.environ["feature_result_id"]),
        context.RUN_HASH,
    )
    # Construct templates path for saving or getting styles
    context.TEMPLATES_PATH = context.SCREENSHOTS_ROOT + "templates/%s/%s/" % (
        str(data["feature_id"]),
        context.BROWSER_KEY,
    )
    # Make sure all screenshots and templates folders exists
    Path(context.SCREENSHOTS_PATH).mkdir(parents=True, exist_ok=True)
    Path(context.TEMPLATES_PATH).mkdir(parents=True, exist_ok=True)
    # context.SCREENSHOT_FOLDER='%s/' % time.strftime("%Y%m%d-%H%M%S") # LOOKS LIKE IS NOT USED
    context.SCREENSHOT_PREFIX = "no_prefix_yet_will_be_set_in_steps"

    # HTML Comparing
    # Set and create the folder used to store and compare HTML step snapshots
    context.HTML_PATH = "/data/test/html"
    Path(context.HTML_PATH).mkdir(parents=True, exist_ok=True)

    context.feature_info = data
    logger.debug("Feature Information: {}".format(data))
    # save the feature_id to context
    context.feature_id = str(data["feature_id"])
    # save the continue on failure for feature to the context
    context.feature_continue_on_failure = data.get("continue_on_failure", False)
    
    # FIXME add this timezone information to the context
    # FIXME add context.devices_time_zone
    devices_time_zone = context.browser_info.get("selectedTimeZone", "")

    if not devices_time_zone or devices_time_zone.strip() == "":
        devices_time_zone = "Etc/UTC"
    
    
    payload = {
        "user_id": context.PROXY_USER["user_id"],
        # FIXME do not store the browser information at this stage
        "browser_info": os.environ["BROWSER_INFO"],
        "feature_result_id": os.environ["feature_result_id"],
        "run_id": os.environ["feature_run"],
        "datetime": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    request = requests.get(f'{get_cometa_socket_url()}/feature/%s/initializing' % str(context.feature_id), data=payload)


    context.LAST_STEP_VARIABLE_AND_VALUE = None
    
    # ################# MOBILE DEVICES RELATED SETINGS ################
    # keeps track of mobile devices driver, so that test can be performed in the multiple mobiles devices
    context.mobiles = {}
    # keep the reference of active mobile device
    context.mobile = None
    # Mobile common capabilities to  
    context.mobile_capabilities = {}
    # Keeps track of service/containers started during test, so that if can be kill/stopped after test 
    context.container_services = []
    
    # Keeps track of step type, which types of step was executed 
    # Currently supported values BROWSER, MOBILE and API, DATABASES
    # only browser steps are then which are not defined with the STEP_TYPE to for those step have step type = BROWSER
    context.STEP_TYPE = 'BROWSER'
    # #################################

    
    context.COMETA_FEATURE_DATABASE_ENABLED = COMETA_FEATURE_DATABASE_ENABLED
    
    # ############# DATABASE RELATED SETTINGS ####################
    if COMETA_FEATURE_DATABASE_ENABLED:
        # keeps track of database connections, so that test can be performed in the multiple databases with in the same test
        context.database_connections = {}
        # keep the reference of active mobile device
        context.database_connection = None    
        context.LAST_STEP_DB_QUERY_RESULT = None
        
    # #################################

    context.PREVIOUS_STEP_TYPE = context.STEP_TYPE   
    
    # browser data
    context.cloud = context.browser_info.get(
        "cloud", "browserstack"
    )  # default it back to browserstack incase it is not set.
    
    logger.debug(f"data: {data}")
    context.record_video = data["video"] if "video" in data else False
    logger.debug(f"context.record_video {context.record_video }")
    
    # read the steps from the step json file which is created by django container in the file system
    logger.debug(f"FEATURE_JSON_FILE: {os.environ['FEATURE_JSON_FILE']}")
    with open(os.environ['FEATURE_JSON_FILE'], 'r') as f:
        context.steps = json.load(f)
    logger.debug(f"context.steps: {context.steps}")
        
    logger.debug(f"Total steps found: {len(context.steps)}")

    if len(context.steps) == 0:
        logger.error(f"No steps found in the feature json file: {os.environ['FEATURE_JSON_FILE']}")
        context.config.stop = True  # Tells Behave to stop execution
        return
    
    # update counters total
    context.counters["total"] = len(context.steps)
    os.environ["total_steps"] = str(context.counters["total"])

    # FIXME move this logic to browser creation file and window
    context.service_manager = ServiceManager()
    context.browser_hub_url = "cometa_selenoid"   
    context.USE_COMETA_BROWSER_IMAGES = USE_COMETA_BROWSER_IMAGES
    
    # Initialize Healenium configuration using HealeniumClient
    try:
        from ee.cometa_itself.healenium_client import HealeniumClient
        healenium_manager = HealeniumClient(context)
        healenium_manager.initialize_healenium_config(context)
        context.healenium_manager = healenium_manager
    except ImportError:
        logger.info("Healenium module not available, healing disabled")
        context.healenium_enabled = False
        context.all_healing_events = {}
        context.healenium_manager = None
    
    if USE_COMETA_BROWSER_IMAGES:
        logger.debug(f"Using cometa browsers, Starting browser ")
        logger.debug(f"Browser_info : {context.browser_info}")

        
        browser_container_labels = {
            "feature_id": str(context.feature_info["feature_id"]),
            "feature_result_id": str(os.environ["feature_result_id"]),
            "department_id": str(context.feature_info["department_id"]),
            "environment_id": str(context.feature_info["environment_id"])
        }
        container_configuration = {
            "image_name":context.browser_info["browser"],
            "image_version":context.browser_info["browser_version"],
            "service_type": "Browser",
            "labels": browser_container_labels,
            "devices_time_zone" : devices_time_zone
        }
        
        # service_details = context.service_manager.prepare_browser_service_configuration(
        #     browser=context.browser_info["browser"],
        #     version=context.browser_info["browser_version"],
        #     labels=browser_container_labels,
        #     devices_time_zone = devices_time_zone
        # )
        
        # service_created = context.service_manager.create_service()
        
        response = requests.post(f'{get_cometa_backend_url()}/get_browser_container', headers={'Host': 'cometa.local'},
                             data=json.dumps(container_configuration))
        
        response_data = response.json()
        logger.debug(f"Browser creation response data: {response_data}")
        if response.status_code not in [200, 201]:
            raise Exception(response_data['message'])

        logger.debug(response.json())
        if response_data['success'] == False:
            raise Exception(response_data['message'])    
        
        # service_id = response.json()['containerservice']['hostname']
        data = response.json()['containerservice']
        container_information = {
            'id': data['service_id'],
            'service_url': data['hostname'],
            'service_type': 'Browser',
        }        
        
        # if not IS_KUBERNETES_DEPLOYMENT:
        #     service_details = context.service_manager.get_service_details()

        # Save container details in the browser_info, which then gets saved in the feature results browser 
        context.browser_info["container_service"] = {"Id": container_information["service_url"]}
        context.container_services.append(container_information)
        context.browser_hub_url = container_information['service_url']
        
        # Setup Healenium proxy using HealeniumClient
        if hasattr(context, 'healenium_manager') and context.healenium_manager:
            connection_url = context.healenium_manager.setup_healenium_proxy(context, container_information, USE_COMETA_BROWSER_IMAGES)
        else:
            connection_url = f"http://{context.browser_hub_url}:4444/wd/hub"
        
        status_check_connection_url = f"http://{context.browser_hub_url}:4444/status"
        is_running = context.service_manager.wait_for_selenium_hub_be_up(status_check_connection_url)
        if not is_running:
            return
    
    # Set connection URL for Selenoid if not using COMETA browsers  
    if not USE_COMETA_BROWSER_IMAGES:
        if hasattr(context, 'healenium_manager') and context.healenium_manager:
            connection_url = context.healenium_manager.setup_healenium_proxy(context, {}, USE_COMETA_BROWSER_IMAGES)
        else:
            connection_url = f"http://{context.browser_hub_url}:4444/wd/hub"
        # Initialize data dict for Selenoid path
        data = {}
    
    # video recording on or off
    # create the options based on the browser name
    if context.browser_info["browser"] == "firefox":
        options = FirefoxOptions()
    else:
        options = ChromiumOptions()
        # disable shm since newer chrome version will run out of memory
        # https://github.com/stephen-fox/chrome-docker/issues/8
        # read more about chrome options:
        # https://peter.sh/experiments/chromium-command-line-switches/
        options.add_argument("--disable-dev-shm-usage")

        # Handle local emulated mobile devices
        if context.browser_info.get("mobile_emulation", False):
            mobile_emulation = {
                "deviceMetrics": {
                    "width": int(context.browser_info.get("mobile_width", 360)),
                    "height": int(context.browser_info.get("mobile_height", 640)),
                    "pixelRatio": float(
                        context.browser_info.get("mobile_pixel_ratio", "1.0")
                    ),
                },
                "userAgent": context.browser_info.get("mobile_user_agent", ""),
            }
            options.add_experimental_option("mobileEmulation", mobile_emulation)

    if context.browser_info["browser"] == "opera":
        # Opera does not support Selenium 4 W3C Protocol by default
        # force it by adding a experimental option
        # https://github.com/operasoftware/operachromiumdriver/issues/100#issuecomment-1134141616
        options.add_experimental_option("w3c", True)

    # Configure WC3 Webdriver
    # more options can be found at:
    # https://www.w3.org/TR/webdriver1/#capabilities
    
    browser_name = context.browser_info["browser"]
    
    if browser_name=='edge':
        browser_name='MicrosoftEdge'
    
    options.set_capability("browserName", browser_name)
    options.set_capability("se:timeZone", devices_time_zone)
    
    if not IS_KUBERNETES_DEPLOYMENT:
        options.browser_version = context.browser_info["browser_version"]
    
    options.accept_insecure_certs = True
    # Get the chrome container timezone from browser_info


    context.mobile_capabilities['timezone'] = devices_time_zone
    logger.debug(f"Test is running in the timezone : {devices_time_zone}")
    # selenoid specific capabilities
    # more options can be found at:
    # https://aerokube.com/selenoid/latest/#_special_capabilities
    
    if USE_COMETA_BROWSER_IMAGES:
        cometa_options = {
            "record_video":context.record_video,
            "is_test":True
        }
        options.set_capability("cometa:options", cometa_options)

    else:
        logger.debug(f"Adding selenoid capabilities")
        selenoid_capabilities = {
            "name": data["feature_name"],
            "enableVNC": True,
            "screenResolution": "1920x1080x24",
            "enableVideo": context.record_video,
            "sessionTimeout": "30m",
            "timeZone": devices_time_zone,  # based on the user selected timezone
            "labels": {"by": "COMETA ROCKS"},
            "s3KeyPattern": "$sessionId/$fileType$fileExtension",
            # previously used for s3 which is not currently being used.
        }
        # add cloud/provider capabilities to the
        # browser capabilities
        options.set_capability("selenoid:options", selenoid_capabilities)
        
    options.set_capability(
        "goog:loggingPrefs", {"browser": "ALL", "performance": "ALL"}
    )
    logger.debug(f"options: {options.to_capabilities()}")
        
    if context.browser_info["browser"] == "chrome" and context.network_logging_enabled:
        # If network logging enabled then fetch vulnerability headers info from server
        response =  requests.get(f'{get_cometa_backend_url()}/api/security/vulnerable_headers/', headers={'Host': 'cometa.local'})
        logger.info("vulnerable headers info received")
        context.vulnerability_headers_info = response.json()["results"]
        logger.info("stored in the context")

    options.add_argument('--enable-logging')
    options.add_argument('--log-level=0')
    options.add_argument("--window-size=1920,1060")
    # proxy configuration
    if PROXY_ENABLED and PROXY:
        logger.debug(
            'Proxy is enabled for this feature ... will use "%s" as proxy configuration.'
            % PROXY
        )
        # add proxy configuration to capabilities
        logger.debug("Adding proxy setting to capabilities.")
        options.set_capability(
            "proxy",
            {
                "httpProxy": PROXY,
                "sslProxy": PROXY,
                "noProxy": NO_PROXY,
                "proxyType": "manual",  # case sensitive
                "class": "org.openqa.selenium.Proxy",
                "autodetect": False,
            },
        )
        # Appium does not support proxy settings
        # https://github.com/appium/appium/issues/19316 
        # context.mobile_capabilities['proxy'] = {
        #     'proxyType': "manual",
        #     'httpProxy': "your-proxy-server:port",
        #     'sslProxy': "your-proxy-server:port"
        # }

    # LOCAL only
    # download preferences for chrome
    context.downloadDirectoryOutsideSelenium = r"/data/test/downloads/%s" % str(
        os.environ["feature_result_id"]
    )
    context.uploadDirectoryOutsideSelenium = r"/data/test/uploads/%s" % str(
        context.department["department_id"]
    )
    os.makedirs(context.downloadDirectoryOutsideSelenium, exist_ok=True)

    # save downloadedFiles in context
    context.downloadedFiles = {}
    # save tempfiles in context
    context.tempfiles = [
        execution_data_file,
    ]
    context.network_responses = []
    context.test_conditions_list: list[Condition] = []

    # call update task to create a task with pid.
    task = {
        "action": "start",
        "browser": json.dumps(context.browser_info),
        "feature_id": context.feature_id,
        "pid": str(os.getpid()),
        "feature_result_id": os.environ["feature_result_id"],
    }
    response = requests.post(f'{get_cometa_backend_url()}/updateTask/', headers={'Host': 'cometa.local'},
                             data=json.dumps(task))

    logger.info("\33[92mRunning feature...\33[0m")
    logger.info(
        "\33[94mGetting browser context on \33[92m%s Version: %s\33[0m"
        % (
            str(context.browser_info["browser"]),
            str(context.browser_info["browser_version"]),
        )
    )
    logger.info("Checking environment to run on: {}".format(context.cloud))

    logger.debug("Driver Capabilities: {}".format(options.to_capabilities()))
    logger.info(f"Trying to get a browser context {connection_url}")
    capabilities = options.to_capabilities()
    logger.info("Options Summary (Capabilities):")
    logger.info(capabilities)
    
    if USE_COMETA_BROWSER_IMAGES:
        context.browser = webdriver.Remote(command_executor=connection_url, options=options, keep_alive=True)
    else:
        context.browser = webdriver.Remote(command_executor=connection_url, options=options)
        
    context.connection_url = connection_url
    logger.debug("Session id: %s" % context.browser.session_id)

    # Wait for video recording to start if video is enabled
    if context.record_video and USE_COMETA_BROWSER_IMAGES:
        logger.info("Waiting for video recording to start...")
        video_ready = context.service_manager.wait_for_video_recording_ready(
            context.browser.session_id,
            timeout=15
        )
        if video_ready:
            logger.info("Video recording is ready")
        else:
            logger.warning("Video recording may not have started properly, but continuing with test execution")

    # set headers for the request
    headers = {"Content-type": "application/json", "Host": "cometa.local"}
    # set payload for the request
    # FIXME do not store the session_id at this level
    # FIXME create the context.browser = {}
    # FIXME create the context.browser_info = {}
    data = {
        "feature_result_id": os.environ["feature_result_id"],
        "session_id": context.browser.session_id,
        "description": feature_description,
        "browser": context.browser_info
    }
    # update feature_result with session_id
    requests.patch(f'{get_cometa_backend_url()}/api/feature_results/', json=data, headers=headers)



    # FIXME Need to understand how Live screen will behave when the browser information is not send to socket
    # send a websocket request about that feature has been started
    request = requests.get(f'{get_cometa_socket_url()}/feature/%s/started' % context.feature_id, data={
        "user_id": context.PROXY_USER['user_id'],
        "browser_info": json.dumps(context.browser_info),
        "feature_result_id": os.environ['feature_result_id'],
        "run_id": os.environ['feature_run'],
        "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    })

    logger.info("Processing done ... will continue with the steps.")


# Get video url with context of browser
def get_video_url(context):
    # get the video url from browserstack backend
    bsSessionRequest = requests.get(
        "https://api.browserstack.com/automate/sessions/"
        + str(context.browser.session_id)
        + ".json",
        auth=requests.auth.HTTPBasicAuth(BROWSERSTACK_USERNAME, BROWSERSTACK_PASSWORD),
    )
    return bsSessionRequest.json()["automation_session"].get("video_url", None)


@error_handling()
def after_all(context):
    if os.environ.get("current_step", None) is not None:
        del os.environ["current_step"] 
    if os.environ.get("total_steps", None) is not None:
        del os.environ["total_steps"]
    # check if any alertboxes are open before quiting the browser

    if hasattr(context,"pw"):
         context.pw.stop()

    try:
        while context.browser.switch_to.alert:
            logger.debug("Found an open alert before shutting down the browser...")
            alert = context.browser.switch_to.alert
            alert.dismiss()
    except:
        logger.debug("No alerts found ... before shutting down the browser...")

    try:
        # for some reasons this throws error when running on browserstack with safari
        if context.cloud == "local":
            # delete all generated cookies in previous session
            context.browser.delete_all_cookies()
        # quit the browser since at this point feature has been executed
        context.browser.quit()
        
        if context.cloud == "local" and not context.USE_COMETA_BROWSER_IMAGES:
            url = f"http://cometa_selenoid:4444/sessions/{context.browser.session_id}"
            logger.debug(f"Requesting to delete the {url}")
            response = requests.delete(url)
            logger.debug(response.json())
            logger.debug(response.body)
    except Exception as err:
        logger.debug("Unable to delete cookies or quit the browser. See error below.")
        logger.debug(str(err))
    
    # Clean up Healenium proxy using HealeniumClient
    try:
        if hasattr(context, 'healenium_manager') and context.healenium_manager:
            context.healenium_manager.cleanup_healenium(context)
    except Exception as e:
        logger.debug(f"Error cleaning up Healenium: {e}")
    


    # if IS_KUBERNETES_DEPLOYMENT:
    #     logger.debug(f"Deleting kubernetes browser pod and service")
    #     context.kubernetes_service_manager.delete_pod()
    #     context.kubernetes_service_manager.delete_service()
        
    
    # Close all Mobile sessions
    if hasattr(context, "mobiles"):
        for key, mobile in context.mobiles.items():
            logger.debug(mobile['driver'])
            try:
                mobile['driver'].quit()
                
            except Exception as err:
                logger.error(f"Unable to stop the mobile session, Mobile details : {mobile['driver']}")
                logger.error(str(err))
    # testcase has finished, send websocket about processing data
    request = requests.get(f'{get_cometa_socket_url()}/feature/%s/processing' % context.feature_id, data={
        "user_id": context.PROXY_USER['user_id'],
        "browser_info": json.dumps(context.browser_info),
        "feature_result_id": os.environ['feature_result_id'],
        "run_id": os.environ['feature_run'],
        "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    })
    logger.debug("Removing all services started by test")
    # Delete all the services which were started during test
    ServiceManager().remove_all_service_with_django(context.container_services)
    logger.debug("Removed all services started by test")
    # get the recorded video if in browserstack and record video is set to true
    bsVideoURL = None
    if len(context.steps) == 0:
        raise Exception(f"No steps found in the feature \"{context.feature_info['feature_name']}\"")
    
    if context.record_video:
        if context.cloud == "browserstack":
            # Observed browserstack delay when creating video files
            # Retrying get_video_url every 1 second for max 10 tries
            retries = 1
            while retries < 10:
                bsVideoURL = get_video_url(context)
                if bsVideoURL is None:
                    time.sleep(1)
                    retries += 1
                else:
                    break
        elif context.cloud == "Lyrid.io":
            pass
        else:
            if S3ENABLED:
                S3ENDPOINT = ConfigurationManager.get_configuration(
                    "COMETA_S3_ENDPOINT", False
                )
                S3BUCKETNAME = ConfigurationManager.get_configuration(
                    "COMETA_S3_BUCKETNAME", False
                )
                if S3ENDPOINT and S3BUCKETNAME:
                    bsVideoURL = "%s/%s/%s/video.mp4" % (
                        S3ENDPOINT,
                        S3BUCKETNAME,
                        context.browser.session_id,
                    )
                else:
                    logger.error(
                        "S3 is enabled but COMETA_S3_ENDPOINT and COMETA_S3_BUCKETNAME seems to be empty ... please check."
                    )
            else:
                # video_extension = os.getenv("VIDEO_EXTENSION", "mp4")
                bsVideoURL = f"/videos/{context.browser.session_id}.mp4"
                logger.debug(f"Video path {bsVideoURL}" )
    
    # load feature into data
    data = json.loads(os.environ["FEATURE_DATA"])
    # junit file path for the executed testcase
    files_path = os.environ['FOLDERPATH']
    file_name = os.environ['FEATURE_NAME']
    meta_file_path = os.environ['JSON_FILE']
    feature_file_path = os.environ['FEATURE_FILE']
    feature_json_file_path = os.environ['FEATURE_JSON_FILE']
    xmlFilePath = f"{files_path}/junit_reports/TESTS-features.{file_name}.xml"

    logger.debug("Adding path to temp files for housekeeping")
    context.tempfiles.append(meta_file_path)
    context.tempfiles.append(feature_file_path)
    context.tempfiles.append(feature_json_file_path)
    context.tempfiles.append(xmlFilePath)
    # xmlFilePath = junit_reports/TESTS-features.%s_%s.xml' % (
    #     slugify(data['department_name']), slugify(data['app_name']), data['environment_name'], context.feature_id,
    #     slugify(data['feature_name']))

    logger.debug("xmlFilePath: %s" % xmlFilePath)
    # load the file using XML parser
    xmlFile = ET.parse(xmlFilePath).getroot()
    # get the testcase tag from the root which is testsuite
    testcase = xmlFile.find("./testcase")
    # data to update the feature_result
    resultSuccess = context.counters["nok"] == 0
    # get downloaded files
    downloadedFiles = context.downloadedFiles.values()
    # combine all the downloaded files
    downloadedFiles = list(itertools.chain.from_iterable(downloadedFiles))
    data = {
        "feature_result_id": os.environ["feature_result_id"],
        "success": resultSuccess,
        "status": "Success" if resultSuccess else "Failed",
        "ok": context.counters["ok"],
        "total": context.counters["total"],
        "fails": context.counters["nok"],
        "skipped": context.counters["total"]
        - (context.counters["ok"] + context.counters["nok"]),
        "pixel_diff": context.counters["pixel_diff"],
        "screen_style": "",
        "screen_actual": "",
        "screen_diff": "",
        "execution_time": int(float(xmlFile.attrib["time"]) * 1000),
        "log": "<log_goes_here>",
        "video_url": bsVideoURL,
        "files": downloadedFiles,
        "running": False,
    }
    
    # Initialize stderr variable
    stderr = None
    failure_message = ""
    
    # check if testcase was aborted by the user if so set the status to Canceled
    if isinstance(testcase.find("./failure"), ET.Element):
        # save the failed output
        stderr = testcase.find("./failure").text
        failure_message = testcase.find("./failure").attrib.get("message", "")
        
        # Check if the error message contains 'aborted'
        is_aborted = (failure_message == "'aborted'" or 
                    (stderr and "'aborted'" in stderr) or
                    (failure_message and "'aborted'" in failure_message))
        
        if is_aborted:
            data["status"] = "Canceled"
            data["success"] = False
    else:
        # Check if we should set as Canceled based on global variable
        global _feature_aborted
        if _feature_aborted:
            data["status"] = "Canceled"
            data["success"] = False

    # get the system output from the xmlfile
    stdout = testcase.find("./system-out").text

    # log content
    log_content = ""

    # append stderr to the log content if exists
    if stderr:
        log_content += """Test case failed, here is the error output:
--------------------------------------------------------------------------------
%s
""" % stderr.replace(
            "\n\n", "\n"
        )

    log_content += """System output:
--------------------------------------------------------------------------------
%s
""" % stdout.replace(
        "\n\n", "\n"
    )
    
    # Add healing summary using HealeniumClient
    try:
        if hasattr(context, 'healenium_manager') and context.healenium_manager:
            log_content += context.healenium_manager.generate_healing_summary(context)
    except Exception as e:
        logger.debug(f"Error generating healing summary: {e}")

    # save xml file as log for the user
    data["log"] = log_content
    # set the headers for the request
    headers = {"Content-type": "application/json", "Host": "cometa.local"}
    
    # Log the final data being sent to backend
    logger.debug(f"Final feature result data: {data}")
    logger.debug(f"Status being sent to backend: {data.get('status', 'Unknown')}")
    
    # send the patch request
    response = requests.patch(f'{get_cometa_backend_url()}/api/feature_results/', json=data, headers=headers)
    logger.debug(f"Backend response status: {response.status_code}")
    if response.status_code != 200:
        logger.error(f"Backend response error: {response.text}")

    logger.debug("\33[92m" + "FeatureResult ran successfully!" + "\33[0m")

    # get the final result for the feature_result
    request_info = requests.get(f"{get_cometa_backend_url()}/api/feature_results/%s" % os.environ['feature_result_id'],
                                headers=headers)
    
    # Log the feature result info being sent to WebSocket
    if request_info.status_code == 200:
        feature_result_info = request_info.json()
        logger.debug(f"Feature result info from backend: {feature_result_info}")
        logger.debug(f"Status in feature result info: {feature_result_info.get('status', 'Unknown')}")
    else:
        logger.error(f"Failed to get feature result info: {request_info.status_code} - {request_info.text}")
        feature_result_info = {}
    
    requests.post(f'{get_cometa_socket_url()}/feature/%s/finished' % context.feature_id, data={
        "user_id": context.PROXY_USER['user_id'],
        "browser_info": json.dumps(context.browser_info),
        "feature_result_id": os.environ['feature_result_id'],
        "run_id": os.environ['feature_run'],
        "feature_result_info": json.dumps(request_info.json()['result']),
        "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    })

    if hasattr(context, "network_responses") and context.network_logging_enabled:
        network_response_count = 0
        vulnerable_response_count = 0
        logger.debug(
            "Get count of total network responses and count of vulnerability_headers_count"
        )
        # logger.debug(context.network_responses)
        for response in context.network_responses:
            # network_response_count counts total network responses received
            network_response_count += len(response["responses_and_vulnerable_header"])
            # vulnerable_response_count counts those network responses which contains vulnerability headers
            vulnerable_response_count += response["vulnerability_headers_count"]

        logger.debug(f"Total Network responses {network_response_count}")
        logger.debug(f"Vulnerable Count {vulnerable_response_count}")

        logger.info("Sending vulnerability_headers")
        # request to save vulnerable network headers
        response = requests.post(f"{get_cometa_backend_url()}/api/security/network_headers/", headers=headers,
                                 data=json.dumps({
                                     "result_id": os.environ['feature_result_id'],
                                     "responses": context.network_responses,
                                     "vulnerable_response_count": vulnerable_response_count,
                                     "network_response_count": network_response_count
                                 }))

        if response.status_code == 201:
            logger.debug("Vulnerability Headers Saved ")
        else:
            # logger.debug(f"Error while saving Vulnerability Headers : {json.dumps(response.json())}")
            logger.debug(f"Error while saving Vulnerability Headers : {response}")
    
    import threading       
    # Store context data for thread access
    telegram_notification_data = getattr(context, 'telegram_notification', {})
    download_dir = context.downloadDirectoryOutsideSelenium
    temp_files = context.tempfiles
    
    def clean_up_and_notification():
        
        
        notifications_url = f'{get_cometa_backend_url()}/send_notifications/?feature_result_id={os.environ["feature_result_id"]}'
        headers = {'Host': 'cometa.local'}
        logger.debug(f"Sending notification request on URL : {notifications_url}")
        
        # If this was a telegram execution, pass the telegram notification data
        if telegram_notification_data and telegram_notification_data.get('telegram_chat_id'):
            headers['X-Telegram-Notification'] = json.dumps(telegram_notification_data)
            logger.info(f"Including telegram notification data for chat_id: {telegram_notification_data.get('telegram_chat_id')}")
        
        response = requests.get(notifications_url, headers=headers)
        
  
        
        if response.status_code == 200:
            response_data = response.json()
            if response_data.get('success', False):
                logger.info("Notification sent successfully")
            else:
                logger.warning(f"Notification failed: {response_data.get('message', 'Unknown error')}")
        else:
            logger.error(f"Notification request failed with status {response.status_code}: {response.text}")
    
        # remove download folder if no files where downloaded during the testcase
        downloadedFiles = glob.glob(download_dir + "/*")
        if len(downloadedFiles) == 0:
            if os.path.exists(download_dir):
                os.rmdir(download_dir)

        # do some cleanup and remove all the temp files generated during the feature
        logger.debug("Cleaning temp files: {}".format(pformat(temp_files)))
        for tempfile in set(temp_files):
            try:
                os.remove(tempfile)
            except Exception as err:
                logger.error(
                    f"Something went wrong while trying to delete temp file: {tempfile}"
                )
                logger.exception(err)

    
    # Create a thread to run the clean_up_and_mail function
    notification_and_cleanup_thread = threading.Thread(target=clean_up_and_notification)
    notification_and_cleanup_thread.daemon = True
    notification_and_cleanup_thread.start() 
    
    # call update task to delete a task with pid.
    task = {
        "action": "delete",
        "browser": json.dumps(context.browser_info),
        "feature_result_id": os.environ["feature_result_id"],
        "feature_id": context.feature_id,
        "pid": str(os.getpid()),
    }
    response = requests.post(f'{get_cometa_backend_url()}/updateTask/', headers={'Host': 'cometa.local'},
                            data=json.dumps(task))

    total_time = (time.time() - context.start_time) * 1000  # Convert to milliseconds    
    logger.debug(f"Step execution took {total_time:.2f}ms to execute")
    
    # Wait for cleanup thread to complete before exiting
    notification_and_cleanup_thread.join()

@error_handling()
def before_step(context, step):
    logger.debug(f"Starting Step : ################################ {step.name} ################################")
    
    # Check if feature was aborted before executing step
    global _feature_aborted
    if _feature_aborted:
        raise Exception("'aborted'")
    
    context.CURRENT_STEP = step
    context.CURRENT_STEP_STATUS = "Failed"
    context.STEP_TYPE = 'BROWSER'
    context.LAST_STEP_DB_QUERY_RESULT = None
    context.LAST_STEP_VARIABLE_AND_VALUE = None
    context.step_exception = None
    
    # Prepare step for healing using HealeniumClient
    try:
        if hasattr(context, 'healenium_manager') and context.healenium_manager:
            context.healenium_manager.prepare_step_for_healing(context)
        else:
            # Fallback for when manager is not available
            if hasattr(context, 'healing_data'):
                context.healing_data = None
    except Exception as e:
        logger.debug(f"Error preparing step for healing: {e}")
        if hasattr(context, 'healing_data'):
            context.healing_data = None
    
    # this variable will be used to have executed step count,
    # this is also used to save screenshot in async manner
    context.counters['step_sequence'] += 1

    os.environ["current_step"] = str(context.counters["index"] + 1)
    # complete step name to let front know about the step that will be executed next
    step_name = "%s %s" % (step.keyword, step.name)
    logger.info(f"-> {step_name}")
    
    # Store step info for healing collector
    context.step_index = context.counters["index"]
    context.step_name = step_name
    # step index -
    index = context.counters["index"]
    # pass all the data about the step to the step_data in context, step_data has name, screenshot, compare, enabled and type
    logger.debug(f"Current Step {index}")
    logger.debug(f"Steps length {len(context.steps)}")
    context.step_data = context.steps[index]  # putting this steps in step_data
    logger.debug(f"Step Details: {context.step_data}")

    # in video show as a message which step is being executed
    # only works in local video and not in browserstack

    # send websocket to front to let front know about the step
    # FIXME Understand why browser_info needs to be send here
    requests.post(f'{get_cometa_socket_url()}/feature/%s/stepBegin' % context.feature_id, data={
        "user_id": context.PROXY_USER["user_id"],
        "feature_result_id": os.environ["feature_result_id"],
        "browser_info": json.dumps(context.browser_info),
        "run_id": os.environ["feature_run"],
        "step_name": step_name,
        "step_index": index,
        "datetime": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "belongs_to": context.step_data["belongs_to"],
    })
    
   

def find_vulnerable_headers(context, step_index) -> int:
    try:
        responses_and_vulnerable_header = []
        performance_logs = context.browser.get_log("performance")
        logger.debug(f"Performance logs received Count is : {len(performance_logs)}")

        # filter vulnerable_headers from a single response header list and return
        def filter_vulnerability_headers(headers: dict) -> list:
            # List of header if they found to be vulnerable
            vulnerable_header_names = []
            # vulnerability_headers_info were added to context in before_all method
            for vulnerable_header_info in context.vulnerability_headers_info:
                header_name = vulnerable_header_info["header_name"].lower()
                # Check if header added in the DB exists in response header
                if header_name in headers.keys():
                    vulnerable_header_names.append({header_name: headers[header_name]})

            return vulnerable_header_names

        # performance_logs is list of network requests and responses url and header information
        logger.debug(f"Response header analysis Started for current Step")
        vulnerability_headers_count = 0
        for logs in performance_logs:
            # message.message is string json covert so parse json
            information = json.loads(logs["message"])["message"]
            # Check if log type is Response received to get response headers later time
            if information["method"] == "Network.responseReceived":
                # logger.debug(f"Processing network response")
                # Get response details from the network response object
                response = information["params"]["response"]
                # check and filter for vur vulnerability_headers
                # logger.debug(f"Processing respose headers ")
                vulnerable_headers = filter_vulnerability_headers(response["headers"])
                # check if request has some vulnerable_headers then add that to responses_and_vulnerable_header
                # logger.debug(f"Found vulnerable headers ")
                if len(vulnerable_headers) > 0:
                    vulnerability_headers_count += 1
                # Store all network responses
                responses_and_vulnerable_header.append(
                    {
                        "response": response,
                        "vulnerable_headers": vulnerable_headers,
                    }
                )

        # Check if context contains vulnerability_headers list yes then append to that list
        logger.debug(
            f"Response header analysis completed for current Step {step_index}"
        )
        if hasattr(context, "network_responses"):
            context.network_responses.append(
                {
                    "step_id": step_index,
                    "responses_and_vulnerable_header": responses_and_vulnerable_header,
                    "vulnerability_headers_count": vulnerability_headers_count,
                }
            )
        else:
            # if it does not have attribute vulnerability_headers then initilze list add vulnerability headers
            context.network_responses = [
                {
                    "step_id": step_index,
                    "responses_and_vulnerable_header": responses_and_vulnerable_header,
                    "vulnerability_headers_count": vulnerability_headers_count,
                }
            ]
        # Return number of vernability headers
        logger.debug(f"Return header info : {len(context.network_responses)}")
        return vulnerability_headers_count
    except Exception as e:
        logger.exception(e)


@error_handling()
def after_step(context, step):
    # Save p
    context.PREVIOUS_STEP_TYPE = context.STEP_TYPE
    logger.debug(f"context.PREVIOUS_STEP_TYPE : {context.PREVIOUS_STEP_TYPE}")
    # Capture the exception if it exists and print it
    if step.exception:
        logger.exception("", exc_info=step.exception, stack_info=True)
    # complete step name to let front know about the step that has been executed
    step_name = "%s %s" % (step.keyword, step.name)
    # step index
    index = context.counters["index"]
    # step result this contains the execution time, success and name
    step_result = context.step_result if hasattr(context, "step_result") else None
    # create screenshots dictionary to dinamically assign available images
    # screenshots = {}
    # # check current image of running browser
    # if hasattr(context, "DB_CURRENT_SCREENSHOT"):
    #     screenshots["current"] = context.DB_CURRENT_SCREENSHOT
    # # check if template file is assigned
    # if hasattr(context, "DB_STYLE_SCREENSHOT"):
    #     screenshots["template"] = context.DB_STYLE_SCREENSHOT
    # # check if difference file is assigned
    # if hasattr(context, "DIFF_IMAGE"):
    #     screenshots["difference"] = context.DB_DIFFERENCE_SCREENSHOT
    vulnerable_headers_count = 0
    try:
        if context.network_logging_enabled:
            # vulnerable_headers_count = find_vulnerable_headers(context=context)
            vulnerable_headers_count = find_vulnerable_headers(
                context=context, step_index=index
            )
    except Exception as e:
        logger.exception(e)
    # get step error
    step_error = None
    if (
        "custom_error" in context.step_data
        and context.step_data["custom_error"] is not None
    ):
        step_error = context.step_data["custom_error"]
    elif hasattr(context, "step_error"):
        step_error = context.step_error
        logger.debug(f"Step error: {step_error}")
    # send websocket to front to let front know about the step

    logger.debug("Running Mobiles")
    hostnames = [{'hostname':mobile['container_service_details']["Id"], 'name': mobile_name} for mobile_name, mobile in context.mobiles.items()]
    logger.debug(hostnames)
    
    # FIXME understand why do we need to send the browser_info with this step
    logger.debug(f"Sending websocket to front to let front know about the step {step_name} Status: [{context.CURRENT_STEP_STATUS}]")

    # Process healing data using HealeniumClient
    healing_data = None
    try:
        if hasattr(context, 'healenium_manager') and context.healenium_manager:
            healing_data = context.healenium_manager.process_healing_after_step(
                context, index, step_name, context.browser.session_id
            )
    except Exception as e:
        logger.debug(f"Error processing healing data: {e}")
    # Create payload for the request
    payload = {
        "user_id": context.PROXY_USER["user_id"],
        "feature_result_id": os.environ["feature_result_id"],
        "browser_info": json.dumps(context.browser_info),
        "run_id": os.environ["feature_run"], 
        "step_name": step_name,
        "step_index": index,
        "datetime": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
        "step_result_info": step_result,
        "step_time": step.duration,
        "error": step_error,
        "status": context.CURRENT_STEP_STATUS,
        "belongs_to": context.step_data["belongs_to"],
        "screenshots": json.dumps(context.websocket_screen_shot_details),  # load screenshots object
        "vulnerable_headers_count": vulnerable_headers_count,
        "step_type": context.STEP_TYPE,
        "mobiles_info": hostnames,
        "healing_data": healing_data
    }
    
    # Log healing data if present
    if healing_data:
        logger.info(f"WebSocket payload includes healing data for step {index}: {healing_data}")
    else:
        logger.debug(f"No healing data for step {index}")
    
    # Execute the request asynchronously
    with ThreadPoolExecutor() as executor:
        executor.submit(
            requests.post,
            f'{get_cometa_socket_url()}/feature/%s/stepFinished' % context.feature_id,
            json=payload
        )
    
    logger.debug(f"Sent websocket to front to let front know about the step {step_name}")
    # update countes
    if context.jumpLoopIndex == 0:
        context.counters["index"] += 1
    else:
        context.counters["index"] += context.jumpLoopIndex + 1
        # update total value
        context.counters["total"] += context.executedStepsInLoop
    # if step was executed successfully update the OK counter
    if step_error is None:
        context.counters["ok"] += 1
    else:
        context.counters["nok"] += 1

    # Clear healing data after step processing to prevent cross-contamination
    if hasattr(context, 'healing_data'):
        context.healing_data = None
    
    # Cleanup variables
    keys = [
        "DB_CURRENT_SCREENSHOT",
        "DB_STYLE_SCREENSHOT",
        "DB_DIFFERENCE_SCREENSHOT",
        "COMPARE_IMAGE",
        "STYLE_IMAGE_COPY_TO_SHOW",
        "DIFF_IMAGE",
        "STYLE_IMAGE",
    ]
    for key in keys:
        if hasattr(context, key):
            delattr(context, key)

    logger.debug(f"Step Over : ################################ {step.name} ################################")
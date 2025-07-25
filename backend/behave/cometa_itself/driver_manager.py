import os
import json
import time
import logging
import requests
import hashlib
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.firefox.options import Options as FirefoxOptions
from selenium.webdriver.chromium.options import ChromiumOptions
from utility.configurations import ConfigurationManager
from tools.service_manager import ServiceManager
from utility.config_handler import *

logger = logging.getLogger("FeatureExecution")

class BrowserDriverManager:

    # Initialize the browser driver manager
    # @param context: context object
    # @param browser_info: browser info object
    def __init__(self, context, browser_info):
            
        if context.USE_COMETA_BROWSER_IMAGES:
            logger.debug(f"Using cometa browsers, Starting browser ")
            logger.debug(f"Browser_info : {browser_info}")
            
            browser_container_labels = {
                "feature_id": str(context.feature_info["feature_id"]),
                "feature_result_id": str(os.environ["feature_result_id"]),
                "department_id": str(context.feature_info["department_id"]),
                "environment_id": str(context.feature_info["environment_id"])
            }
            container_configuration = {
                "image_name":browser_info["browser"],
                "image_version":browser_info["browser_version"],
                "service_type": "Browser",
                "labels": browser_container_labels,
                "devices_time_zone" : browser_info["selectedTimeZone"]
            }
            
            context.browser_info = browser_info

            response = requests.post(f'{get_cometa_backend_url()}/get_browser_container', headers={'Host': 'cometa.local'},
                                data=json.dumps(container_configuration))
            
            if response.status_code not in [200, 201]:
                raise Exception("Error while starting browser, Please contact administrator")    

            if not response or not response.json()['success'] == True:
                raise Exception("Error while starting browser, Please contact administrator")    
            
            data = response.json()['containerservice']
            container_information = {
                'id': data['service_id'],
                'service_url': data['hostname'],
                'service_type': 'Browser',
            }        
            
            # Save container details in the browser_info, which then gets saved in the feature results browser 
            context.browser_info["container_service"] = {"Id": container_information["service_url"]}
            context.container_services.append(container_information)
            context.browser_hub_url = container_information['service_url']
            context.connection_url = f"http://{context.browser_hub_url}:4444/wd/hub"
            status_check_connection_url = f"http://{context.browser_hub_url}:4444/status"
            is_running = context.service_manager.wait_for_selenium_hub_be_up(status_check_connection_url)
            if not is_running:
                return

    # Connect to the browser, create the browser object and update the feature_result with the session_id
    # @param context: context object
    def connect_browser(context):

        PROXY_ENABLED = ConfigurationManager.get_configuration("COMETA_PROXY_ENABLED", False) == "True"
        PROXY = ConfigurationManager.get_configuration("COMETA_PROXY", "")
        NO_PROXY = ConfigurationManager.get_configuration("COMETA_NO_PROXY", "")

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
        options.set_capability("se:timeZone", context.devices_time_zone)
        
        if not context.USE_COMETA_BROWSER_IMAGES:
            options.browser_version = context.browser_info["browser_version"]
        
        options.accept_insecure_certs = True
        # Get the chrome container timezone from browser_info


        context.mobile_capabilities['timezone'] = context.devices_time_zone
        logger.debug(f"Test is running in the timezone : {context.devices_time_zone}")
        # selenoid specific capabilities
        # more options can be found at:
        # https://aerokube.com/selenoid/latest/#_special_capabilities
        
        if context.USE_COMETA_BROWSER_IMAGES:
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
                "timeZone": context.devices_time_zone,  # based on the user selected timezone
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
            context.execution_data_file,
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
        logger.info(f"Trying to get a browser context {context.connection_url}")
        capabilities = options.to_capabilities()
        logger.info("Options Summary (Capabilities):")
        logger.info(capabilities)
        
        if context.USE_COMETA_BROWSER_IMAGES:
            context.browser = webdriver.Remote(command_executor=context.connection_url, options=options, keep_alive=True)
        else:
            context.browser = webdriver.Remote(command_executor=context.connection_url, options=options)
            
        logger.debug("Session id: %s" % context.browser.session_id)  

        # set payload for the request
        # FIXME do not store the session_id at this level
        # FIXME create the context.browser = {}
        # FIXME create the context.browser_info = {}
        data = {
            "feature_result_id": os.environ["feature_result_id"],
            "session_id": context.browser.session_id,
            "browser": context.browser_info
        }
        # update feature_result with session_id
        requests.patch(f'{get_cometa_backend_url()}/api/feature_results/', json=data, headers={"Host": "cometa.local"})



    @staticmethod
    def stop_browser(context):
        if getattr(context, 'browser', None):
            try:
                context.browser.quit()
            except Exception as err:
                logger = logging.getLogger("FeatureExecution")
                logger.debug("Unable to quit the browser. See error below.")
                logger.debug(str(err))
            context.browser = None

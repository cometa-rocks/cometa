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


sys.path.append("/opt/code/behave_django")
sys.path.append("/code/behave/cometa_itself/steps")

from utility.functions import *
from tools.exceptions import *
from tools.common import send_step_details
from tools.common_functions import *
from tools.service_manager import ServiceManager


# setup logging
logger = logging.getLogger("FeatureExecution")


def upload_file_to_appium_container(context, container_service_details_Id, file_path):
    file_full_path = uploadFileTarget(context, file_path)
    logger.debug(f"files to upload {file_full_path}")
    service_manager = ServiceManager()
    if type(file_full_path) == list:
        file_full_path = file_full_path[0]

    logger.debug("Uploading file")
    send_step_details(context, "Uploading file")
    file_name = service_manager.upload_file(
        service_name_or_id=container_service_details_Id,
        file_path=file_full_path,
        decryptFile=False,
    )
    if not file_name:
        raise CustomError(f"Can not upload the file {file_full_path}")
    return file_name

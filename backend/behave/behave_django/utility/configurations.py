# Behave Configuration Manager

import os.path
import traceback, requests
import sys, time
from .encryption import decrypt, update_ENCRYPTION_PASSPHRASE, update_ENCRYPTION_START, update_COMETA_UPLOAD_ENCRYPTION_PASSPHRASE
import json
from .common import get_logger
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import datetime

logger = get_logger()

from .config_handler import *

COMETA_DJANGO_URL = get_cometa_backend_url()


COMETA_CONFIGURATIONS = {}

# This ConfigurationManager is for BEHAVE
# This class is responsible for managing configurations (i.e. values with in variable default_cometa_configurations)
class ConfigurationManager:
    # __COMETA_CONFIGURATIONS = {}

    def __init__(self) -> None:
        pass

    def load_configurations(self):
        # logger.info("loading configuration")
        while True:
            try:
                django_url = f"{COMETA_DJANGO_URL}/api/configuration/"
                logger.info(f"Fetching configurations from : {django_url}, timeout: 3 seconds")
                response = requests.get(
                    django_url,
                    headers={"Content-Type": "application/json"},
                    timeout=3  # Timeout in seconds
                )
                response.raise_for_status()  # Raise an error for bad status codes (4xx, 5xx)
                
                if response.status_code != 200:
                    logger.error("Response from backend server is not 200")
                    logger.error(response.body)
                    raise Exception("Could not fetch configuration from django, Please make sure django is running and accessible from behave")

                configurations = response.json()["results"]
                for configuration in configurations:
                    COMETA_CONFIGURATIONS[configuration["configuration_name"]] = {
                        "configuration_value": configuration["configuration_value"],
                        "encrypted": configuration["encrypted"],
                    }
                break  
            except requests.exceptions.ConnectionError as exception:
                logger.info(f"Configuration not loaded, Will wait 5 seconds for {COMETA_DJANGO_URL} to come alive and then retry")
                time.sleep(5)

    @classmethod
    def get_configuration(cls, key: str, default=""):
        configuration_value = COMETA_CONFIGURATIONS.get(key, None)
        if configuration_value == None:
            return default
        # If variable is encrypted then decrypt it and then return
        if configuration_value.get("encrypted", False):
            return decrypt(configuration_value["configuration_value"])
        else:
            return configuration_value["configuration_value"]


def load_configurations():
    logger.debug("Loading configurations")
    if len(sys.argv) > 1:
        configuration_loaded = False
        
        while not configuration_loaded:
            
            try:
                            
                logger.debug("Start loading configurations from backend server")
                # Load secret_variables as a module
                conf = ConfigurationManager()
                conf.load_configurations()

                # update variables in encryption module
                # this is being done here because we need decrypt function from encryption module
                # Configuration can not be imported in the encryption.py due to circular import
                # logger.debug("Loading ENCRYPTION_PASSPHRASE and ENCRYPTION_START variables")
                update_ENCRYPTION_PASSPHRASE(
                    ConfigurationManager.get_configuration("COMETA_ENCRYPTION_PASSPHRASE", "").encode()
                )
                update_ENCRYPTION_START(
                    ConfigurationManager.get_configuration("COMETA_ENCRYPTION_START", "")
                )
                update_COMETA_UPLOAD_ENCRYPTION_PASSPHRASE(
                    ConfigurationManager.get_configuration("COMETA_UPLOAD_ENCRYPTION_PASSPHRASE", "")
                )
                configuration_loaded = True
                logger.debug("Configuration loaded successfully")
            except:
                logger.error("Error in loading configurations, will retry in 5 seconds")
                traceback.print_exc()
                time.sleep(5)

# this file name and path should be same as src configuration FILE_NAME and CONFIGURATION_UPDATE_WATCHED_DIRECTORY
FILE_NAME = "config_tracker.txt"
CONFIGURATION_UPDATE_WATCHED_DIRECTORY = "/code/config"

CONFIGURATION_UPDATE_WATCHED_FILE = os.path.join(CONFIGURATION_UPDATE_WATCHED_DIRECTORY, FILE_NAME)

def update_config_tracker():
    with open(CONFIGURATION_UPDATE_WATCHED_FILE, "w") as f:
        time = datetime.datetime.utcnow().isoformat()
        logger.debug(f"Updating configuration tracker at {time}")
        f.write(time)

class FileChangeHandler(FileSystemEventHandler):
    def on_modified(self, event):
        logger.info(f"Change detected in {event.src_path}")
        if event.src_path.endswith(FILE_NAME):
            logger.debug(f"Change detected in {CONFIGURATION_UPDATE_WATCHED_FILE}, loading configurations")
            load_configurations()


def setup_config_file_watcher():
    observer = Observer()
    event_handler = FileChangeHandler()
    observer.schedule(event_handler, path=CONFIGURATION_UPDATE_WATCHED_DIRECTORY, recursive=False)
    observer.start()
    logger.info(f"Configuration update watcher started, used file{CONFIGURATION_UPDATE_WATCHED_FILE}")
    return observer

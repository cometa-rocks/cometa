import os.path
import traceback, requests
import sys
from .encryption import decrypt, update_ENCRYPTION_PASSPHRASE, update_ENCRYPTION_START
import json
from .common import get_logger

logger = get_logger()


COMETA_DJANGO_URL = "http://django:8000"


# This ConfigurationManager is for BEHAVE
# This class is responsible for managing configurations (i.e. values with in variable default_cometa_configurations)
class ConfigurationManager:
    __COMETA_CONFIGURATIONS = {}

    def __init__(self) -> None:
        pass

    def load_configurations(self):
        response = requests.get(
            f"{COMETA_DJANGO_URL}/api/configuration/",
            headers={"Content-Type": "application/json"},
        )
        if response.status_code != 200:
            raise Exception(
                "Could not fetch configuration from django, Please make sure django is running and accessible from behave"
            )

        configurations = response.json()["results"]
        for configuration in configurations:
            self.__COMETA_CONFIGURATIONS[configuration["configuration_name"]] = {
                "configuration_value": configuration["configuration_value"],
                "encrypted": configuration["encrypted"],
            }

    @classmethod
    def get_configuration(cls, key: str, default=""):
        configuration_value = cls.__COMETA_CONFIGURATIONS.get(key, None)
        if configuration_value == None:
            return default
        # If variable is encrypted then decrypt it and then return
        if configuration_value.get("encrypted", False):
            return decrypt(configuration_value["configuration_value"])
        else:
            return configuration_value["configuration_value"]


def load_configurations():

    if len(sys.argv) > 1:
        # Load secret_variables as a module
        conf = ConfigurationManager()
        conf.load_configurations()

        # update variables in encryption module
        # this is being done here because we need decrypt function from encryption module
        # Configuration can not be imported in the encryption.py due to circular import
        # logger.debug("Loading ENCRYPTION_PASSPHRASE and ENCRYPTION_START variables")
        update_ENCRYPTION_PASSPHRASE(
            ConfigurationManager.get_configuration("COMETA_ENCRYPTION_PASSPHRASE", "")
        )
        update_ENCRYPTION_START(
            ConfigurationManager.get_configuration("COMETA_ENCRYPTION_START", "")
        )

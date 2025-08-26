# author : Anand Kushwaha
# version : 10.0.0
# date : 2024-08-17

from psycopg2 import sql
import psycopg2
import importlib
import logging
import logging.handlers
import os.path
import datetime
import traceback
import sys
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from backend.utility.encryption import (
    decrypt,
    update_ENCRYPTION_START,
    update_ENCRYPTION_PASSPHRASE,
)
from backend.common import LOGGER_FORMAT, LOGGER_DATE_FORMAT
import secrets
import base64
from psycopg2.errors import ForeignKeyViolation
from django.core.management.utils import get_random_secret_key
from backend.utility.functions import detect_deployment_environment
from django.utils import timezone

# setup logging
logger = logging.getLogger(__name__)
logger.setLevel(10)
# create a formatter for the logger
formatter = logging.Formatter(LOGGER_FORMAT, LOGGER_DATE_FORMAT)
# create a stream logger
streamLogger = logging.StreamHandler()
# set the format of streamLogger to formatter
streamLogger.setFormatter(formatter)
# add the stream handle to logger
logger.addHandler(streamLogger)


default_cometa_configurations = {
    "COMETA_STRIPE_CHARGE_AUTOMATICALLY": False,
    "COMETA_BROWSERSTACK_PASSWORD": "",
    "COMETA_SENTRY_BEHAVE": "",
    "COMETA_DOMAIN": "",
    "COMETA_ENCRYPTION_START": "U2FsdGVkX1",
    "COMETA_BROWSERSTACK_USERNAME": "",
    "COMETA_STRIPE_TEST_KEY": "",
    "COMETA_DEBUG": True,
    "COMETA_FEEDBACK_MAIL": "cometa@amvara.de",
    "COMETA_SENTRY_DJANGO": "",
    "COMETA_STRIPE_LIVE_KEY": "",
    "COMETA_PROD_ENABLE_PAYMENT": False,
    "COMETA_ENCRYPTION_PASSPHRASE": "$RANDOM_ENCRYPTION_PASSPHRASE",
    "COMETA_UPLOAD_ENCRYPTION_PASSPHRASE": "$RANDOM_UPLOAD_ENCRYPTION_PASSPHRASE",
    "COMETA_STRIPE_TEST_WEBHOOK_SECRET": "",
    "COMETA_STAGE_ENABLE_PAYMENT": False,
    "COMETA_DJANGO_SECRETKEY": "$RANDOM_DJANGO_SECRETKEY",
    "COMETA_BEHAVE_SECRETKEY": "$RANDOM_BEHAVE_SECRETKEY",
    "COMETA_STRIPE_LIVE_WEBHOOK_SECRET": "",
    "COMETA_SCREENSHOT_PREFIX": "AMVARA_",
    "COMETA_EMAIL_ENABLED": False,
    "COMETA_EMAIL_HOST": "",
    "COMETA_EMAIL_PORT": "",
    "COMETA_EMAIL_TLS": False,
    "COMETA_EMAIL_USER": "",
    "COMETA_EMAIL_PASSWORD": "",
    "COMETA_EMAIL_FROM_DEFAULT": "no-reply@cometa.rocks",
    "COMETA_PROXY_ENABLED": False,
    "COMETA_NO_PROXY": "",
    "COMETA_PROXY": "",
    "COMETA_S3_ENABLED": False,
    "COMETA_S3_ENDPOINT": "",
    "COMETA_S3_BUCKETNAME": "",
    "REDIS_HOST": "cometa.redis.ai",
    "REDIS_PORT": 6379,
    "REDIS_DB": 0,
    "REDIS_DB_TSL_SSL_ENABLED": False,
    "REDIS_CA_CERTIFICATE_FILE": "/share/certs/ca-cert.pem",
    "COMETA_DEPLOYMENT_ENVIRONMENT": detect_deployment_environment(), # it can be 'docker' or 'kubernetes'
    "COMETA_MOBILE_TOTAL_EMULATOR_VERSIONS": 3, 
    "COMETA_KUBERNETES_NAMESPACE": "cometa", 
    "COMETA_KUBERNETES_DATA_PVC": "cometa-data-volume-claim", 
    "COMETA_FEATURE_AI_ENABLED": False, 
    "COMETA_FEATURE_DATABASE_ENABLED": False, 
    "COMETA_FEATURE_MOBILE_TEST_ENABLED": False,
    "COMETA_TELEGRAM_BOT_TOKEN": "",
    "COMETA_TELEGRAM_ENABLED": False,
    "COMETA_TELEGRAM_WEBHOOK_SECRET": "",
    "COMETA_TELEGRAM_OAUTH_MODE": "standard",  # 'standard' or 'state_parameter'
    # Add host hostAliases to test environments 
    # For https://redmine.amvara.de/projects/ibis/wiki/Add_DNS_mapping_to_hosts_(etchosts)_file_using_Cometa_configuration
    "COMETA_TEST_ENV_HOST_FILE_MAPPINGS": "[]",
    "CONTAINER_ENVS": "{}", # this is used to set environment variables in the containers, i.e proxy settings
    "USE_COMETA_BROWSER_IMAGES": True,
    "COMETA_BROWSER_MEMORY": "2",
    "COMETA_BROWSER_CPU": "2",
    # Set the maximum number of standby browsers, this is used too many number of the browser keep running in the background
    "COMETA_TEST_CONTAINER_MAXIMUM_STANDBY": 2,
    # This is used to limit the number of browsers running in the background
    # Set the maximum number of browsers running in the background, set the maximum number that deployment server can handle
    "COMETA_TEST_CONTAINER_MAXIMUM_RUNNING": 10, 
    # having password hardcoded does not create a security issue, because this communication is internal
    # this can be always changed to a more secure password
    "COMETA_BROWSER_VNC_PASSWORD":"secret",
    "COMETA_OPENAI_API_KEY": "",
    "OLLAMA_AI_TLS_SSL_ENABLED":"False",
    "OLLAMA_AI_HOST":"ollama.ai",
    "OLLAMA_AI_PORT":"8002",
    "OLLAMA_AI_SECRET_ID":"",
    "OLLAMA_AI_SECRET_KEY":"",
    "COMETA_BROWSER_MAX_VERSIONS": 3
}

public_configuraion_values = [
    "COMETA_FEATURE_AI_ENABLED", 
    "COMETA_FEATURE_DATABASE_ENABLED", 
    "COMETA_FEATURE_MOBILE_TEST_ENABLED",
    "COMETA_DEPLOYMENT_ENVIRONMENT"
]


def generate_passphrase_and_secrets():

    global default_cometa_configurations
    # Generate a random encryption passphrase
    # default_cometa_configurations["COMETA_ENCRYPTION_PASSPHRASE"] = base64.b64encode(secrets.token_bytes(46)).decode('utf-8')
    default_cometa_configurations["COMETA_ENCRYPTION_PASSPHRASE"] = (
        get_random_secret_key()
    )

    # Generate a random upload encryption passphrase
    default_cometa_configurations["COMETA_UPLOAD_ENCRYPTION_PASSPHRASE"] = (
        base64.b64encode(secrets.token_bytes(46)).decode("utf-8")
    )

    # Generate a random secret key for Django
    # default_cometa_configurations["COMETA_DJANGO_SECRETKEY"] = base64.b64encode(secrets.token_bytes(31)).decode('utf-8')
    default_cometa_configurations["COMETA_DJANGO_SECRETKEY"] = get_random_secret_key()

    # Generate a random secret key for Behave
    # default_cometa_configurations["COMETA_BEHAVE_SECRETKEY"] = base64.b64encode(secrets.token_bytes(31)).decode('utf-8')
    default_cometa_configurations["COMETA_BEHAVE_SECRETKEY"] = get_random_secret_key()


# Function to load a Python file as a module
def load_module_from_file(module_name, file_path):
    spec = importlib.util.spec_from_file_location(module_name, file_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


secret_variables = None


COMETA_CONFIGURATIONS = {}


# This class is responsible for managing configurations (i.e. values with in variable default_cometa_configurations)
class ConfigurationManager:
    __db_connection = None
    # __COMETA_CONFIGURATIONS = COMETA_CONFIGURATIONS
    __sql_cursor = None

    def __init__(self) -> None:
        pass

    # Creates db connection
    def create_db_connection(self):
        # PostgreSQL connection parameters
        conn_params = {
            "dbname": "postgres",
            "user": "postgres",
            "password": os.getenv("DATABASE_PASSWORD",""),
            "host": os.getenv("DATABASE_SERVER","db"),
            "port": 5432,            
        }
        # Connect to the PostgreSQL database
        self.__db_connection = psycopg2.connect(**conn_params)
        self.__sql_cursor = self.__db_connection.cursor()

    def close_db_connection(self):
        self.__sql_cursor.close()
        self.__db_connection.close()

    def __is_configuration_loaded(self) -> bool:
        # Define the SQL query
        query = """
            SELECT EXISTS (
                SELECT 1 FROM configuration_configuration
                WHERE configuration_name = 'LOADED_FROM_SECRET_FILE'
            )
        """
        # Execute the query
        self.__sql_cursor.execute(query)

        # Fetch the result
        return self.__sql_cursor.fetchone()[0]

    def is_migration_done(self) -> bool:
        # Define the SQL query to check if the table exists
        table_name = "configuration_configuration"
        schema_name = "public"
        check_table_query = f"""
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables 
                WHERE table_schema = '{schema_name}' 
                AND table_name = '{table_name}'
            )
        """

        # Execute the query to check if the table exists
        self.__sql_cursor.execute(check_table_query)
        return self.__sql_cursor.fetchone()[0]

    # Only runs for the first time for old cometa installation, those installation in which configuration were stored in the secret_variables.py
    def load_configuration_from_secret_file_to_db(self):
        if self.__is_configuration_loaded():
            # logger.info("Configurations are present in the database")
            return

        logger.info("Configurations are not present in the database, initiating configuration values")
        # This method generates new passphrase_and_secrets for new cometa_configurations
        generate_passphrase_and_secrets()

        if secret_variables:
            logger.info("updating default configuration from secret_variables.py")
            for configuration_name in dir(secret_variables):
                if not configuration_name.startswith("__"):
                    default_cometa_configurations[configuration_name] = getattr(
                        secret_variables, configuration_name
                    )

        # Iterate over the attributes of the module and generate SQL insert statements
        can_be_deleted = False
        can_be_edited = False
        encrypted = False
        for (
            configuration_name,
            configuration_value,
        ) in default_cometa_configurations.items():
            # Filter out built-in attributes
            configuration_type = "backend"
            
            if configuration_name in public_configuraion_values:
                configuration_type = "all"

            query = f"""
                SELECT EXISTS (
                    SELECT 1 FROM configuration_configuration
                    WHERE configuration_name = '{configuration_name}'
                )
            """
            # Execute the query
            self.__sql_cursor.execute(query)

            # If configuration already exists in the database then continue with other configuration
            if self.__sql_cursor.fetchone()[0]:
                continue

            default_value = ""

            # Define the values to be inserted
            created_on = timezone.now()
            updated_on = timezone.now()

            default_value = ""
            created_by = 1
            updated_by = 1

            string_query = f"INSERT INTO configuration_configuration (configuration_name, configuration_value, default_value, configuration_type, encrypted, can_be_deleted, can_be_edited, created_on, updated_on) VALUES ('{configuration_name}', '{configuration_value}', '{default_value}', '{configuration_type}', {encrypted}, {can_be_deleted}, {can_be_edited}, '{created_on}', '{updated_on}');"
            # Generate the SQL query
            query = sql.SQL(string_query)
            # Execute the query
            self.__sql_cursor.execute(query)
            self.__db_connection.commit()

            # Define the values to be inserted
        created_on = timezone.now()
        updated_on = timezone.now()
        string_query = f"INSERT INTO configuration_configuration (configuration_name, configuration_value, configuration_type, default_value, encrypted, can_be_deleted, can_be_edited, created_on, updated_on) VALUES ('LOADED_FROM_SECRET_FILE', 'True','backend', '',  {encrypted}, {can_be_deleted}, {can_be_edited}, '{created_on}', '{updated_on}');"
        # Generate the SQL query
        query = sql.SQL(string_query)
        # Execute the query
        self.__sql_cursor.execute(query)
        self.__db_connection.commit()

    # Load configuration from db to memory which is later used in the entire cometa_backend
    def load_configuration_from_db(self):
        logger.info("Loading configurations from the database to memory")
        
        # Define the SQL query to load all configurations
        query = """
            SELECT configuration_name, configuration_value, default_value, encrypted
            FROM configuration_configuration
        """

        # Execute the query
        self.__sql_cursor.execute(query)

        # Fetch all results
        results = self.__sql_cursor.fetchall()

        # Store the results in the dictionary
        for (
            configuration_name,
            configuration_value,
            default_value,
            encrypted,
        ) in results:
            COMETA_CONFIGURATIONS[configuration_name] = {
                "configuration_value": configuration_value,
                "default_value": default_value,
                "encrypted": encrypted,
            }

        # Print the configurations (optional)
        # for key, value in self.__COMETA_CONFIGURATIONS.items():
        #     print(f'{key}: {value}')
        # pass

    def load_default_configurations(self):
        logger.warn("Using default configuration values to do migrations")

        for (
            configuration_name,
            configuration_value,
        ) in default_cometa_configurations.items():
            COMETA_CONFIGURATIONS[configuration_name] = {
                "configuration_value": configuration_value,
                "default_value": configuration_value,
                "encrypted": False,
            }

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

    @classmethod
    def update_configuration(cls, key: str, value):
        COMETA_CONFIGURATIONS[key] = value


def load_configurations():

    if len(sys.argv) > 1:
     
        
     
        # Load secret_variables as a module
        conf = ConfigurationManager()
        conf.create_db_connection()
        load_configuration_from_db = False

        if conf.is_migration_done():
            # logger.info("Initial DB Migration is done")
            try:
                conf.load_configuration_from_secret_file_to_db()
                load_configuration_from_db = True

            except ForeignKeyViolation:
                raise Exception("Load default data first and then start the server")

            except Exception as exception:
                traceback.print_exc()
                raise Exception(
                    "Exception while loading configuration from secret_variable.py file to Database ",
                    exception,
                )

        else:
            logger.warn(
                'DB Migration is not done yet please run "python manage.py makemigrations" and "python manage.py migrate"'
            )

        if load_configuration_from_db:
            conf.load_configuration_from_db()
        else:
            conf.load_default_configurations()

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

        conf.close_db_connection()

# this file name and path should be same as behave configuration FILE_NAME and CONFIGURATION_UPDATE_WATCHED_DIRECTORY
FILE_NAME = "config_tracker.txt"
CONFIGURATION_UPDATE_WATCHED_DIRECTORY = "/code/config"

CONFIGURATION_UPDATE_WATCHED_FILE = os.path.join(CONFIGURATION_UPDATE_WATCHED_DIRECTORY, FILE_NAME)

def update_config_tracker():
    with open(CONFIGURATION_UPDATE_WATCHED_FILE, "w") as f:
        time = timezone.now().isoformat()
        logger.debug(f"Updating configuration tracker at {time}")
        f.write(time)

class FileChangeHandler(FileSystemEventHandler):
    def on_modified(self, event):
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

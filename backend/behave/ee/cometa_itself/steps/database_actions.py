import base64
import time
import logging
import json
import sys
import sys, requests, re, json

import jq

from behave import step, use_step_matcher

sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")

from utility.functions import *

from tools.exceptions import *
from tools.common import send_step_details
from tools.common_functions import *
from .utils.database_sql_client import SQLDatabaseClient
from .utils.database_mongodb_client import MongoDBClient


# setup logging
logger = logging.getLogger("FeatureExecution")

def database_feature_cannot_be_used_error(context):
     if not context.COMETA_FEATURE_DATABASE_ENABLED:
        raise CustomError(
            "Database testing features cannot be used because this Cometa subscription. Please contact your administrator to enable Database features."
        )


def check_if_step_call_is_valid(context,database_type):
    if not context.database_connection:
        raise CustomError("No database connection found. Please connect to a database first.")

    if context.database_connection.database_type != database_type:
        raise CustomError(f"This step is only valid for {database_type}, Please switch to the correct database connection.")
        

use_step_matcher("parse")


# This step connects to an SQL database using the provided connection string and stores the connection in the specified variable.
# Parameters:
# - connection_string: The connection string used to connect to the SQL database.
# - variable: The name of the variable in which to store the database connection.
# Example:
# - Connect to SQL database using "Server=myServerAddress;Database=myDataBase;User Id=myUsername;Password=myPassword;" and store connection in "myDatabaseConnection"
@step(u'Connect to SQL database using "{connection_string}" and store connection in "{variable}"')
@done(u'Connect to SQL database using "{connection_string}" and store connection in "{variable}"')
def connect_to_sql_database(context, connection_string, variable):
    context.STEP_TYPE = "DATABASE"
   
    database_feature_cannot_be_used_error(context)
        
    connection = SQLDatabaseClient(context, connection_string, variable)  # Database auto-selected
    context.database_connections[variable] = connection
    context.database_connection = connection
    send_step_details(context, "Connected to database")
    logger.info("Connected to database")
    
    
# - (?P<variable>.*?): Captures the name of the variable where the list of objects will be stored.
# - (?: with "(?P<options>.*?)")?: This part is optional.
# Example:
# - Get list of visible objects in the current screen and store in "myObjects"
# - Get list of visible objects in the current screen and store in "myObjects" with "visible_only"
# The first usage stores the visible objects without any specific options, while the second one applies the "visible_only" option.
@step(u'Execute SQL query "{query}" and store result in "{variable}"')
@done(u'Execute SQL query "{query}" and store result in "{variable}"')
def execute_sql_query_get_answer_in_json(context, query, variable):
    context.STEP_TYPE = "DATABASE"
    database_feature_cannot_be_used_error(context)
    check_if_step_call_is_valid(context,"SQL")
    
    result = context.database_connection.execute_query(context,query)
    addTestRuntimeVariable(context, variable, result)
    context.LAST_DB_QUERY_RESULT = result
    



# This step connects to an SQL database using the provided connection string and stores the connection in the specified variable.
# Parameters:
# - connection_string: The connection string used to connect to the SQL database.
# - variable: The name of the variable in which to store the database connection.
# Example:
# - Connect to SQL database using "Server=myServerAddress;Database=myDataBase;User Id=myUsername;Password=myPassword;" and store connection in "myDatabaseConnection"
@step(u'Connect to NoSQL database using "{connection_string}" and store connection in "{variable}"')
@done(u'Connect to NoSQL database using "{connection_string}" and store connection in "{variable}"')
def connect_to_sql_database(context, connection_string, variable):
    context.STEP_TYPE = "DATABASE"
   
    database_feature_cannot_be_used_error(context)
        
    connection = MongoDBClient(context, connection_string, variable)  # Database auto-selected
    context.database_connections[variable] = connection
    context.database_connection = connection
    send_step_details(context, "Connected to database")
    logger.info("Connected to database")
    
    
# - (?P<variable>.*?): Captures the name of the variable where the list of objects will be stored.
# - (?: with "(?P<options>.*?)")?: This part is optional.
# Example:
# - Get list of visible objects in the current screen and store in "myObjects"
# - Get list of visible objects in the current screen and store in "myObjects" with "visible_only"
# The first usage stores the visible objects without any specific options, while the second one applies the "visible_only" option.
@step(u'Execute the NoSQL query {query} on the {collection} collection and store the result in {variable}')
@done(u'Execute the NoSQL query {query} on the {collection} collection and store the result in {variable}')
def execute_nosql_query_get_answer_in_json(context, query, variable):
    context.STEP_TYPE = "DATABASE"
    database_feature_cannot_be_used_error(context)
    check_if_step_call_is_valid(context, "NOSQL")
    
    result = context.database_connection.execute_query(context, query)
    addTestRuntimeVariable(context, variable, result)
    context.LAST_DB_QUERY_RESULT = result


@step('Switch current database to "{variable}"')
@done('Switch current database to "{variable}"')
def switch_mobile(context, variable):
    context.STEP_TYPE = "DATABASE"
    send_step_details(context, f"Changing current database to {variable}")
    context.database_connection = context.database_connections[variable]
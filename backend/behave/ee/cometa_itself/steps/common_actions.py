import base64
import time
import logging
import json
import sys
import sys, requests, re, json

import pandas as pd
import os
import jq

from behave import step, use_step_matcher

sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")

from utility.functions import *

from tools.exceptions import *
from tools.common import send_step_details, uploadFileTarget
from tools.common_functions import *


# setup logging
logger = logging.getLogger("FeatureExecution")





# This step displays the value of a variable_name at runtime and in the browser screen as well for a given seconds amount of time.
# The popup will disappear after the specified number of seconds.
# Example: Show me variable "user_details" value for "10" seconds
@step(u'Show me variable "{variable}" value for "{seconds}" seconds')
@done(u'Show me variable "{variable}" value for "{seconds}" seconds')
def show_variable_value(context, variable, seconds):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    # Assuming getVariable is a function that retrieves the variable value
    variable_value = getVariable(context, variable) 
    send_step_details(context, f"{variable} : {variable_value}")    
    # Define the variable type (implement the logic as needed)
    variable_type = type(variable_value).__name__  # You can replace this with your own logic
    if variable_type!='str':
        variable_value = json.dumps(variable_value)  # Convert the value to JSON format
    try:
        if context.browser: 
        # Use old-style string formatting (%s) with escaped % symbols for the JavaScript code
            script = """
            // Function to invoke the div and display JSON content
            function invokeDiv() {
                // Create a container element (div)
                const container = document.createElement('div');
                container.style.position = 'fixed';
                container.style.top = '28%%';  // Place it at the top of the viewport
                container.style.marginLeft = '24%%';
                container.style.width = '50%%';
                container.style.minHeight = '200px';
                container.style.border = '10px solid';
                container.style.borderRadius = '6px';
                container.style.padding = '1%%';
                container.style.fontFamily = 'system-ui';
                container.style.color = 'black';
                container.style.background = 'rgb(240, 240, 240)';  // A light gray background for visibility
                container.style.zIndex = '1000';  // High z-index to make it visible at top

                // Create an inner div to hold the JSON content
                const contentDiv = document.createElement('div');
                contentDiv.style.padding = '20px';
                contentDiv.style.width = '100%%';  // Make sure the inner div takes up the full width of its container

                // Populate the content div with JSON data (in a simple format)
                const jsonContent = `
                    <h2>Cometa Runtime Variable</h2>
                    <p><b>Variable Name:</b> %s</p>
                    <p><b>Variable Value:</b> %s</p>
                    <p><b>Variable Type:</b> %s</p>
                `;

                contentDiv.innerHTML = jsonContent;

                // Add the content div to the container
                container.appendChild(contentDiv);

                // Append the container to the body of the document
                document.body.appendChild(container);

                // After disappearTime seconds, remove the container from the DOM
                setTimeout(() => {
                    container.remove();
                }, %s * 1000 + 500);  // Multiply by 1000 to convert seconds to milliseconds
            }

            // Invoke the function
            invokeDiv();
        """ % (variable, variable_value, variable_type, seconds)

            context.browser.execute_script(script)
    except Exception as e:
        logger.exception("Exception while showing value in browser", e)
        
        
    time.sleep(int(seconds))



        

# Reads data from an Excel file for a given sheet and row number, 
# then stores the row's data as a dictionary in a runtime variable.  
@step(u'Read data from Excel file "{file_path}" sheet "{sheet_name}" row "{row_number}" and store in "{variable_name}"')
@done(u'Read data from Excel file "{file_path}" sheet "{sheet_name}" row "{row_number}" and store in "{variable_name}"')
def read_excel_step(context, file_path, sheet_name, row_number, variable_name):

    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE

    # Convert row number to an integer
    row_number = int(row_number)

    try:
            
        excelFilePath = uploadFileTarget(context, file_path)
        logger.debug("Excel file opening: %s", excelFilePath)
        # Read the Excel sheet
        df = pd.read_excel(excelFilePath, sheet_name=sheet_name, engine='openpyxl')

        # Ensure the row exists
        if row_number >= len(df):
            raise CustomError(f"Row number {row_number} is out of range. Max rows: {len(df)}")

        # Fetch the row as a dictionary (column_name -> value)
        row_data = df.iloc[row_number].to_dict()
        logger.debug(row_data)
        # Convert to JSON
        json_data = json.dumps(row_data, ensure_ascii=False)
        logger.debug(json_data)
        # Store the JSON data in runtime variables
        addTestRuntimeVariable(context, variable_name, json_data)
        
        logger.debug(f"Stored data from Excel row {row_number} into variable '{variable_name}': {row_data}")

    except Exception as err:
        logger.error("Error reading Excel file", err)
        raise CustomError(f"Error reading Excel file: {err}")


# Reads data from an Excel file for a given sheet and row number,
# then stores the row's data as individual runtime variables.
@step(u'Read data from Excel file "{file_path}" sheet "{sheet_name}" row "{row_number}" and store in runtime variables')
@done(u'Read data from Excel file "{file_path}" sheet "{sheet_name}" row "{row_number}" and store in runtime variables')
def read_excel_step(context, file_path, sheet_name, row_number):

    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE

    # Convert row number to an integer
    row_number = int(row_number)

    try:
        excelFilePath = uploadFileTarget(context, file_path)
        logger.debug(f"Opening Excel file: {excelFilePath}")

        # Read the Excel sheet
        df = pd.read_excel(excelFilePath, sheet_name=sheet_name, engine='openpyxl')

        # Ensure the row exists
        if row_number >= len(df):
            raise CustomError(f"Row number {row_number} is out of range. Max rows: {len(df)}")

        # Fetch the row as a dictionary (column_name -> value)
        row_data = df.iloc[row_number].to_dict()
        logger.debug(f"Row data: {row_data}")

        # Variables to exclude from overriding
        excluded_variables = {"feature_id", "feature_name"}

        # Store each key-value pair in runtime variables except excluded ones
        for key, value in row_data.items():
            if key not in excluded_variables:  # Skip overriding feature_id and feature_name
                addTestRuntimeVariable(context, key, str(value))  # Convert value to string
                logger.debug(f"Stored {key}: {value}")
            else:
                logger.debug(f"Skipping variable: {key}, to prevent overriding.")

    except Exception as err:
        logger.error("Error reading Excel file", exc_info=True)
        raise CustomError(f"Error reading Excel file: {err}")




use_step_matcher("re")


# Assert api request and response data using JQ patterns. Please refer JQ documentation https://jqlang.github.io/jq/manual/
# jq_pattern is a JSON path that can also be combined with conditions to perform assertions,
@step(u'Fetch value using \"(?P<jq_pattern>.*?)\" from "(?P<variable_name>.+?)" and store in "(?P<new_variable_name>.+?)"')
@done(u'Fetch value using "{jq_pattern}" from "{variable_name}" and store in "{new_variable_name}"')
def assert_imp(context, jq_pattern, variable_name, new_variable_name):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE

    variable_value = getVariable(context, variable_name) 
    logger.debug(variable_value)
    
    # Check if the value is a string and attempt JSON loading
    if isinstance(variable_value, str):
        try:
            variable_value = json.loads(variable_value)
        except json.JSONDecodeError as e:
            raise CustomError(f"Failed to parse JSON: {e}")

    try:
        parsed_value = jq.compile(jq_pattern).input(variable_value).text()
        addTestRuntimeVariable(context, new_variable_name, parsed_value)
    except Exception as err:
        logger.error("Invalid JQ pattern", err)
        raise CustomError(err)

use_step_matcher("parse")
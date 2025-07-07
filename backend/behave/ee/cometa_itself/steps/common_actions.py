import base64
import time
import logging
import json
import sys
import sys, requests, re, json, rstr
import sys, requests, re, json, traceback, html

import pandas as pd
import os
import jq
from faker import Faker

from behave import step, use_step_matcher

sys.path.append("/opt/code/behave_django")
sys.path.append("/opt/code/cometa_itself/steps")

from utility.functions import *

from tools.exceptions import *
from tools.common import send_step_details, uploadFileTarget
from tools.common_functions import *


# setup logging
logger = logging.getLogger("FeatureExecution")

use_step_matcher("parse")


# This step displays the value of a variable_name at runtime and in the browser screen as well for a given seconds amount of time.
# The popup will disappear after the specified number of seconds.
# Example: Show me variable "user_details" value for "10" seconds
@step(u'Show me variable "{variable}" value for "{seconds}" seconds')
@done(u'Show me variable "{variable}" value for "{seconds}" seconds')
def show_variable_value(context, variable, seconds):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE
    # Assuming getVariable is a function that retrieves the variable value
    variable_value = None
    try:
        variable_value = getVariable(context, variable)
    except Exception as e:
        raise CustomError(f"variable '{variable}' not found")
    
    send_step_details(context, f"{variable} : {variable_value}")    
    # Define the variable type (implement the logic as needed)
    variable_type = type(variable_value).__name__  # You can replace this with your own logic
    if variable_type!='str':
        variable_value = json.dumps(variable_value)  # Convert the value to JSON format
      
    # Escape special characters in the variable value for JavaScript
    variable_name_safe = html.escape(variable)
    variable_value_safe = html.escape(variable_value.replace("`","\`"))  # JSON string-escapes special characters
    variable_type_safe = html.escape(variable_type)
    
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
                const jsonContent = `<h2>Cometa Runtime Variable</h2>
                    <p><b>Variable Name:</b> %s </p>
                    <p><b>Variable Value:</b> %s </p>
                    <p><b>Variable Type:</b> %s </p>
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
        """ % (variable_name_safe, variable_value_safe, variable_type_safe, seconds)
        context.browser.execute_script(script)
    except Exception as e:
        logger.error("Exception while showing value in browser", e)
        traceback.print_exc()
        
        
    time.sleep(int(seconds))



# Save string value to environment variable, environment variable value has a maximum value of 255 characters
# Example: Save "123456" to environment variable "user_id"
@step(u'Save "{value}" to environment variable "{variable_name}"')
@done(u'Save "{value}" to environment variable "{variable_name}"')
def step_impl(context, value, variable_name):
    send_step_details(context, 'Saving value to environment variable')
    # add variable
    addVariable(context, variable_name, value, save_to_step_report=True)


# Save string value to environment variable, environment variable value has a maximum value of 255 characters
# Example: Save "123456" to environment variable "user_id"
@step(u'Save "{value}" to runtime variable "{variable_name}"')
@done(u'Save "{value}" to runtime variable "{variable_name}"')
def step_impl(context, value, variable_name):
    logger.debug("Saving value to runtime variable")
    send_step_details(context, 'Saving value to runtime variable')
    # add variable
    addTestRuntimeVariable(context, variable_name, value, save_to_step_report=True)


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
        # logger.debug(row_data)
        # # Convert to JSON
        # json_data = json.dumps(row_data, ensure_ascii=False)
        # logger.debug(json_data)
        # Store the JSON data in runtime variables
        addTestRuntimeVariable(context, variable_name, row_data, save_to_step_report=True)
        
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
                addTestRuntimeVariable(context, key, str(value), save_to_step_report=True)  # Convert value to string
            else:
                logger.debug(f"Skipping variable: {key}, to prevent overriding.")

    except Exception as err:
        logger.error("Error reading Excel file", exc_info=True)
        raise CustomError(f"Error reading Excel file: {err}")

@step(u'Read all rows from Excel file "{file_path}" sheet "{sheet_name}" and store in "{variable_name}"')
@done(u'Read all rows from Excel file "{file_path}" sheet "{sheet_name}" and store in "{variable_name}"')
def read_all_excel_rows_step(context, file_path, sheet_name, variable_name):

    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE

    try:
        # Resolve the uploaded Excel file path
        excelFilePath = uploadFileTarget(context, file_path)
        logger.debug(f"Opening Excel file: {excelFilePath}")

        # Load the Excel sheet into a DataFrame
        df = pd.read_excel(excelFilePath, sheet_name=sheet_name, engine='openpyxl')

        if df.empty:
            raise CustomError(f"The Excel sheet '{sheet_name}' is empty.")

        # Convert DataFrame to a list of row dictionaries (list[dict])
        rows_as_dict_list = df.to_dict(orient="records")
        
        logger.debug(f"Storing sheet data in variable '{variable_name}': total rows {len(rows_as_dict_list)}")

        # Store in runtime variable
        addTestRuntimeVariable(context, variable_name, rows_as_dict_list, save_to_step_report=True)

    except Exception as err:
        logger.error("Error reading Excel file", exc_info=True)
        raise CustomError(f"Error reading Excel file: {err}")




@step(u'Read data from Excel file "{file_path}" sheet "{sheet_name}" considering header row "{header_row_number}" value row "{value_row_number}" and store in runtime variables')
@done(u'Read data from Excel file "{file_path}" sheet "{sheet_name}" considering header row "{header_row_number}" value row "{value_row_number}" and store in runtime variables')
def read_excel_row_to_environment(context, file_path, sheet_name, header_row_number=None, value_row_number=None):
    try:
        send_step_details(context, f"Checking excel file path")    
        excelFilePath = uploadFileTarget(context, file_path)
        
        logger.debug("Checking sheets in the excel")
        xls = pd.ExcelFile(excelFilePath)
        # Validate the sheet name
        if sheet_name not in xls.sheet_names:
            raise CustomError(f"Sheet name '{sheet_name}' not found in the Excel file. Available sheets: {xls.sheet_names}")

        logger.debug(f"Reading excel sheet {sheet_name}")
        # Read the specified sheet from the Excel file
        send_step_details(context, f"Reading row")    
        df = pd.read_excel(excelFilePath, sheet_name=sheet_name)
        
        # If specific row indices are provided, set header and select data row
        if header_row_number is not None and value_row_number is not None:
            # Ensure the row indices are within the DataFrame's range
            table_rows = len(df)+1
            header_row_number = int(header_row_number)
            value_row_number = int(value_row_number)
            
            if not 0 < header_row_number <= table_rows:
                raise CustomError(f"Invalid header row index {header_row_number}, available rows are between 1 to {table_rows}")
            
            if not 0 < value_row_number <= table_rows:
                raise CustomError(f"Invalid header row index {value_row_number}, available rows are between 1 to {table_rows}")    
            
            if header_row_number >= value_row_number:
                raise CustomError(f"header_row_number should be less then the value_row_number")    

        header_row_number = header_row_number - 2
        value_row_number = value_row_number - 2
        if header_row_number >= 0:
            # Set the header using the specified header_row
            df.columns = df.iloc[header_row_number]
        # Select the specified value_row
        df = df.loc[:, ~df.columns.isnull() & (df.columns != '')]
        df = df.iloc[[value_row_number]]
        df = df.fillna('')
            
        row_data = df.to_dict(orient='records')
        # Variables to exclude from overriding
        excluded_variables = {"feature_id", "feature_name"}
        
        # Store each key-value pair in runtime variables except excluded ones
        for key, value in row_data[0].items():
            if key not in excluded_variables:  # Skip overriding feature_id and feature_name
                addTestRuntimeVariable(context, key, str(value), save_to_step_report=True)  # Convert value to string
            else:
                logger.debug(f"Skipping variable: {key}, to prevent overriding.")
                        
    except Exception as e:
        logger.exception(e)
        raise CustomError(e)


use_step_matcher("re")


# Assert api request and response data using JQ patterns. Please refer JQ documentation https://jqlang.github.io/jq/manual/
# jq_pattern is a JSON path that can also be combined with conditions to perform assertions,
@step(u'Fetch value using \"(?P<jq_pattern>.*?)\" from "(?P<variable_name>.+?)" and store in "(?P<new_variable_name>.+?)"(?: with extraction type "(?P<extraction_type>.+?)")?')
@done(u'Fetch value using "{jq_pattern}" from "{variable_name}" and store in "{new_variable_name}"(?: with extraction type "{extraction_type}")?')
def fetch_value_from_json(context, jq_pattern, variable_name, new_variable_name, extraction_type="text"):
    context.STEP_TYPE = context.PREVIOUS_STEP_TYPE

    variable_value = getVariable(context, variable_name) 
    
    # Check if the value is a string and attempt JSON loading
    if isinstance(variable_value, str):
        try:
            variable_value = json.loads(variable_value)
        except json.JSONDecodeError as e:
            raise CustomError(f"Failed to parse JSON: {e}")

    try:
        parsed_value = None
        if extraction_type == "text":
            parsed_value = jq.compile(jq_pattern).input(variable_value).text()
        else:   
            result = jq.compile(jq_pattern).input(variable_value).first()
            if extraction_type == "str":
                parsed_value = str(result)
            elif extraction_type == "int":
                parsed_value = int(result)
            elif extraction_type == "float":
                parsed_value = float(result)
        
        if parsed_value==None:
            raise CustomError(f"Invalid extraction type: {extraction_type}")

        addTestRuntimeVariable(context, new_variable_name, parsed_value, save_to_step_report=True)
    except Exception as err:
        logger.error(err)
        traceback.print_exc()
        raise CustomError(f"Invalid JQ pattern : {str(err)}")

use_step_matcher("parse")


def get_faker_public_methods():
    fake = Faker()
    methods = []
    for attr_name in dir(fake):
        # Skip private and special methods
        if attr_name.startswith('_'):
            continue
        try:
            attr = getattr(fake, attr_name)
            if callable(attr):
                methods.append(attr_name)
        except Exception:
            # Some attributes may raise errors (like deprecated .seed)
            continue
    return methods


# Generates fake data using the Faker library and stores it in a runtime variable
# Args:
#     context: The behave context object containing test execution data
#     information: The type of fake data to generate (e.g., 'name', 'email', 'address')
#     variable: The name of the runtime variable to store the generated data
# Returns:
#     str: The generated fake data value#
# Example:
#     Generate fake "email" and store in "user_email"
#     Generate fake "name" and store in "full_name"
# Available Information types:
# first_name, last_name, name, email, phone_number, address, city, state, country, postalcode, day_of_week, day_of_month, timezone, uid, etc
@step(u'Generate random "{information}" and store in "{variable}"')
@done(u'Generate random "{information}" and store in "{variable}"')
def generate_fake_data_store_in_variable(context, information, variable):
    fake = Faker()
    if hasattr(fake, information):
        method = getattr(fake, information)
        if callable(method):
            send_step_details(context, f"Generating {information}")
            value = method()
            addTestRuntimeVariable(context, variable, value, save_to_step_report=True)
        else:
            raise CustomError(f"'Information type : {information}' not available. Available types are {get_faker_public_methods()}")
    else:
        raise CustomError(f"'Information type : {information}' not available. Available types are {get_faker_public_methods()}")



@step(u'Generate random string based on "{regex_pattern}" and store in "{variable}"')
@done(u'Generate random string based on "{regex_pattern}" and store in "{variable}"')
def generate_random_string(context, regex_pattern, variable):
    send_step_details(context, f"Generating value based on given regex")
    def safe_generate(pattern, validator_pattern=None):
            
        try:
            generated = rstr.xeger(pattern)
            if validator_pattern:
                if re.fullmatch(validator_pattern, generated):
                    return generated
            else:
                return generated
        except re.error as e:
            print(f"[Regex Error] Invalid pattern: {pattern}")
            raise  CustomError(f"[Regex Error] Invalid pattern: {pattern}")
    
    try:
        generated = safe_generate(regex_pattern)
        value = generated
        addTestRuntimeVariable(context, variable, value, save_to_step_report=True)
    except Exception as e:
        # logger.exception(e)
        raise CustomError(f"'Exception while processing regex, {str(e)}")
    

        
    
    
    
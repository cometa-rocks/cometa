# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from behave import (
    step,
    use_step_matcher
)
import sys, requests, re, json
import xmltodict
sys.path.append('/opt/code/cometa_itself/steps')
sys.path.append("/opt/code/behave_django")

from actions import (
    done,
    logger,
    addVariable
)
from tools.exceptions import CustomError
from utility.config_handler import *

use_step_matcher("re")

def parse_cookie(cookie):
    cookie_object = {
        "name": cookie.name,
        "value": cookie.value,
        "domain": cookie.domain,
        "path": cookie.path,
        "secure": cookie.secure,
        "expires": cookie.expires
    }

    return cookie_object

def parse_content(response: requests.Response):
    content_type = response.headers.get("content-type", "").lower()
    
    if "application/json" in content_type:
        return response.json()
    elif "application/xml" in content_type or "text/xml" in content_type:
        try:
            return xmltodict.parse(response.text)
        except Exception as e:
            logger.warning(f"Failed to parse XML response: {e}. Returning raw text.")
            return response.text
    else:
        return response.text

def build_rest_api_object(session: requests.Session, response: requests.Response):
    rest_api_object = {
        "request": {
            "method": response.request.method,
            "headers": dict(response.request.headers),
            "url": response.request.url,
            "path": response.request.path_url,
            "cookies": [parse_cookie(cookie) for cookie in list(session.cookies)]
        },
        "response": {
            "headers": dict(response.headers),
            "cookies": [parse_cookie(cookie) for cookie in list(response.cookies)],
            # "elapsed": response.elapsed,
            "history": [build_rest_api_object(session, history_response) for history_response in response.history],
            "is_redirect": response.is_redirect,
            "status_code": response.status_code,
            "url": response.url,
            "content": parse_content(response)
        }
    }
    # If request contain body then add it to rest_api_object
    if response.request.body: 
        if isinstance(response.request.body, bytes):
            rest_api_object["request"]["data"] = response.request.body.decode()
        else:
            rest_api_object["request"]["data"] = response.request.body

    return rest_api_object

def parse_parameters(parameters):
    if parameters:
        parameters = list(filter(None, re.split(r'(?<!\\);', parameters)))
        parameters_dict = {}

        for parameter in parameters:
                key, value = parameter.split("=", maxsplit=1)
                parameters_dict[key] = value
    
        return parameters_dict
    return None


# Create API step using this action where, the method is HTTP method (GET, POST, PUT or DELETE, etc), the endpoint is your API to be called
# Optionally: you can set query parameters and headers using the format Key=Value, with semicolons ; used to separate key-value pairs (e.g., Key1=value1;Key2=value2)
# Optionally: you can pass body parameter with JSON format i.e. "body:{"key":"value"}"
#@step(u'Make an API call with \"(?P<method>.*?)\" to \"(?P<endpoint>.*?)\"(?: (?:with|and) \"(?:params:(?P<parameters>.*?)|headers:(?P<headers>.*?)|body:(?P<body>.*?))\")*')
#@done(u'Make an API call with "{method}" to "{endpoint}" with "params:{parameters}" and "headers:{headers}" and "body:{body}"')
def api_call(context, method, endpoint, parameters, headers, body):
    context.STEP_TYPE = "API"

    logger.debug({
        "method": method,
        "endpoint": endpoint,
        "parameters": parameters,
        "parsed_parameters": parse_parameters(parameters),
        "headers": headers,
        "parsed_headers": parse_parameters(headers)
    })

    cookies = {
        cookie['name'] : cookie['value'] for cookie in context.browser.get_cookies()
        # TODO: Match Cookie Domain with the Endpoint Domain.
    }

    if body:
        body = json.loads(body)
        logger.debug(f"Request will be sent with body : {body}")
    
    logger.debug(context.browser.get_cookies())
    session = requests.Session()
    session.cookies.update(cookies)
    # need to add proxies - #4545
    proxies = None

    if context.PROXY and len(context.PROXY) > 0:
        # need to use "http://" in front of IP for bug seen here: https://github.com/psf/requests/issues/5297
        proxies = {
            'http' : 'http://'+context.PROXY,
            'https' : 'http://'+context.PROXY
        }
        logger.debug(f"Making API request using proxy : {proxies}")
    response = session.request(
        method=method,
        json=body,
        url=endpoint,
        params=parse_parameters(parameters),
        headers=parse_parameters(headers),
        proxies=proxies 
    )

    api_call = build_rest_api_object(session, response)

    # save the api call
    response = requests.post(f"{get_cometa_backend_url()}/api/rest_api/", json={
        "call": api_call,
        "department_id": int(context.feature_info['department_id'])
    }, headers={"Host": "cometa.local"})

    try:
        json_res = response.json()
    except Exception as err:
        json_res = {
            "success": False,
            "error": str(err)
        }
    if response.status_code != 201 and not json_res['success']:
        raise CustomError(f"Error while saving the call to the database: {json_res['error']}")
    
    context.step_data['rest_api'] = json_res['id']
    context.api_call = api_call


# Create API step using this action where, the method is HTTP method (GET, POST, PUT or DELETE, etc), the endpoint is your API to be called
# Optionally: you can set query parameters and headers using the format Key=Value, with semicolons ; used to separate key-value pairs (e.g., Key1=value1;Key2=value2)
# Optionally: you can pass body parameter with JSON format i.e. "body:{"key":"value"}"
@step(u'Make an API call with \"(?P<method>.*?)\" to \"(?P<endpoint>.*?)\"(?: (?:with|and) \"(?:params:(?P<parameters>.*?)|headers:(?P<headers>.*?)|body:(?P<json_body>.*?)|raw-body:(?P<row_body>.*?))\")*')
@done(u'Make an API call with "{method}" to "{endpoint}" with "params:{parameters}" and "headers:{headers}" and "body:{json_body}" and "row_body:{row_body}"')
def api_call(context, method, endpoint, parameters, headers, json_body, row_body):
    context.STEP_TYPE = "API"

    cookies = {
        cookie['name'] : cookie['value'] for cookie in context.browser.get_cookies()
        # TODO: Match Cookie Domain with the Endpoint Domain.
    }

    # Parse headers to get content type
    parsed_headers = parse_parameters(headers) if headers else {}
    content_type = parsed_headers.get('Content-Type', '').lower()
    accept_type = parsed_headers.get('Accept', '').lower()

    # Handle body based on content type
    if json_body:
        if 'application/json' in content_type:
            try:
                json_body = json.loads(json_body)
                logger.debug(f"Request will be sent with JSON body: {json_body}")
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse JSON body: {e}. Sending as raw body.")
                json_body = json_body
        elif 'application/xml' in content_type or 'text/xml' in content_type:
            # For XML content type, send as raw string
            logger.debug(f"Request will be sent with XML body: {json_body}")
        else:
            # If content type is not specified but body looks like XML, set XML content type
            if json_body.strip().startswith('<?xml') or json_body.strip().startswith('<'):
                parsed_headers['Content-Type'] = 'application/xml'
                logger.debug(f"Auto-detected XML content, setting Content-Type to application/xml")
            # If content type is not specified but body looks like JSON, set JSON content type
            elif json_body.strip().startswith('{') or json_body.strip().startswith('['):
                parsed_headers['Content-Type'] = 'application/json'
                logger.debug(f"Auto-detected JSON content, setting Content-Type to application/json")
            logger.debug(f"Request will be sent with raw body: {json_body}")
    
    logger.debug(context.browser.get_cookies())
    session = requests.Session()
    session.cookies.update(cookies)
    # need to add proxies - #4545
    proxies = None

    if context.PROXY and len(context.PROXY) > 0:
        # need to use "http://" in front of IP for bug seen here: https://github.com/psf/requests/issues/5297
        proxies = {
            'http' : 'http://'+context.PROXY,
            'https' : 'http://'+context.PROXY
        }
        logger.debug(f"Making API request using proxy : {proxies}")
        
    request_parameters = { 
        "method":method,
        "url":endpoint,
        "params":parse_parameters(parameters),
        "headers":parsed_headers,
        "proxies":proxies,
        "verify":False 
    }
        
    if json_body:
        if isinstance(json_body, dict):
            request_parameters["json"] = json_body
        else:
            request_parameters["data"] = json_body
    elif row_body:
        request_parameters["data"] = row_body
    
    logger.debug(request_parameters)
    
    response = session.request(**request_parameters)

    # Convert response content based on Accept header if not already handled
    if accept_type and 'application/json' in accept_type:
        try:
            response._content = json.dumps(xmltodict.parse(response.text)).encode()
            response.headers['Content-Type'] = 'application/json'
        except Exception as e:
            logger.warning(f"Failed to convert XML response to JSON: {e}")
    elif accept_type and ('application/xml' in accept_type or 'text/xml' in accept_type):
        try:
            if isinstance(response.json(), dict):
                response._content = xmltodict.unparse(response.json()).encode()
                response.headers['Content-Type'] = 'application/xml'
        except Exception as e:
            logger.warning(f"Failed to convert JSON response to XML: {e}")

    api_call = build_rest_api_object(session, response)

    # save the api call
    response = requests.post(f"{get_cometa_backend_url()}/api/rest_api/", json={
        "call": api_call,
        "department_id": int(context.feature_info['department_id'])
    }, headers={"Host": "cometa.local"})

    try:
        json_res = response.json()
    except Exception as err:
        json_res = {
            "success": False,
            "error": str(err)
        }
    if response.status_code != 201 and not json_res['success']:
        raise CustomError(f"Error while saving the call to the database: {json_res['error']}")
    
    context.step_data['rest_api'] = json_res['id']
    context.api_call = api_call


# Assert api request and response data using JQ patterns. Please refer JQ documentation https://jqlang.github.io/jq/manual/
# jq_pattern is a JSON path that can also be combined with conditions to perform assertions,
@step(u'Assert last API Call property \"(?P<jq_pattern>.*?)\" to "(?P<condition>match|contain)" \"(?P<value>.*?)\"')
@done(u'Assert last API Call property "{jq_pattern}" to "{condition}" "{value}"')
def assert_imp(context, jq_pattern, condition, value):
    context.STEP_TYPE = "API"

    import jq

    try:
        parsed_value = jq.compile(jq_pattern).input(context.api_call).text()
    except Exception as err:
        logger.error("Invalid JQ pattern")
        logger.exception(err)
        parsed_value = ""
    
    assert_failed_error = f"{parsed_value} ({jq_pattern}) does not { condition } {value}"
    assert_failed_error = logger.mask_values(assert_failed_error)
    
    if condition == "match":
        assert parsed_value == value, assert_failed_error
    else:
        assert value in parsed_value, assert_failed_error

use_step_matcher("parse")


# The last API request and response data can be saved into an environment variable using this action, which can then be used as a value for other steps or for performing assertions when required
@step(u'Save last API Call property "{jq_pattern}" to "{environment_variable}"')
@done(u'Save last API Call property "{jq_pattern}" to "{environment_variable}"')
def assert_imp(context, jq_pattern, environment_variable):
    context.STEP_TYPE = "API"

    import jq

    try:
        parsed_value = jq.compile(jq_pattern).input(context.api_call).text()
    except Exception as err:
        logger.error("Invalid JQ pattern")
        logger.exception(err)
        parsed_value = ""

    addVariable(context, environment_variable, parsed_value)
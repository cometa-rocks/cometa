from selenium import webdriver
from selenium.webdriver.common.proxy import Proxy, ProxyType
import time, requests, json, os, datetime, xml.etree.ElementTree as ET, subprocess, traceback, signal, sys, itertools, glob, logging

from pprint import pprint, pformat
from pathlib import Path
from slugify import slugify
import hashlib
import os
from selenium.common.exceptions import InvalidCookieDomainException
# just to import secrets
sys.path.append("/code")
from src.backend.utility.functions import *
import secret_variables
from src.backend.common import *

# setup logging
logger = logging.getLogger(__name__)
logger.setLevel(BEHAVE_DEBUG_LEVEL)
# create a formatter for the logger
formatter = logging.Formatter(LOGGER_FORMAT, LOGGER_DATE_FORMAT)
# create a stream logger
streamLogger = logging.StreamHandler()
# set the format of streamLogger to formatter
streamLogger.setFormatter(formatter)
# add the stream handle to logger
logger.addHandler(streamLogger)

BROWSERSTACK_USERNAME = getattr(secret_variables, 'COMETA_BROWSERSTACK_USERNAME', False)
BROWSERSTACK_PASSWORD = getattr(secret_variables, 'COMETA_BROWSERSTACK_PASSWORD', False)
PROXY_ENABLED = getattr(secret_variables, 'COMETA_PROXY_ENABLED', False)
PROXY = getattr(secret_variables, 'COMETA_PROXY', False)
DOMAIN = getattr(secret_variables, 'COMETA_DOMAIN', '')
S3ENABLED = getattr(secret_variables, 'COMETA_S3_ENABLED', False)

# handle SIGTERM when user stops the testcase
def stopExecution(signum, frame, context):
    context.aborted = True

# check if context has a variable 
def error_handling(*_args, **_kwargs):
    def decorator(fn):
        def decorated(*args, **kwargs):       
            if 'FEATURE_FAILED' not in os.environ or os.environ['FEATURE_FAILED'] != "True":
                try:
                    result = fn(*args, **kwargs)
                    return result
                except Exception as err:
                    # print the traceback
                    logger.debug("Found an error @%s function, please check the traceback: " % (fn.__name__))
                    traceback.print_exc()

                    # remove the feature_result if it was created
                    if "feature_result_id" in os.environ:
                        response = requests.delete('http://cometa_django:8000/api/feature_results/%s' % os.environ['feature_result_id'], headers={'Host': 'cometa.local'})
                        
                    # let the front user know that the feature has been failed
                    logger.debug("Sending a error websocket....")
                    request = requests.post('http://cometa_socket:3001/feature/%s/error' % args[0].feature_id, data={
                        "browser_info": json.dumps(args[0].browser_info),
                        "feature_result_id": os.environ['feature_result_id'],
                        "run_id": os.environ['feature_run'],
                        "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
                        "error": str(err),
                        "user_id": args[0].PROXY_USER['user_id']
                    })
                    
                    # let behave know that feature has been failed
                    os.environ['FEATURE_FAILED'] = "True"
                    args[0].failed = True
                    
                    # fail the feature
                    raise AssertionError(str(err))
            else:
                logger.debug("Feature has already been failed please check the output above..")
        return decorated
    return decorator



@error_handling()
def before_all(context):
    # handle SIGTERM signal
    signal.signal(signal.SIGTERM, lambda signum, frame, ctx=context: stopExecution(signum, frame, ctx))
    # create index counter for steps
    context.counters = {"total": 0, "ok": 0, "nok": 0, 'index': 0, 'pixel_diff': 0} # failed and skipped can be found from the junit summary.
    logger.debug('context.counters set to: {}'.format(pformat(context.counters)))
    # set feature file path
    context.filepath = os.environ['FEATURE_FILE']
    logger.debug('context.filepath set to: {}'.format(context.filepath))
    # server where the request is coming from Confidential or not
    X_SERVER = os.environ['X_SERVER']
    # user who requested the feature execution
    context.PROXY_USER = json.loads(os.environ['PROXY_USER'])
    # department where the feature belongs
    context.department = json.loads(os.environ['department'])
    # environment variables for the testcase
    context.VARIABLES = os.environ['VARIABLES']
    # job parameters if executed using schedule step
    context.PARAMETERS = os.environ['PARAMETERS']
    # context.browser_info contains '{"os": "Windows", "device": null, "browser": "edge", "os_version": "10", "real_mobile": false, "browser_version": "84.0.522.49"}'
    context.browser_info = json.loads(os.environ['BROWSER_INFO'])
    # set loop settings
    context.insideLoop = False # meaning we are inside a loop
    context.jumpLoopIndex = 0 # meaning how many indexes we need to jump after loop is finished
    context.executedStepsInLoop = 0 # how many steps have been executed inside a loop

    # Get MD5 from browser information - we preserve this piece of code to be able to migrate style images of previous version
    browser_code = '%s-%s' % (context.browser_info['browser'], context.browser_info['browser_version'])
    context.browser_hash = hashlib.md5(browser_code.encode('utf-8')).hexdigest()[:10]

    # Construct browser key using browser_info object, same constructor as in Front
    context.BROWSER_KEY = getBrowserKey(context.browser_info)

    # load the feature file to data
    data = json.loads(os.environ['FEATURE_DATA'])

    # Prepare folders and paths for screenshots and templates
    # Screenshot images are saved in /<screenshots_dir>/<feature_id>/<feature_run>/<feature_result_id>/<rand_hash>/<step_result_id>/AMVARA_<current|style|difference>.png
    # Templates images are saved in /<screeshots_dir>/templates/<feature_id>/<browser_key>/AMVARA_template_<step_index>.png
    run_id = os.environ['feature_run']
    # Retrieve run hash
    context.RUN_HASH = os.environ['RUN_HASH']
    # Set root folder of screenshots
    context.SCREENSHOTS_ROOT = '/opt/code/screenshots/'
    # Construct screenshots path for saving images
    context.SCREENSHOTS_PATH = context.SCREENSHOTS_ROOT + '%s/%s/%s/%s/' % (str(data['feature_id']), str(run_id), str(os.environ['feature_result_id']), context.RUN_HASH)
    # Construct templates path for saving or getting styles
    context.TEMPLATES_PATH = context.SCREENSHOTS_ROOT + 'templates/%s/%s/' % (str(data['feature_id']), context.BROWSER_KEY)
    # Make sure all screenshots and templates folders exists
    Path(context.SCREENSHOTS_PATH).mkdir(parents=True, exist_ok=True)
    Path(context.TEMPLATES_PATH).mkdir(parents=True, exist_ok=True)
    # context.SCREENSHOT_FOLDER='%s/' % time.strftime("%Y%m%d-%H%M%S") # LOOKS LIKE IS NOT USED
    context.SCREENSHOT_PREFIX = 'no_prefix_yet_will_be_set_in_steps'

    # HTML Comparing
    # Set and create the folder used to store and compare HTML step snapshots
    context.HTML_PATH='/opt/code/html/'
    Path(context.HTML_PATH).mkdir(parents=True, exist_ok=True)

    context.feature_info = data
    logger.debug('Feature Information: {}'.format(data))
    # save the feature_id to context
    context.feature_id = str(data['feature_id'])
    # save the continue on failure for feature to the context
    context.feature_continue_on_failure = data.get('continue_on_failure', False)

    # browser data
    context.cloud = context.browser_info.get("cloud", "browserstack") # default it back to browserstack incase it is not set.
    
    # video recording on or off
    context.record_video = data['video'] if 'video' in data else True

    # capabilities
    capabilities={
        'javascriptEnabled': True,
        'name': data['feature_name'],
        'screenResolution': '1920x1080',
        'resolution': '1920x1080',
        'acceptSslCerts': True,
        'acceptInsecureCerts': True,
        'idleTimeout': 150,
        'browserstack.video': context.record_video,
        'recordVideo': context.record_video,
        'testFileNameTemplate': '{seleniumSessionId}',
        'enableVNC': True,
        'sessionTimeout': '30m',
        'enableVideo': context.record_video,
        'chromeOptions': {
            # 'w3c': False
        }
    }

    # proxy configuration
    pxy = None
    if PROXY_ENABLED and PROXY:
        logger.debug("Proxy is enabled for this feature ... will use \"%s\" as proxy configuration." % PROXY)
        pxy = Proxy()
        pxy.proxy_type = ProxyType.MANUAL
        pxy.http_proxy = PROXY
        pxy.ssl_proxy = PROXY

        # add proxy configuration to capabilities
        logger.debug("Adding proxy setting to capabilities.")
        capabilities['proxy'] = {
            "httpProxy": PROXY,
            "sslProxy": PROXY,
            "noProxy": None,
            "proxyType": "MANUAL",
            "class": "org.openqa.selenium.Proxy",
            "autodetect": False
        }

    # LOCAL only
    # download preferences for chrome
    # context.downloadDirectoryInsideSelenium = r'/home/selenium/Downloads/%s' % str(os.environ['feature_result_id'])
    context.downloadDirectoryOutsideSelenium = r'/code/behave/downloads/%s' % str(os.environ['feature_result_id'])
    # os.makedirs(context.downloadDirectoryInsideSelenium, exist_ok=True)
    os.makedirs(context.downloadDirectoryOutsideSelenium, exist_ok=True)
    # change outside directory owner
    # os.chown(context.downloadDirectoryOutsideSelenium, 106, 0)
    # os.chmod(context.downloadDirectoryOutsideSelenium, 0o777)
    # prefs = {
    #     'download.default_directory': context.downloadDirectoryInsideSelenium,
    #     'download.prompt_for_download': False
    # }
    options = None
    if context.browser_info['browser'] == "chrome":
        options = webdriver.ChromeOptions()
        # disable shm since newer chrome version will run out of memory
        # https://github.com/stephen-fox/chrome-docker/issues/8
        # read more about chrome options:
        # https://peter.sh/experiments/chromium-command-line-switches/
        options.add_argument("--disable-dev-shm-usage")
        # Handle local emulated mobile devices
        if context.browser_info.get('mobile_emulation', False):
            mobile_emulation = {
                'deviceMetrics': {
                    'width': int(context.browser_info.get('mobile_width', 360)),
                    'height': int(context.browser_info.get('mobile_height', 640)),
                    'pixelRatio': float(context.browser_info.get('mobile_pixel_ratio', '1.0'))
                },
                'userAgent': context.browser_info.get('mobile_user_agent', '')
            }
            options.add_experimental_option("mobileEmulation", mobile_emulation)

    # if context.cloud == "local" and options is not None:
    #    options.add_experimental_option('prefs', prefs)

    # save downloadedFiles in context
    context.downloadedFiles = {}

    # call update task to create a task with pid.
    task = {
        'action': 'start',
        'browser': json.dumps(context.browser_info),
        'feature_id': context.feature_id,
        'pid': str(os.getpid())
    }
    response = requests.post('http://cometa_django:8000/updateTask/', headers={'Host': 'cometa.local'}, data=json.dumps(task))
    
    logger.info('\33[92mRunning feature...\33[0m')
    logger.info('\33[94mGetting browser context on \33[92m%s Version: %s\33[0m' % (str(context.browser_info['browser']), str(context.browser_info['browser_version'])))
    logger.info("Checking environment to run on: {}".format(context.cloud))
    if context.cloud == "local":
        logger.debug("Running local")
        # command = "http://169.38.135.238:4444/wd/hub"
        command = "http://cometa_selenoid:4444/wd/hub"
        capabilities['browserName'] = context.browser_info['browser']
        capabilities['browserVersion'] = context.browser_info['browser_version']
        # 2021-03-25 RRO added sessionTimeout with Alex to close hanging containers after 30minutes
        capabilities['selenoid:options'] = {
            'enableVNC': True,
            'sessionTimeout': '30m',
            'enableVideo': context.record_video,
            's3KeyPattern': '$sessionId/$fileType$fileExtension'
        }
    else:
        logger.debug("Running on cloud")
        command = "http://%s:%s@%s/wd/hub" % ( BROWSERSTACK_USERNAME, BROWSERSTACK_PASSWORD, "hub.browserstack.com" if X_SERVER != "Confidential" else "cometa_front" )
        # updated capabilities
        for key in context.browser_info:
            if key not in capabilities:
                capabilities[key] = context.browser_info[key]
    
    # Add environment capability
    try:
        capabilities['environment'] = DOMAIN
    except:
        logger.debug('\33[93m'+'COMETA_DOMAIN not found in secret_variables'+'\33[0m')

    logger.debug('Driver Capabilities: {}'.format(capabilities))
    logger.info("Trying to get a browser context")
    context.browser = webdriver.Remote(
        desired_capabilities=capabilities,
        command_executor=command,
        proxy=pxy,
        options=options
    )

    logger.debug("Session id: %s" % context.browser.session_id)

    # set headers for the request
    headers = {'Content-type': 'application/json', 'Host': 'cometa.local'}
    # set payload for the request
    data = {
        'feature_result_id': os.environ['feature_result_id'],
        'session_id': context.browser.session_id
    }
    # update feature_result with session_id
    requests.patch('http://cometa_django:8000/api/feature_results/', json=data, headers=headers)

    # get all the steps from django
    response = requests.get('http://cometa_django:8000/steps/%s/?subSteps=True' % context.feature_id, headers={"Host": "cometa.local"})
    # save the steps to environment variable
    os.environ['STEPS'] = json.dumps(response.json()['results'])

    # update counters total
    context.counters['total'] = len(response.json()['results'])
    
    # send a websocket request about that feature has been started
    request = requests.get('http://cometa_socket:3001/feature/%s/started' % context.feature_id, data={
        "user_id": context.PROXY_USER['user_id'],
        "browser_info": json.dumps(context.browser_info),
        "feature_result_id": os.environ['feature_result_id'],
        "run_id": os.environ['feature_run'],
        "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    })        

# Get video url with context of browser
def get_video_url(context):
    # get the video url from browserstack backend
    bsSessionRequest = requests.get("https://api.browserstack.com/automate/sessions/" + str(context.browser.session_id) + ".json", auth=requests.auth.HTTPBasicAuth("ralf.roeber@amvara.de", "zcGjRZCsJqP4egM1bZTo"))
    return bsSessionRequest.json()['automation_session'].get('video_url', None)

@error_handling()
def after_all(context):
    # check if any alertboxes are open before quiting the browser
    try:
        while(context.browser.switch_to.alert):
            logger.debug("Found an open alert before shutting down the browser...")
            alert = context.browser.switch_to.alert
            alert.dismiss()
    except:
        logger.debug("No alerts found ... before shutting down the browser...")
        pass
    
    try:
        # for some reasons this throws error when running on browserstack with safari
        if context.cloud == "local":
            # delete all generated cookies in previous session
            context.browser.delete_all_cookies()
        # quit the browser since at this point feature has been executed
        context.browser.quit()
    except Exception as err:
        logger.debug("Unable to delete cookies or quit the browser. See error below.")
        logger.debug(str(err))

    # testcase has finished, send websocket about processing data
    request = requests.get('http://cometa_socket:3001/feature/%s/processing' % context.feature_id, data={
        "user_id": context.PROXY_USER['user_id'],
        "browser_info": json.dumps(context.browser_info),
        "feature_result_id": os.environ['feature_result_id'],
        "run_id": os.environ['feature_run'],
        "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
    })

    # get the recorded video if in browserstack and record video is set to true
    bsVideoURL = None
    if context.record_video:
        if context.cloud != "local":
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
        else:
            if S3ENABLED:
                S3ENDPOINT=getattr(secret_variables, 'COMETA_S3_ENDPOINT', False)
                S3BUCKETNAME=getattr(secret_variables, 'COMETA_S3_BUCKETNAME', False)
                if S3ENDPOINT and S3BUCKETNAME:
                    bsVideoURL = "%s/%s/%s/video.mp4" % (S3ENDPOINT, S3BUCKETNAME, context.browser.session_id)
                else:
                    logger.error("S3 is enabled but COMETA_S3_ENDPOINT and COMETA_S3_BUCKETNAME seems to be empty ... please check.")
            else:
                bsVideoURL = "/videos/%s.mp4" % context.browser.session_id
    # load feature into data
    data = json.loads(os.environ['FEATURE_DATA'])
    # junit file path for the executed testcase
    xmlFilePath = '/opt/code/department_data/%s/%s/%s/junit_reports/TESTS-features.%s_%s.xml' % (slugify(data['department_name']), slugify(data['app_name']), data['environment_name'], context.feature_id, slugify(data['feature_name']))
    logger.debug("xmlFilePath: %s" % xmlFilePath)
    # load the file using XML parser
    xmlFile = ET.parse(xmlFilePath).getroot()
    # get the testcase tag from the root which is testsuite
    testcase = xmlFile.find("./testcase")
    # data to update the feature_result
    resultSuccess = context.counters['nok'] == 0
    # get downloaded files
    downloadedFiles = context.downloadedFiles.values()
    # combine all the downloaded files
    downloadedFiles = list(itertools.chain.from_iterable(downloadedFiles))
    data = {
        'feature_result_id': os.environ['feature_result_id'],
        'success': resultSuccess,
        'status': "Success" if resultSuccess else "Failed",
        'ok': context.counters['ok'],
        'total': context.counters['total'],
        'fails': context.counters['nok'],
        'skipped': context.counters['total'] - (context.counters['ok'] + context.counters['nok']),
        'pixel_diff': context.counters['pixel_diff'],
        'screen_style': '',
        'screen_actual': '',
        'screen_diff': '',
        'execution_time': int(float(xmlFile.attrib['time']) * 1000),
        'log': '<log_goes_here>',
        'video_url': bsVideoURL,
        'files': downloadedFiles,
        'running': False
    }
    # check if testcase was aborted by the user if so set the status to Canceled
    stderr = False
    if isinstance(testcase.find("./failure"), ET.Element):
        # save the failed output
        stderr = testcase.find("./failure").text
        if testcase.find("./failure").attrib['message'] == "'aborted'":
            data['status'] = "Canceled"
    
    # get the system output from the xmlfile
    stdout = testcase.find("./system-out").text

    # log content
    log_content = ""

    # append stderr to the log content if exists
    if stderr:
        log_content += """Test case failed, here is the error output:
--------------------------------------------------------------------------------
%s
""" % stderr.replace("\n\n", "\n")

    log_content += """System output:
--------------------------------------------------------------------------------
%s
""" % stdout.replace("\n\n", "\n")

    # save xml file as log for the user
    data['log'] = log_content
    # set the headers for the request
    headers = {'Content-type': 'application/json', 'Host': 'cometa.local'}
    # send the patch request
    requests.patch('http://cometa_django:8000/api/feature_results/', json=data, headers=headers)
    
    logger.debug('\33[92m'+'FeatureResult ran successfully!'+'\33[0m')
    
    # get the final result for the feature_result
    request_info = requests.get("http://cometa_django:8000/api/feature_results/%s" % os.environ['feature_result_id'], headers=headers)
    requests.post('http://cometa_socket:3001/feature/%s/finished' % context.feature_id, data={
            "user_id": context.PROXY_USER['user_id'],
            "browser_info": json.dumps(context.browser_info),
            "feature_result_id": os.environ['feature_result_id'],
            "run_id": os.environ['feature_run'],
            "feature_result_info": json.dumps(request_info.json()['result']),
            "datetime": datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
        })

    # send mail
    sendemail = requests.get('http://cometa_django:8000/pdf/?feature_result_id=%s' % os.environ['feature_result_id'], headers={'Host': 'cometa.local'})
    logger.debug('SendEmail status: '+str(sendemail.status_code))
    
    # remove download folder if no files where downloaded during the testcase
    downloadedFiles = glob.glob(context.downloadDirectoryOutsideSelenium + "/*")
    if len(downloadedFiles) == 0:
        if os.path.exists(context.downloadDirectoryOutsideSelenium):
            os.rmdir(context.downloadDirectoryOutsideSelenium)

    # call update task to delete a task with pid.
    task = {
        'action': 'delete',
        'browser': json.dumps(context.browser_info),
        'feature_id': context.feature_id,
        'pid': str(os.getpid())
    }
    response = requests.post('http://cometa_django:8000/updateTask/', headers={'Host': 'cometa.local'}, data=json.dumps(task))


@error_handling()
def before_step(context, step):
    # complete step name to let front know about the step that will be executed next
    step_name = "%s %s" % (step.keyword, step.name)
    # step index
    index = context.counters['index']
    # pass all the data about the step to the step_data in context, step_data has name, screenshot, compare, enabled and type
    context.step_data = json.loads(os.environ['STEPS'])[index]

    # in video show as a message which step is being executed
    # only works in local video and not in browserstack

    # Throws exception on Daimler testcase to add filter in QS page
    # https://cometa.destr.corpintra.net/#/Cognos%2011.1%20R5/Testing/177
    # FIXME or DELETE ME
    # if context.cloud == "local":
    #     try:
    #         context.browser.add_cookie({
    #             'name': 'zaleniumMessage',
    #             'value': step_name
    #         })
    #     except:
    #         pass # just incase if no url has been searched at the time

    # send websocket to front to let front know about the step
    requests.post('http://cometa_socket:3001/feature/%s/stepBegin' % context.feature_id, data={
        "user_id": context.PROXY_USER['user_id'],
        'feature_result_id': os.environ['feature_result_id'],
        'browser_info': json.dumps(context.browser_info),
        "run_id": os.environ['feature_run'],
        'step_name': step_name,
        'step_index': index,
        'datetime': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'belongs_to': context.step_data['belongs_to']
    })

@error_handling()
def after_step(context, step):
    # complete step name to let front know about the step that has been executed
    step_name = "%s %s" % (step.keyword, step.name)
    # step index
    index = context.counters['index']
    # step result this contains the execution time, success and name
    step_result = context.step_result if hasattr(context, 'step_result') else None
    # create screenshots dictionary to dinamically assign available images
    screenshots = {}
    # check current image of running browser
    if hasattr(context, 'DB_CURRENT_SCREENSHOT'):
        screenshots['current'] = context.DB_CURRENT_SCREENSHOT
    # check if template file is assigned
    if hasattr(context, 'DB_STYLE_SCREENSHOT'):
        screenshots['template'] = context.DB_STYLE_SCREENSHOT
    # check if difference file is assigned
    if hasattr(context, 'DB_DIFFERENCE_SCREENSHOT'):
        screenshots['difference'] = context.DB_DIFFERENCE_SCREENSHOT
    # send websocket to front to let front know about the step
    requests.post('http://cometa_socket:3001/feature/%s/stepFinished' % context.feature_id, json={
        "user_id": context.PROXY_USER['user_id'],
        'feature_result_id': os.environ['feature_result_id'],
        'browser_info': json.dumps(context.browser_info),
        "run_id": os.environ['feature_run'],
        'step_name': step_name,
        'step_index': index,
        'datetime': datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ'),
        'step_result_info': step_result,
        'step_time': step.duration,
        'error': context.step_error if hasattr(context, 'step_error') else None,
        'belongs_to': context.step_data['belongs_to'],
        'screenshots': json.dumps(screenshots) # load screenshots object
    })

    # update countes
    if context.jumpLoopIndex == 0:
        context.counters['index'] += 1
    else:
        context.counters['index'] += context.jumpLoopIndex + 1
        # update total value
        context.counters['total'] += context.executedStepsInLoop
    # if step was executed successfully update the OK counter
    if json.loads(step_result)['success']:
        context.counters['ok'] += 1
    else:
        context.counters['nok'] += 1
    
    # Cleanup variables
    keys = [
        'DB_CURRENT_SCREENSHOT',
        'DB_STYLE_SCREENSHOT',
        'DB_DIFFERENCE_SCREENSHOT',
        'COMPARE_IMAGE',
        'STYLE_IMAGE_COPY_TO_SHOW',
        'DIFF_IMAGE',
        'STYLE_IMAGE'
    ]
    for key in keys:
        if hasattr(context, key):
            delattr(context, key)
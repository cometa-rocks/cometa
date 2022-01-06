import logging
import logging.handlers
import os.path
import time
import subprocess
import requests
from PIL import Image
from src.backend.common import *
from django.db.models import Sum, Value
from django.db.models.functions import Coalesce
import asyncio

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

# Getter: Retrieve a model using the class itself or Model ID
def get_model(obj, model):
    if isinstance(obj, model):
        return obj
    if isinstance(obj, int):
        try:
            return model.objects.get(pk=obj)
        except model.DoesNotExist:
            raise Exception('Unable to resolve model %s with pk=%d' % (str(model), obj))
    raise Exception('Unable to resolve %s with argument type %s' % (str(model), type(obj)))

# Converts a given image path PNG to WebP
def toWebP(image):
    compressedImage = image.replace('.png', '.webp')
    logger.debug("toWebp function converting: %s to %s" % (image, compressedImage) )
    # Open PNG image
    try:
        im = Image.open(image)
        im = im.convert("RGB")
        im.save(compressedImage, optimize=True, quality=70)
    except Exception as err:
        print('Failed to compress %s' % image)
        logger.debug('Failed to compress %s' % image)
        logger.debug("Str err: %s" % str(err) ) 

    # sleep 100ms and check that file has been converted correctly otherwise try to convert using imagick
    time.sleep(0.1)
    if os.path.isfile(compressedImage):
        logger.debug("Ckecked using os.path.isfile that File was save on disk ok - %s" % compressedImage )
    else:
        logger.debug("File was not saved ... falling back to convert")
        cmd = 'convert %s -define webp:lossless=true %s' % (image, compressedImage )
        status = subprocess.call(cmd, shell=True, env={})
        logger.debug("returncode status from fallback to convert: %s" % status)

    # check if pngs on disk can be removed
    logger.debug("Checking again using os.path.isfile that File was save on disk ok - %s" % compressedImage )
    if os.path.isfile(compressedImage):
        logger.debug("Image is there ... so we can safely remove PNG")
        os.remove(image)
    else:
        logger.debug("Leaving PNG image as is because WEBP was not there")

# Remove the given prefix from a string
def removePrefix(text, prefix):
    if text.startswith(prefix):
        return text[len(prefix):]
    return text

def getBrowserKey(browser_info):
    return ('%s-%s-%s-%s-%s-%s' % (
        browser_info.get('browser', None),
        browser_info.get('browser_version', None),
        browser_info.get('device', None),
        browser_info.get('os', None),
        browser_info.get('os_version', None),
        browser_info.get('real_mobile', None)
    )).replace(' ', '')

# Allows to automatically retrieve a step result path knowing each Id
# pass getStepResultPath(prefix=x) for getting the path with a prefix, like the root folder
def getStepResultScreenshotsPath(featureId, runId, featureResultId, runHash, stepResultId, **kwargs):
    # Get prefix keyword
    prefix = kwargs.get('prefix', '')
    # Construct path
    return '%s%s/%s/%s/%s/%s/' % (str(prefix), str(featureId), str(runId), str(featureResultId), runHash, str(stepResultId))

# Allows to set a schedule for a given feature Id
# Returns the response object
def set_test_schedule(feature_id, schedule, user_id):
    post_data = {
        'feature_id': feature_id,
        'schedule': schedule,
        'user_id': user_id
    }
    return requests.post('http://behave:8001/set_test_schedule/', data=post_data)

# Calculates the total values of OK, NOK, Skipped, etc for the given run
def calculate_run_totals(run):
    fields = ['total', 'fails', 'ok', 'skipped', 'execution_time', 'pixel_diff']
    for field in fields:
        setattr(run, field, run.feature_results.all().aggregate(total=Coalesce(Sum(field), Value(0)))['total'])
    run.save()

# Returns a dot notation property of a given Dict
def get_nested_dict_property(obj, properties):
    if not isinstance(obj, dict) and not isinstance(obj, list):
        raise Exception('Invalid dict/list object passed. Must be a dict or list. Passed: %s' % type(obj))
    if not isinstance(properties, str):
        raise Exception('Invalid property passed. Must be a string.')
    properties = properties.split('.')
    result = obj.copy()
    for prop in properties:
        if prop.isnumeric():
            result = result[int(prop)]
        else:
            result = result[prop]
    return result

# Returns a Logger instance ready to use
def getLogger():
    return logger

async def sleep_fn(seconds):
    await asyncio.sleep(seconds)

# Async sleep which can be cancelled by Signal
def cometa_sleep(seconds):
    asyncio.run(sleep_fn(int(seconds)))
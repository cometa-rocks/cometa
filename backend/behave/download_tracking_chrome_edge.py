import websocket
import json

import requests

import json
import threading
import time
import websocket
import trio
from selenium import webdriver
host="aa129603c77d"
command_executor=f"http://{host}:4444/wd/hub"


# from selenium.webdriver.chrome.options import Options
# use edged instead of chrome_options
from selenium.webdriver.edge.options import Options

options = Options()
options.set_capability("se:cdp", True)
options.add_argument("--disable-web-security")
options.add_argument("--allow-running-insecure-content")
options.add_argument("--remote-debugging-address=0.0.0.0")
options.add_argument("--remote-debugging-port=9222")

# # For Edge browser, use ms:loggingPrefs instead of goog:loggingPrefs
# options.set_capability(
#     "ms:loggingPrefs", {"browser": "ALL", "performance": "ALL"}
# )

# For Edge browser, use ms:loggingPrefs instead of goog:loggingPrefs
options.set_capability(
    "ms:loggingPrefs", {"browser": "ALL", "performance": "ALL"}
)

options.add_argument('--enable-logging')
options.add_argument('--log-level=0')
options.add_argument("--window-size=1920,1060")

driver = webdriver.Remote(
    command_executor=command_executor,
    options=options
)
try:
    # response = requests.get(f"http://{host}:9222/json/version")
    # print(response.json())

    # response = requests.get("http://1c9b5fae4937:9222/json/list")
    # print(response.json())


    driver.get("https://nbg1-speed.hetzner.com/100MB.bin")

    # time.sleep(30)  # keep alive long enough to capture events


    time.sleep(3)

    logs = driver.get_log('performance')
    # download_begain = [event for event in logs if event.get('message').get('method') == 'Page.downloadWillBegin']
    for event in logs:
        log = json.loads(event.get('message')).get('message',None)
        if log:
            method = log.get('method')
            params = log.get('params', {})
            if method == 'Page.downloadWillBegin':
                download_begain = params
                break

    if download_begain:
        logs = driver.get_log('performance')
        for entry in logs:
            entry_log = json.loads(entry.get('message')).get('message',None)
            if entry_log:
                if download_begain['guid'] == entry_log['params']['guid']:
                    method = entry_log.get('method')
                    params = entry_log.get('params', {})
                    print(method, params)
        
except Exception as e:
    print(e)

finally:

    driver.quit()
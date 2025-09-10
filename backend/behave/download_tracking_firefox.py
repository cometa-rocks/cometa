import websocket
import json
import traceback
import requests

import json
import threading
import time
import websocket
import trio
from selenium import webdriver
from selenium.webdriver.common.by import By
host="172.22.0.3"
command_executor=f"http://{host}:4444/wd/hub"


# from selenium.webdriver.chrome.options import Options
# use firefox_options instead of chrome_options
from selenium.webdriver.firefox.options import Options
# from selenium.webdriver.edge.options import Options

from selenium.webdriver.firefox.options import Options

options = Options()

# Firefox debugging configuration (compatible with Selenium Grid)
# options.add_argument("--devtools")
options.add_argument("--width=1920")
options.add_argument("--height=1060")
# enable BiDi support in geckodriver
options.set_capability("webSocketUrl", True)
options.set_capability("pageLoadStrategy", "none")  # don't block on downloads

def header_dict(headers_list):
    """Convert BiDi header list to dict"""
    return {h["name"].lower(): h["value"]['value'] for h in headers_list}


driver = webdriver.Remote(
    command_executor=command_executor,
    options=options
)
try:
    bidi_url = driver.capabilities["webSocketUrl"]

    ws = websocket.create_connection(bidi_url)
    ws.settimeout(2)  # seconds
    # Subscribe to network events
    ws.send(json.dumps({
        "id": 1,
        "method": "session.subscribe",
        "params": {"events": ["network", "log", "browsingContext", "script"]}
    }))
    print("Subscribed:", ws.recv())

    # Trigger a download
    driver.get('https://nbg1-speed.hetzner.com/')
    time.sleep(3)
    driver.find_element(By.LINK_TEXT, "100MB.bin").click()  
    # driver.execute_script('window.open("https://nbg1-speed.hetzner.com/100MB.bin")')


    download_request_id = None
    download_done = False

    while not download_done:
        time.sleep(1)

        try:
            print("Waiting for download...")
            msg = ws.recv()
            event = json.loads(msg)
            method = event.get("method")

            if method == "network.responseStarted":
                url = event["params"]["request"]["url"]
                headers = header_dict(event["params"]["response"]["headers"])

                disposition = headers.get("content-disposition", "")
                ctype = headers.get("content-type", "")

                if "attachment" in disposition.lower() or "octet-stream" in ctype.lower():
                    download_request_id = event["params"]["request"]["request"]
                    print(f"[Download Started] {url}")
                    print("Disposition:", disposition)
                    print("Content-Type:", ctype)

            elif method == "network.responseCompleted":
                req_id = event["params"]["request"]["request"]
                if download_request_id and req_id == download_request_id:
                    print(f"[Download Completed] {event['params']['request']['url']}")
                    download_done = True

            elif method == "network.fetchError":
                print("[Download Failed]", event["params"])
                download_done = True
        except websocket.WebSocketTimeoutException as e:
            print("Error:", e)
            traceback.print_exc()
            continue

    

    # Collect ALL events for 10 seconds
    # events = []
    # end_time = time.time() + 50
    # while time.time() < end_time:
    #     try:
    #         msg = ws.recv()
    #         event = json.loads(msg)
    #         events.append(event)  # store everything
    #         print("Event:", event.get("method"))
    #     except websocket.WebSocketTimeoutException:
    #         # no event in this tick
    #         continue
    #     except websocket.WebSocketConnectionClosedException:
    #         print("WebSocket closed")
    #         break
    #     except Exception as e:
    #         print("Error:", e)
    #         break
    # # After timeout, process collected events
    # print(f"\nCollected {len(events)} events")
    # for ev in events:
    #     method = ev.get("method")
    #     if method == "network.responseStarted":
    #         url = ev["params"]["request"]["url"]
    #         headers = ev["params"]["response"]["headers"]
    #         print(f"[responseStarted] {url}")
    #         print("Headers:", headers)
    #     elif method == "network.responseCompleted":
    #         url = ev["params"]["request"]["url"]
    #         print(f"[responseCompleted] {url}")
    #     elif method == "network.fetchError":
    #         print(f"[fetchError] {ev['params']}")
        
    ws.close()
    print("ws closed")
        
except Exception as e:
    print("Error:", e)
    traceback.print_exc()

finally:
    print("Quitting driver")
    driver.quit()





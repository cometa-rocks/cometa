import os

from apscheduler.schedulers.background import BackgroundScheduler
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import time
from utils.common import logger
from utils.crontab_runner import get_schedules, update_jobs


class RequestHandler(BaseHTTPRequestHandler):

    def do_GET(self):
        """Handle GET requests by updating scheduled tasks."""
        logger.info("Processing get request..")
        self.send_response(200)
        self.end_headers()
        jobs = get_schedules()
        update_jobs(scheduler, jobs, called_by="HTTP request")
        self.wfile.write(b"Updated crontab\n")

def run_server():
    """Runs an HTTP server that listens for requests to update tasks."""
    server_address = (os.getenv("SCHEDULER_HOST",''), int(os.getenv("SCHEDULER_PORT",'8080')))
    httpd = HTTPServer(server_address, RequestHandler)
    logger.info(f"Server running on {httpd.server_address}...")
    httpd.serve_forever()

# Setup the scheduler
scheduler = BackgroundScheduler()
scheduler.start()
#
# # Initially fetch schedules and setup jobs
jobs = get_schedules()
update_jobs(scheduler, jobs, called_by="Server start")

# Run HTTP server in a separate thread to keep it non-blocking
server_thread = threading.Thread(target=run_server)
server_thread.start()

# Keep the script running to maintain the scheduler
try:
    while True:
        time.sleep(1)
except (KeyboardInterrupt, SystemExit):
    logger.info("Server shutting down..")
    scheduler.shutdown()
    server_thread.join(timeout=1)
    logger.info("Server stopped")


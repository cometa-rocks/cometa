from prometheus_client import Summary, Counter
from django.core.handlers.wsgi import WSGIRequest
from rest_framework.request import Request
import time

# Create a metric to track time spent and requests made.
REQUEST_TIME = Summary('request_processing_seconds', 'Time spent processing request', ['method', 'endpoint'])
REQUEST_COUNT = Counter('request_count', 'Total amount of requests made.', ['method', 'endpoint', 'user'])

def getRequest(*args):
    request = None
    for i in range(0, len(args)):
        if isinstance(args[i], WSGIRequest) or isinstance(args[i], Request):
            request = args[i]
            break
    return request

def prometheus_request_monitoring(obj):
    def wrapper(*args, **kwargs):
        # get request from arguments
        request = getRequest(*args)
        method = request.method
        endpoint = request.path
        user = request.session.get('user', {}).get('user_id', None)
        start_time = time.time()
        result = obj(*args, **kwargs)
        REQUEST_TIME.labels(method, endpoint).observe((time.time() - start_time))
        REQUEST_COUNT.labels(method, endpoint, user).inc()
        return result
    return wrapper
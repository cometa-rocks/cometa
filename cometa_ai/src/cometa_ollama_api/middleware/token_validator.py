# from apps.token_authentication.views import validate_secrets
from apps.token_authentication.models import OIDCUserAppSecret
import logging, traceback, urllib3
from datetime import datetime
from django.http import HttpResponse, JsonResponse
from django.http import JsonResponse

logger = logging.getLogger()


# This method is used to validate the secret provided in the request body during the CICD integration test start
def validate_secrets(secret):
    if secret is None:
        return None
    secret_id = secret.get("secret_id", None)
    secret_key = secret.get("secret_key", None)
    if secret_id is None or secret_key is None:
        return None
    try:
        logger.debug("Checking secret")
        secret = OIDCUserAppSecret.objects.get(secret_id=secret_id)
        # If the failed count is more than 10, then the secret is invalid
        if secret.failed_count > 10:
            logger.debug(f"Secret {secret.token_id} failed count exceeded 10, this secret is disabled")
            return None
            
        if secret.secret_key != secret_key:
            logger.debug(f"Invalid secret key provided for secret {secret.token_id}")
            secret.failed_count += 1
            secret.save()
            return None
        
        secret.failed_count = 0
        secret.last_used = datetime.now()
        secret.save()
        
        return secret       
    except Exception as e:
        logger.exception("Error occurred during secret validation")
        return None


class TokenValidator:
    def __init__(self, get_response):
        urllib3.disable_warnings()
        self.get_response = get_response

    def append_custom_headers(self, response):
        response['X-Powered-By'] = 'Opensource'
        return response

    def __call__(self, request):
        secrets = request.META.get("HTTP_AUTHORIZATION", "").split("===")
        secret_id = secrets[0] if len(secrets) > 0 else None
        secret_key = secrets[1] if len(secrets) > 1 else None
        logger.debug(f"Secret ID: {secret_id}")
        logger.debug(f"Secret Key: {secret_key}")
        
        if secret_id and secret_key:
            token = {
                "secret_id": secret_id,
                "secret_key": secret_key
            }
            try:
                is_valid = validate_secrets(token)
                if is_valid:
                    return self.append_custom_headers(self.get_response(request))
                else:
                    return JsonResponse({"success": False, "error": "Invalid credentials"}, status=403)
            except Exception as e:
                logger.exception("Secret validation failed")
                return JsonResponse({"success": False, "error": "Secret validation error"}, status=500)
        else:
            logger.debug("No secret provided")
            return JsonResponse({"success": False, "error": "No secret provided"}, status=403)
        
        # Continue to next middleware/view if no secret is provided
        return self.get_response(request)

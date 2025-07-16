"""
Middleware to handle Telegram OAuth completion after Apache mod_auth_openidc authentication.

This middleware checks if a user has just completed OAuth authentication and has a pending
Telegram authentication request. If so, it completes the Telegram linking process.
"""
import logging
from django.shortcuts import redirect
from django.utils import timezone
from datetime import timedelta

logger = logging.getLogger(__name__)


class TelegramOAuthCompletionMiddleware:
    """
    Middleware to complete Telegram authentication after OAuth login.
    
    This works around the limitation of Apache mod_auth_openidc not preserving
    the target_link_uri parameter through the OAuth flow.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
        
    def __call__(self, request):
        """
        Check if user just completed OAuth and has pending Telegram auth.
        """
        
        # Check for authenticated users only
        if not request.session.get('user'):
            
            # Process the response first
            response = self.get_response(request)
            
            # Check for pending Telegram auth after OAuth completion
            if request.session.get('user'):
                # Show success page if link completed
                if request.path == '/' and request.session.get('telegram_link_completed'):
                    from django.shortcuts import render
                    return render(request, 'telegram_oauth_complete.html')
                
            return response
            
        # Skip if already processed in this session
        if request.session.get('telegram_oauth_checked'):
            return self.get_response(request)
            
        # Skip non-GET requests and specific paths
        if request.method != 'GET':
            return self.get_response(request)
            
        # Skip if this is an API or static resource request
        # Also skip if this is an AJAX request or Angular API call
        # Always skip /auth/telegram/ paths - they have their own handler
        if request.path.startswith('/auth/telegram/'):
            return self.get_response(request)
            
        # Don't skip /addoidcaccount/ and /api/browsers/ for telegram auth processing
        if request.path in ['/addoidcaccount/', '/backend/addoidcaccount/', '/api/browsers/']:
            # Allow these specific paths to be processed
            pass
        elif any(request.path.startswith(p) for p in ['/api/', '/static/', '/media/', '/health', '/telegram/', '/debug/', '/callback', '/backend/']):
            return self.get_response(request)
            
        # Skip AJAX requests
        if request.META.get('HTTP_X_REQUESTED_WITH') == 'XMLHttpRequest':
            return self.get_response(request)
            
        # Process authenticated request
        logger.debug(f"Processing telegram auth for path: {request.path}")
        
        # Mark as checked for this session
        request.session['telegram_oauth_checked'] = True
        request.session.save()
        
        try:
            # Import here to avoid circular imports
            from backend.ee.modules.notification.models import TelegramUserLink
            from backend.ee.modules.notification.telegram_auth import TelegramAuthenticationHandler
            
            user_id = request.session['user'].get('user_id')
            if not user_id:
                return self.get_response(request)
            
            # We don't check tokens in session anymore for security reasons
            # Tokens are only validated through URL parameters or database lookups
            return self.get_response(request)
                    
        except Exception as e:
            logger.error(f"Error in TelegramOAuthCompletionMiddleware: {str(e)}")
            
        return self.get_response(request)
    

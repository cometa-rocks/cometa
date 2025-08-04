"""
Utility functions for working with ngrok
"""

import requests
import logging

logger = logging.getLogger(__name__)


def get_current_ngrok_url():
    """
    Get the current ngrok public URL by querying the local ngrok API
    Returns None if ngrok is not running or API is not accessible
    """
    try:
        # Query ngrok's local API
        response = requests.get('http://localhost:4040/api/tunnels', timeout=2)
        if response.status_code == 200:
            data = response.json()
            tunnels = data.get('tunnels', [])
            
            # Look for HTTPS tunnel
            for tunnel in tunnels:
                if tunnel.get('proto') == 'https':
                    public_url = tunnel.get('public_url')
                    if public_url:
                        # Extract just the domain part
                        domain = public_url.replace('https://', '').replace('http://', '')
                        logger.info(f"Found ngrok domain: {domain}")
                        return domain
            
            # If no HTTPS tunnel, try any tunnel
            if tunnels:
                public_url = tunnels[0].get('public_url')
                if public_url:
                    domain = public_url.replace('https://', '').replace('http://', '')
                    logger.info(f"Found ngrok domain (fallback): {domain}")
                    return domain
                    
    except Exception as e:
        logger.debug(f"Could not get ngrok URL: {e}")
    
    return None


def get_telegram_auth_domain(environment='prod'):
    """
    Get the appropriate domain for Telegram authentication URLs
    """
    from backend.utility.configurations import ConfigurationManager
    
    if environment == 'dev':
        # For development, use the configured ngrok domain
        # This should be set when you update the webhook
        configured_domain = ConfigurationManager.get_configuration('COMETA_NGROK_DOMAIN', None)
        if configured_domain:
            return configured_domain
        
        # Try to get current ngrok URL
        current_ngrok = get_current_ngrok_url()
        if current_ngrok:
            return current_ngrok
            
        # Fallback to static ngrok domain if configured
        return 'cometa-dev.ngrok.dev'
    else:
        # Production: use configured domain
        return ConfigurationManager.get_configuration('COMETA_DOMAIN', 'prod.cometa.rocks')
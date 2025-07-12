#!/usr/bin/env python3
"""
Update Telegram webhook URL
Usage: python update_telegram_webhook.py <ngrok_url>
Example: python update_telegram_webhook.py https://81197f68b409.ngrok-free.app
"""

import sys
import requests
import os

# Get bot token from environment or configuration
BOT_TOKEN = os.getenv('COMETA_TELEGRAM_BOT_TOKEN')
if not BOT_TOKEN:
    # Try to get from Django settings
    try:
        import django
        os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cometa_pj.settings')
        django.setup()
        from backend.utility.configurations import ConfigurationManager
        BOT_TOKEN = ConfigurationManager.get_configuration('COMETA_TELEGRAM_BOT_TOKEN', None)
    except Exception as e:
        print(f"Error loading bot token: {e}")
        BOT_TOKEN = None

if not BOT_TOKEN:
    print("Error: COMETA_TELEGRAM_BOT_TOKEN not found in environment or configuration")
    print("Please set it as an environment variable or in the configuration")
    sys.exit(1)

if len(sys.argv) < 2:
    print("Usage: python update_telegram_webhook.py <ngrok_url>")
    print("Example: python update_telegram_webhook.py https://81197f68b409.ngrok-free.app")
    sys.exit(1)

ngrok_url = sys.argv[1].rstrip('/')
webhook_url = f"{ngrok_url}/telegram/webhook/"

print(f"Updating Telegram webhook to: {webhook_url}")

# Set the webhook
url = f"https://api.telegram.org/bot{BOT_TOKEN}/setWebhook"
payload = {
    "url": webhook_url,
    "allowed_updates": ["message", "callback_query"],
    "drop_pending_updates": False
}

try:
    response = requests.post(url, json=payload)
    result = response.json()
    
    if result.get('ok'):
        print("✅ Webhook updated successfully!")
        print(f"Webhook URL: {webhook_url}")
        
        # Get webhook info
        info_url = f"https://api.telegram.org/bot{BOT_TOKEN}/getWebhookInfo"
        info_response = requests.get(info_url)
        info_data = info_response.json()
        
        if info_data.get('ok'):
            webhook_info = info_data.get('result', {})
            print(f"\nWebhook Info:")
            print(f"- URL: {webhook_info.get('url')}")
            print(f"- Has certificate: {webhook_info.get('has_custom_certificate')}")
            print(f"- Pending updates: {webhook_info.get('pending_update_count')}")
            if webhook_info.get('last_error_message'):
                print(f"- Last error: {webhook_info.get('last_error_message')}")
    else:
        print(f"❌ Failed to update webhook: {result.get('description')}")
        
except Exception as e:
    print(f"❌ Error updating webhook: {e}")
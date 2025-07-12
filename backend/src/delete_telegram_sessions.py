#!/usr/bin/env python3
"""
Script to delete Telegram authentication sessions for testing
"""

import os
import sys
import django

# Setup Django environment
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cometa_pj.settings')
django.setup()

from django.contrib.sessions.models import Session
from django.db import connection
from backend.ee.modules.notification.models import TelegramUserLink
import json

def delete_telegram_sessions():
    """Delete all sessions that were created via Telegram authentication"""
    
    deleted_count = 0
    
    print("Searching for Telegram authenticated sessions...")
    
    # Get all sessions
    all_sessions = Session.objects.all()
    
    for session in all_sessions:
        try:
            # Decode session data
            session_data = session.get_decoded()
            
            # Check if this is a Telegram session
            if session_data.get('auth_method') == 'telegram':
                chat_id = session_data.get('telegram_chat_id')
                user_info = session_data.get('user', {})
                user_email = user_info.get('email', 'Unknown')
                
                print(f"Found Telegram session for user: {user_email} (chat_id: {chat_id})")
                print(f"  Session key: {session.session_key}")
                print(f"  Expires: {session.expire_date}")
                
                # Delete the session
                session.delete()
                deleted_count += 1
                print("  ✓ Session deleted")
                
        except Exception as e:
            print(f"Error processing session {session.session_key}: {str(e)}")
            continue
    
    print(f"\nDeleted {deleted_count} Telegram session(s)")
    
    # Also show active Telegram user links
    print("\nActive Telegram user links:")
    telegram_links = TelegramUserLink.objects.filter(is_active=True)
    
    for link in telegram_links:
        print(f"- User ID: {link.user_id}, Chat ID: {link.chat_id}, Email: {link.gitlab_email}")
        print(f"  Verified: {link.is_verified}, Active: {link.is_active}")
        if link.auth_token:
            print(f"  Has auth token: Yes (expires: {link.auth_token_expires})")

def delete_all_sessions():
    """Delete ALL sessions (use with caution)"""
    count = Session.objects.all().count()
    Session.objects.all().delete()
    print(f"Deleted ALL {count} sessions")

def delete_telegram_auth_tokens():
    """Clear auth tokens from TelegramUserLink records"""
    links_with_tokens = TelegramUserLink.objects.exclude(auth_token='').exclude(auth_token__isnull=True)
    count = links_with_tokens.count()
    
    for link in links_with_tokens:
        print(f"Clearing auth token for chat_id: {link.chat_id}")
        link.auth_token = ''
        link.auth_token_expires = None
        link.save()
    
    print(f"Cleared {count} auth token(s)")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Delete Telegram authentication sessions")
    parser.add_argument('--all', action='store_true', help='Delete ALL sessions (not just Telegram)')
    parser.add_argument('--tokens', action='store_true', help='Also clear Telegram auth tokens')
    
    args = parser.parse_args()
    
    if args.all:
        response = input("Are you sure you want to delete ALL sessions? This will log out all users. (yes/no): ")
        if response.lower() == 'yes':
            delete_all_sessions()
        else:
            print("Cancelled")
    else:
        delete_telegram_sessions()
    
    if args.tokens:
        print("\nClearing Telegram auth tokens...")
        delete_telegram_auth_tokens()
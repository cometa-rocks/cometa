#!/usr/bin/env python3
"""
Django management command to update the Telegram bot webhook URL.

Usage:
    python manage.py update_telegram_webhook <public_url>

`public_url` must be a publicly-reachable HTTPS base URL (e.g. an ngrok URL)
that points to the running backend.  The command appends `/telegram/webhook/`
when registering the webhook with Telegram.

The bot token and (optional) webhook secret are read in this order:
1. Environment variables `COMETA_TELEGRAM_BOT_TOKEN` / `COMETA_TELEGRAM_WEBHOOK_SECRET`
2. Co.meta `ConfigurationManager` settings of the same names.

Raises a CommandError if the token is not available or Telegram returns an
error.
"""

import os
import re
import requests
from django.core.management.base import BaseCommand, CommandError
from backend.utility.configurations import ConfigurationManager

# Telegram API endpoints -------------------------------------------------------
SET_WEBHOOK_PATH = "/setWebhook"
GET_WEBHOOK_INFO_PATH = "/getWebhookInfo"


class Command(BaseCommand):
    help = "Register (or update) the Telegram bot webhook URL"

    def add_arguments(self, parser):
        parser.add_argument(
            "public_url",
            help="Public HTTPS URL reachable by Telegram (e.g. https://xxxx.ngrok-free.app)",
        )

    # ---------------------------------------------------------------------
    # Helpers
    # ---------------------------------------------------------------------
    def _get_bot_token(self) -> str:
        token = os.getenv("COMETA_TELEGRAM_BOT_TOKEN") or ConfigurationManager.get_configuration(
            "COMETA_TELEGRAM_BOT_TOKEN", None
        )
        if not token:
            raise CommandError(
                "COMETA_TELEGRAM_BOT_TOKEN not found in environment or configuration"
            )
        return token

    def _get_webhook_secret(self) -> str | None:
        secret = os.getenv("COMETA_TELEGRAM_WEBHOOK_SECRET") or ConfigurationManager.get_configuration(
            "COMETA_TELEGRAM_WEBHOOK_SECRET", ""
        )
        if secret and not re.fullmatch(r"[A-Za-z0-9_-]{1,256}", secret):
            raise CommandError(
                "Invalid COMETA_TELEGRAM_WEBHOOK_SECRET format (only A–Z, a–z, 0–9, _ and - allowed, max 256 chars)"
            )
        return secret or None

    # ---------------------------------------------------------------------
    # Main entry-point
    # ---------------------------------------------------------------------
    def handle(self, *args, **options):  # noqa: D401 (imperative-mood docstrings)
        public_url: str = options["public_url"].rstrip("/")
        if not public_url.startswith("https://"):
            raise CommandError("public_url must start with https://")

        webhook_url = f"{public_url}/telegram/webhook/"
        self.stdout.write(f"Registering webhook URL: {webhook_url}")

        bot_token = self._get_bot_token()
        secret_token = self._get_webhook_secret()

        payload: dict[str, object] = {
            "url": webhook_url,
            "allowed_updates": ["message", "callback_query"],
            "drop_pending_updates": False,
        }
        if secret_token:
            payload["secret_token"] = secret_token
            self.stdout.write("Using webhook secret for enhanced security")

        api_base = f"https://api.telegram.org/bot{bot_token}"

        # Set webhook -----------------------------------------------------
        try:
            response = requests.post(f"{api_base}{SET_WEBHOOK_PATH}", json=payload, timeout=30)
            data: dict = response.json()
        except Exception as exc:
            raise CommandError(f"Request to Telegram failed: {exc}") from exc

        if not data.get("ok"):
            raise CommandError(f"Telegram API error: {data.get('description')}")

        self.stdout.write(self.style.SUCCESS("Webhook updated successfully!"))

        # Show current webhook info --------------------------------------
        try:
            info_resp = requests.get(f"{api_base}{GET_WEBHOOK_INFO_PATH}", timeout=30)
            info: dict = info_resp.json()
            if info.get("ok"):
                res = info.get("result", {})
                self.stdout.write("\nWebhook Info:")
                self.stdout.write(f"  URL               : {res.get('url')}")
                self.stdout.write(f"  Has certificate   : {res.get('has_custom_certificate')}")
                self.stdout.write(f"  Pending updates   : {res.get('pending_update_count')}")
                if res.get("last_error_message"):
                    self.stdout.write(f"  Last error        : {res.get('last_error_message')}")
            else:
                self.stdout.write("Could not fetch webhook info: " + info.get("description", "unknown error"))
        except Exception as exc:
            self.stdout.write(f"Failed to retrieve webhook info: {exc}") 
"""Enterprise-grade browser-use utilities for Cometa AI testing."""

import os
import re
import asyncio
import logging
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from contextlib import suppress

import nest_asyncio
import requests
from browser_use import Agent, Browser, ChatOpenAI, ChatOllama
from browser_use.logging_config import setup_logging

from utility.configurations import ConfigurationManager as Config
from tools.common_functions import get_cometa_socket_url
from tools.exceptions import CustomError

logger = logging.getLogger("FeatureExecution")


class BrowserUseConfig:
    """Configuration constants for browser-use execution."""
    MAX_STEPS = 50
    LOG_LEVEL = 'info'
    OPENAI_DEFAULT_MODEL = "o4-mini-2025-04-16"
    OLLAMA_DEFAULT_MODEL = "llama3.1:8b"
    OLLAMA_DEFAULT_PORT = "8083"


class BrowserUseLogHandler(logging.Handler):
    """Optimized handler for browser-use logging with WebSocket integration."""

    AUTH_FILTER = re.compile(r'🔐.*Browser Use Cloud|authenticate|browser-use auth|^[─👉]+')
    ANSI_ESCAPE = re.compile(r'[\x1b\033]\[[0-9;]*m|\\x1b\[[0-9;]*m')
    CRITICAL_MARKERS = frozenset(['❌', '💥', 'failed', 'error'])

    def __init__(self, context, console_logger):
        super().__init__()
        self.context = context
        self.console = console_logger
        self.socket_url = f'{get_cometa_socket_url()}/feature/{context.feature_id}/browserUseLogs'
        self.base_data = {
            "user_id": context.PROXY_USER['user_id'],
            "feature_result_id": os.environ.get('feature_result_id', ''),
            "step_index": getattr(context, 'step_index', 0)
        }

    def emit(self, record):
        msg = self.ANSI_ESCAPE.sub('', self.format(record).replace('[browser-use] ', '')).strip()
        if msg and not self.AUTH_FILTER.search(msg):
            self.console.info(f"[browser-use] {msg}")
            self._send_to_websocket(msg)

    def _send_to_websocket(self, msg: str):
        level = 'critical' if any(m in msg for m in self.CRITICAL_MARKERS) else \
                'progress' if '📍 Step' in msg else 'info'
        with suppress(Exception):
            requests.post(self.socket_url, data={
                **self.base_data,
                "message": msg,
                "log_level": level,
                "timestamp": datetime.utcnow().isoformat() + 'Z'
            }, timeout=1)


class LLMFactory:
    """Factory for creating LLM instances with provider abstraction."""

    @staticmethod
    def create(context) -> Any:
        """Create LLM instance based on configuration."""
        mode = Config.get_configuration("COMETA_BROWSER_USE_MODE", "").lower()

        if not mode:
            raise ValueError("COMETA_BROWSER_USE_MODE not configured. Set to 'openai' or 'ollama'.")

        creators = {
            "openai": LLMFactory._create_openai,
            "ollama": LLMFactory._create_ollama
        }

        if mode not in creators:
            raise ValueError(f"Invalid COMETA_BROWSER_USE_MODE: '{mode}'. Use 'openai' or 'ollama'.")

        return creators[mode]()

    @staticmethod
    def _create_openai() -> ChatOpenAI:
        """Create OpenAI LLM instance."""
        api_key = Config.get_configuration("COMETA_OPENAI_API_KEY", "").strip()
        if not api_key:
            raise ValueError("COMETA_OPENAI_API_KEY not configured in Django admin.")

        if not api_key.startswith("sk-"):
            logger.warning("OpenAI API key may be invalid (doesn't start with 'sk-')")

        os.environ["OPENAI_API_KEY"] = api_key
        model = Config.get_configuration("COMETA_BROWSER_USE_MODEL", BrowserUseConfig.OPENAI_DEFAULT_MODEL)
        return ChatOpenAI(model=model, temperature=0.0, api_key=api_key)

    @staticmethod
    def _create_ollama() -> ChatOllama:
        """Create Ollama LLM instance."""
        host = Config.get_configuration("OLLAMA_AI_HOST", "ollama.ai")
        port = Config.get_configuration("OLLAMA_AI_PORT", BrowserUseConfig.OLLAMA_DEFAULT_PORT)
        model = (Config.get_configuration("OLLAMA_BROWSER_USE_MODEL") or
                 Config.get_configuration("COMETA_BROWSER_USE_MODEL") or
                 BrowserUseConfig.OLLAMA_DEFAULT_MODEL)

        tls = Config.get_configuration("OLLAMA_AI_TLS_SSL_ENABLED", "False").lower() == "true"
        protocol = "https" if tls else "http"
        ollama_host = f"{protocol}://{host}:{port}"

        os.environ["OLLAMA_HOST"] = ollama_host
        os.environ["ANONYMIZED_TELEMETRY"] = "false"

        logger.info(f"Ollama config: host={ollama_host}, model={model}")
        return ChatOllama(model=model)


async def execute_browser_action(context, prompt: str, browser_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Execute browser-use action asynchronously.

    Returns:
        dict: {"success": bool, "result"/"error": str}
    """
    if not browser_context.get('cdp_endpoint'):
        return {"success": False, "error": "Missing CDP endpoint"}

    try:
        # Setup logging
        os.environ.update({
            'BROWSER_USE_LOGGING_LEVEL': BrowserUseConfig.LOG_LEVEL,
            'BROWSER_USE_SETUP_LOGGING': 'true'
        })
        setup_logging(log_level=BrowserUseConfig.LOG_LEVEL, force_setup=True)

        # Initialize components
        browser = Browser(cdp_url=browser_context['cdp_endpoint'])
        logger.info(f"🤖 Browser connected: {browser_context['cdp_endpoint']}")

        try:
            llm = LLMFactory.create(context)
        except Exception as e:
            return {"success": False, "error": str(e)}

        # Configure logging handler
        import logging as browser_logging
        browser_logger = browser_logging.getLogger('browser_use')
        browser_logger.handlers.clear()

        handler = BrowserUseLogHandler(context, logger)
        handler.setLevel(browser_logging.INFO)
        browser_logger.addHandler(handler)
        browser_logger.setLevel(browser_logging.INFO)

        try:
            # Execute agent task
            agent = Agent(task=prompt, llm=llm, browser=browser, use_vision=False)
            logger.info(f"🚀 Executing: {prompt[:100]}...")

            result = await agent.run(max_steps=BrowserUseConfig.MAX_STEPS)

            # Process result
            if result:
                if hasattr(result, 'is_done') and result.is_done():
                    final = result.final_result() if hasattr(result, 'final_result') else "Completed"
                    return {"success": True, "result": final or "Task completed"}

                if hasattr(result, 'errors') and result.errors():
                    return {"success": False, "error": f"Task failed: {result.errors()}"}

                return {"success": True, "result": "Task completed successfully"}

            return {"success": False, "error": "No result returned"}

        finally:
            browser_logger.removeHandler(handler)
            # Ensure browser is closed to prevent hanging jobs
            with suppress(Exception):
                if hasattr(browser, 'close'):
                    await browser.close()

    except Exception as e:
        logger.exception(f"Browser-use failed: {e}")
        return {"success": False, "error": str(e)}


def execute_browser_use_action(context, prompt: str) -> Tuple[bool, Dict[str, Any]]:
    """
    Synchronous wrapper for browser-use execution.

    Returns:
        tuple: (success: bool, result: dict)
    """
    try:
        browser_context = {
            'cdp_endpoint': context.websocket_url,
            'session_id': getattr(context.browser, 'session_id', None),
            'page_url': getattr(context.page, 'url', None) if hasattr(context, 'page') else None
        }

        # Apply nest_asyncio to allow nested event loops
        nest_asyncio.apply()

        # Create a new event loop for this execution to avoid conflicts
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        try:
            result = loop.run_until_complete(execute_browser_action(context, prompt, browser_context))
            return result.get("success", False), result
        finally:
            # Ensure the loop is properly closed
            try:
                loop.close()
            except Exception as e:
                logger.warning(f"Error closing event loop: {e}")

    except Exception as e:
        logger.exception(f"Execution failed: {e}")
        raise CustomError(f"Browser-use error: {str(e)}")
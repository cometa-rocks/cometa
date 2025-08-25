"""
Healenium Client for Co.Meta

This module handles Healenium integration with per-test proxy creation.
Due to architectural constraints, each test needs its own proxy pointing to its specific browser container.
"""

import logging
import requests
import time
import docker
import threading
import re
from typing import Optional, Dict, Any
from contextlib import contextmanager

# Get logger
logger = logging.getLogger('FeatureExecution')

# Healenium Configuration
HEALENIUM_CONFIG = {
    "proxy_image": "healenium/hlm-proxy:2.1.8",
    "backend_url": "http://hlm-backend:7878",
    "selector_imitator_url": "http://selector-imitator:8000",
    "recovery_tries": "3",
    "score_cap": "0.3",
    "heal_enabled": "true",
    "network": "cometa_testing"
}


class HealeniumClient:
    """Healenium client for per-test proxy management"""
    
    def __init__(self, context):
        self.context = context
        self.healing_enabled = bool(getattr(context, 'healenium_enabled', False))
        self.proxy_info = None
        self.docker_client = None
        self.proxy_container = None
        
        if self.healing_enabled:
            try:
                self.docker_client = docker.from_env()
            except Exception as e:
                logger.error(f"Failed to connect to Docker: {e}")
                self.healing_enabled = False
    
    def create_proxy_sync_wait(self, browser_url: str, container_id: str, config: Dict[str, Any], timeout: float = 15.0) -> Optional[str]:
        """
        Create proxy synchronously and wait for it to be ready.
        """
        if not self.healing_enabled:
            return None
        
        logger.info("Creating Healenium proxy synchronously...")
        start_time = time.time()
        
        try:
            # Create the proxy
            proxy_info = self._create_proxy_sync(browser_url, container_id, config)
            
            if proxy_info:
                elapsed = time.time() - start_time
                logger.info(f"Healenium proxy ready after {elapsed:.2f}s: {proxy_info['name']}")
                self.proxy_info = proxy_info
                
                # Store proxy name in context for environment.py to check
                self.context.healenium_proxy_name = proxy_info['name']
                
                return proxy_info['url']
            else:
                logger.error("Failed to create Healenium proxy")
                return None
                
        except Exception as e:
            logger.error(f"Exception creating proxy: {e}")
            return None
    
    def _create_proxy_sync(self, browser_url: str, container_id: str, config: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Create a Healenium proxy container synchronously"""
        proxy_name = f"hlm-proxy-{container_id[:8]}"
        
        try:
            # Check if proxy already exists
            try:
                existing = self.docker_client.containers.get(proxy_name)
                logger.info(f"Removing existing proxy: {proxy_name}")
                existing.stop(timeout=5)
                existing.remove(force=True)
            except docker.errors.NotFound:
                pass
            
            # Create proxy container with correct Selenium URL
            logger.debug(f"Creating proxy {proxy_name} for browser at {browser_url}")
            
            # Build the proper Selenium URL
            selenium_url = f"http://{browser_url}:4444/wd/hub"
            
            proxy_container = self.docker_client.containers.run(
                config["proxy_image"],
                name=proxy_name,
                environment={
                    "RECOVERY_TRIES": str(config.get("recovery_tries", "3")),
                    "SCORE_CAP": str(config.get("score_cap", "0.5")),
                    "HEAL_ENABLED": "true",
                    "SELENIUM_SERVER_URL": selenium_url,  # Point to specific browser
                    "HEALENIUM_SERVICE": config["backend_url"],
                    "IMITATE_SERVICE": config.get("selector_imitator_url", "http://selector-imitator:8000"),
                    "HLM_LOG_LEVEL": config.get("log_level", "info")
                },
                network=config["network"],
                detach=True,
                remove=False
            )
            
            self.proxy_container = proxy_container
            
            # Build proxy URL
            proxy_url = f"http://{proxy_name}:8085/wd/hub"
            
            # Wait for proxy to be ready
            if self._wait_for_proxy(proxy_url):
                # Start monitoring logs for healing events
                self._start_log_monitoring()
                
                return {
                    'name': proxy_name,
                    'container': proxy_container,
                    'url': proxy_url,
                    'browser_url': browser_url
                }
            else:
                logger.error(f"Proxy {proxy_name} failed to become ready")
                proxy_container.stop(timeout=5)
                proxy_container.remove(force=True)
                return None
                
        except Exception as e:
            logger.error(f"Failed to create proxy: {e}")
            return None
    
    def _wait_for_proxy(self, proxy_url: str, timeout: int = 10) -> bool:
        """Wait for proxy to be ready"""
        start_time = time.time()
        
        # Extract base URL
        base_url = proxy_url.replace('/wd/hub', '')
        
        while time.time() - start_time < timeout:
            try:
                # Check proxy health
                response = requests.get(f"{base_url}/actuator/health", timeout=1)
                if response.status_code == 200:
                    return True
            except:
                pass
            time.sleep(0.5)
        
        return False
    
    def get_healing_data_from_db(self, selector_type: str, selector_value: str, since_time: float) -> Optional[Dict[str, Any]]:
        """
        Check if healing occurred for this selector by:
        1. First check context.last_healed_element (set by log monitoring)
        2. Query Healenium database directly
        3. For known test cases, simulate healing detection
        """
        # First check if we already detected healing via log monitoring
        if hasattr(self.context, 'healing_data') and self.context.healing_data:
            healing_data = self.context.healing_data
            # Check if this healing is recent and matches our selector
            if (time.time() - healing_data['timestamp'] < 5.0 and 
                selector_value in str(healing_data.get('original_selector', {}).get('value', ''))):
                logger.info(f"Using healing data from log monitoring: {healing_data}")
                return healing_data
        
        # Always log what we're checking for
        logger.info(f"Checking for healing: selector_type={selector_type}, selector_value={selector_value}")
        
        if not self.proxy_container:
            return None
            
        try:
            # Try to query Healenium backend database via proxy container
            # The proxy should log healing events when they occur
            
            # Get recent logs (last 5 seconds)
            logs = self.proxy_container.logs(since=int(since_time), stream=False, timestamps=False)
            if not logs:
                return None
                
            logs_str = logs.decode('utf-8', errors='ignore')
            
            # Look for various healing patterns that Healenium might log
            healing_patterns = [
                # Pattern for Healenium proxy healing messages
                r'(?i)success.*?heal.*?(?:from|selector|locator).*?["\']([^"\']+)["\'].*?(?:to|->|healed).*?["\']([^"\']+)["\']',
                r'(?i)healed.*?element.*?(?:from|with).*?["\']([^"\']+)["\'].*?(?:to|using).*?["\']([^"\']+)["\']',
                r'(?i)healing.*?successful.*?["\']([^"\']+)["\'].*?["\']([^"\']+)["\']',
                # Look for POST requests to healing endpoint
                r'POST.*?/healing.*?"locator":\s*"([^"]+)".*?"healedLocator":\s*"([^"]+)"',
            ]
            
            for pattern in healing_patterns:
                matches = re.findall(pattern, logs_str, re.MULTILINE | re.DOTALL)
                for match in matches:
                    if len(match) >= 2:
                        original, healed = match[0], match[1]
                        # Check if this healing is for our selector
                        if selector_value in original or selector_value == original:
                            healing_duration = int((time.time() - since_time) * 1000)
                            
                            # Get current step index if available
                            current_step_index = self.context.counters.get('index', -1) if hasattr(self.context, 'counters') else -1
                            
                            healing_data = {
                                'original_selector': {'type': selector_type, 'value': original},
                                'healed_selector': {'type': selector_type, 'value': healed},
                                'score': 0.95,  # Default high score since healing succeeded
                                'timestamp': time.time(),
                                'healing_duration_ms': healing_duration,
                                'step_index': current_step_index  # Track which step this healing belongs to
                            }
                            
                            # Store in context for later use
                            self.context.healing_data = healing_data
                            logger.info(f"Detected healing from logs for step {current_step_index}: {original} -> {healed}")
                            
                            return healing_data
            
            # If no healing found in logs, check if selector was healed by looking for successful finds
            # after initial failures (this indicates healing occurred)
            if "successfully found" in logs_str.lower() and selector_value in logs_str:
                # Healing likely occurred but wasn't explicitly logged
                logger.debug(f"Possible healing detected for selector: {selector_value}")
                
            return None
            
        except Exception as e:
            logger.debug(f"Error checking healing data: {e}")
            return None
    
    def is_proxy_ready(self) -> bool:
        """Check if the proxy is ready and available"""
        return self.proxy_info is not None and self.proxy_container is not None
    
    def _handle_failed_selector(self, log_str: str, log_state: dict):
        """Parse failed element patterns and log them"""
        failed_match = re.search(r'Failed to find an element using locator By\.(\w+):\s*(.+?)(?:\s|$)', log_str)
        if failed_match:
            log_state['last_failed_type'] = failed_match.group(1).lower()
            log_state['last_failed_selector'] = failed_match.group(2).strip()
            if log_state['last_failed_type'] == 'cssselector':
                log_state['last_failed_type'] = 'css'
            logger.info(f"Healenium: Element not found - {log_state['last_failed_type']}={log_state['last_failed_selector']}")
    
    def _handle_element_request(self, log_str: str, log_state: dict):
        """Parse element find requests with rate limiting"""
        request_match = re.search(r'Find Element Request:\s*\{\"using\":\s*\"([^\"]+)\",\s*\"value\":\s*\"([^\"]+)\"', log_str)
        if request_match:
            req_type_raw = request_match.group(1).lower()
            req_value = request_match.group(2).strip()
            
            # Rate limit repetitive selector logs
            if log_state.get('last_logged_selector') != req_value:
                log_state['last_logged_selector'] = req_value
                logger.debug(f"Healenium: Searching for {req_type_raw}={req_value}")
            
            # Normalize type names
            if req_type_raw in ['css selector', 'cssselector']:
                req_type = 'css'
            elif req_type_raw in ['link text', 'partial link text']:
                req_type = 'link'
            else:
                req_type = req_type_raw.replace(' ', '_')
            
            log_state['last_request_type'] = req_type
            log_state['last_request_selector'] = req_value
    
    def _parse_healing_data(self, match, group_count: int, log_str: str, log_state: dict) -> dict:
        """Extract healing details from regex match"""
        if group_count == 3 and 'Using healed locator' in log_str:
            # Handle exact Healenium format
            score = float(match.group(1))
            type_to = match.group(2).lower()
            value_to = match.group(3)
            
            # Get original selector info
            if log_state.get('last_failed_selector') and log_state.get('last_failed_type'):
                value_from = log_state['last_failed_selector']
                type_from = log_state['last_failed_type']
            elif log_state.get('last_request_selector'):
                value_from = log_state['last_request_selector']
                type_from = log_state.get('last_request_type', 'unknown')
            else:
                value_from = "unknown"
                type_from = "unknown"
            
            logger.info(f"Healenium: Healing success - {type_from}={value_from} -> {type_to}={value_to} (confidence={score})")
        
        elif group_count == 2:
            value_from = match.group(1)
            value_to = match.group(2) if match.lastindex >= 2 else value_from
            score = 0.95
            
            # Try to extract score if present
            score_match = re.search(r'score.*?([\d.]+)', log_str, re.IGNORECASE)
            if score_match:
                score = float(score_match.group(1))
            
            type_from = self._detect_selector_type(value_from)
            type_to = self._detect_selector_type(value_to)
        else:
            return None
        
        current_step_index = self.context.counters.get('index', -1) if hasattr(self.context, 'counters') else -1
        
        return {
            'original_selector': {'type': type_from, 'value': value_from.strip()},
            'healed_selector': {'type': type_to, 'value': value_to.strip()},
            'score': score,
            'timestamp': time.time(),
            'healing_duration_ms': 100,
            'step_index': current_step_index
        }
    
    def _detect_healing_event(self, log_str: str, log_state: dict):
        """Check for healing event patterns and process them"""
        healing_patterns = [
            (r'Using healed locator: Scored\(score=([\d.]+), value=By\.(\w+): (.+)\)', 3),
            (r'Healed locator.*?["\']([^"\']+)["\'].*?to.*?["\']([^"\']+)["\']', 2),
            (r'Successfully healed.*?from.*?["\']([^"\']+)["\'].*?to.*?["\']([^"\']+)["\']', 2),
            (r'Healing completed.*?original:.*?["\']([^"\']+)["\'].*?healed:.*?["\']([^"\']+)["\']', 2),
        ]
        
        for pattern, group_count in healing_patterns:
            match = re.search(pattern, log_str, re.IGNORECASE)
            if match and len(match.groups()) >= group_count:
                try:
                    healing_data = self._parse_healing_data(match, group_count, log_str, log_state)
                    if healing_data:
                        self._store_and_notify(healing_data)
                        return True
                except Exception as e:
                    logger.debug(f"Error parsing healing indicator: {e}")
        return False
    
    def _store_and_notify(self, healing_data: dict):
        """Save healing data and send notifications"""
        self.context.healing_data = healing_data
        
        step_index = healing_data['step_index']
        original = healing_data['original_selector']['value']
        healed = healing_data['healed_selector']['value']
        score = healing_data['score']
        
        logger.info(f"Healenium: Element healed at step {step_index}: {original} -> {healed} (confidence: {score})")
        
        # Send WebSocket notification
        try:
            if hasattr(self.context, 'feature_id') and hasattr(self.context, 'counters'):
                self._send_healing_notification(healing_data, step_index)
        except Exception as e:
            logger.debug(f"Could not send immediate healing notification: {e}")
    
    def _process_log_line(self, log_str: str, log_state: dict):
        """Main dispatcher for processing each log line"""
        # Only log important healing events, not routine find requests
        if any(word in log_str.lower() for word in ['heal', 'score', 'success', 'failed']):
            if 'Find Element Request' not in log_str:
                logger.info(f"Healenium: {log_str[:200]}")
        
        # Handle different types of log entries
        self._handle_failed_selector(log_str, log_state)
        self._handle_element_request(log_str, log_state)
        self._detect_healing_event(log_str, log_state)

    def _start_log_monitoring(self):
        """Start monitoring proxy logs for healing events"""
        def monitor_logs():
            try:
                # Start with empty logs to avoid old entries
                _ = self.proxy_container.logs()
                
                # Initialize state for tracking selectors and healing
                log_state = {
                    'last_failed_selector': None,
                    'last_failed_type': None,
                    'last_logged_selector': None,
                    'last_request_type': None,
                    'last_request_selector': None
                }
                
                for log in self.proxy_container.logs(stream=True, follow=True):
                    if not self.healing_enabled:
                        break
                        
                    log_str = log.decode('utf-8', errors='ignore').strip()
                    
                    # Process each log line through the dispatcher
                    self._process_log_line(log_str, log_state)
                    
            except Exception as e:
                logger.debug(f"Log monitoring error: {e}")
        
        # Start monitoring thread
        self._log_monitor_thread = threading.Thread(target=monitor_logs, daemon=True)
        self._log_monitor_thread.start()
        logger.info(f"Healenium: Monitoring started for {self.proxy_container.name}")
    
    
    def _detect_selector_type(self, selector_value: str) -> str:
        """Detect selector type from value"""
        if selector_value.startswith('#'):
            return 'id'
        elif selector_value.startswith('.'):
            return 'class'
        elif selector_value.startswith('//'):
            return 'xpath'
        elif '=' in selector_value:
            return 'css'
        else:
            return 'id'  # Default for Healenium
    
    def _send_healing_notification(self, healing_data: Dict[str, Any], step_index: int):
        """Send immediate WebSocket notification about healing"""
        try:
            import os
            from utility.config_handler import get_cometa_socket_url
            
            # Format healing info for WebSocket
            healing_info = {
                'step_index': step_index,
                'healing_detected': True,
                'original_selector': f"By.{healing_data['original_selector']['type']}({healing_data['original_selector']['value']})",
                'healed_selector': f"By.{healing_data['healed_selector']['type']}({healing_data['healed_selector']['value']})",
                'confidence_score': int(healing_data['score'] * 100),
                'timestamp': healing_data['timestamp']
            }
            
            # Send via WebSocket
            requests.post(
                f'{get_cometa_socket_url()}/feature/{self.context.feature_id}/healingDetected',
                json={
                    'feature_id': self.context.feature_id,
                    'run_id': os.environ.get('feature_run', 0),
                    'feature_result_id': os.environ.get('feature_result_id', 0),
                    'step_index': step_index,
                    'healing_info': healing_info
                }
            )
            logger.info(f"Healenium: Notification sent for step {step_index}")
        except Exception as e:
            logger.debug(f"Failed to send healing notification: {e}")
    
    def save_healing_to_database(self, healing_data_json, feature_result_id, step_index, step_name, session_id):
        """Save healing data to Cometa database via API call"""
        try:
            import json
            from utility.config_handler import get_cometa_backend_url
            
            healing_info = json.loads(healing_data_json)
            payload = {
                'feature_result_id': int(feature_result_id),
                'step_name': step_name,
                'step_index': step_index,
                'original_selector': healing_info['original_selector'],
                'healed_selector': healing_info['healed_selector'],
                'confidence_score': healing_info['confidence_score'] / 100.0,  # Convert percentage to 0-1 range
                'healing_duration_ms': healing_info.get('healing_duration_ms', 0),
                'healing_session_id': session_id
            }
            response = requests.post(f'{get_cometa_backend_url()}/api/healenium/results/save/', json=payload, headers={'Host': 'cometa.local'})
            if response.status_code == 201:
                logger.debug(f"Successfully saved healing data for step {step_index}")
            else:
                logger.debug(f"Failed to save healing data: {response.status_code} - {response.text}")
        except Exception as e:
            logger.debug(f"Error saving healing data: {e}")
    
    def cleanup(self):
        """Cleanup proxy container"""
        # Stop log monitoring if active
        if hasattr(self, '_log_monitor_thread'):
            self.healing_enabled = False  # Signal thread to stop
            # Note: Thread will stop when container is removed
        
        if self.proxy_container:
            try:
                logger.debug(f"Stopping proxy container: {self.proxy_container.name}")
                self.proxy_container.stop(timeout=5)
                self.proxy_container.remove(force=True)
                logger.debug(f"Cleanup completed for: {self.proxy_container.name}")
            except Exception as e:
                logger.error(f"Error cleaning up proxy: {e}")
        
        self.proxy_info = None
        self.proxy_container = None


@contextmanager
def healenium_context(context):
    """Context manager for Healenium client lifecycle"""
    client = HealeniumClient(context)
    try:
        yield client
    finally:
        client.cleanup()
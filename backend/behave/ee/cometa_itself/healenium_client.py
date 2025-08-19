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
                    "IMITATE_SERVICE": config["selector_imitator_url"],
                    "FIND_ELEMENTS_AUTO_HEALING": str(config.get("find_elements_auto_healing", "true")),
                    "HLM_LOG_LEVEL": config.get("log_level", "info"),
                    "HEALING_TIMEOUT": str(config.get("healing_timeout", "3"))
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
        if hasattr(self.context, 'last_healed_element') and self.context.last_healed_element:
            healing_data = self.context.last_healed_element
            # Check if this healing is recent and matches our selector
            if (time.time() - healing_data['timestamp'] < 5.0 and 
                selector_value in str(healing_data.get('original_selector', {}).get('value', ''))):
                logger.info(f"Using healing data from log monitoring: {healing_data}")
                return healing_data
        
        # Query Healenium database directly
        healing_data = self._query_healenium_database(selector_type, selector_value, since_time)
        if healing_data:
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
                            self.context.last_healed_element = healing_data
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
    
    def _start_log_monitoring(self):
        """Start monitoring proxy logs for healing events"""
        def monitor_logs():
            try:
                # Start with empty logs to avoid old entries
                _ = self.proxy_container.logs()
                
                # Track failed selectors to match with healing
                last_failed_selector = None
                last_failed_type = None
                
                for log in self.proxy_container.logs(stream=True, follow=True):
                    if not self.healing_enabled:
                        break
                        
                    log_str = log.decode('utf-8', errors='ignore').strip()
                    
                    # Log all potential healing-related messages for debugging
                    if any(word in log_str.lower() for word in ['heal', 'selector', 'locator', 'element', 'find', 'success', 'score']):
                        logger.info(f"Healenium log: {log_str[:500]}")
                    
                    # Capture failed selector information (various log formats)
                    failed_match = re.search(r'Failed to find an element using locator By\.(\w+):\s*(.+?)(?:\s|$)', log_str)
                    if failed_match:
                        last_failed_type = failed_match.group(1).lower()
                        last_failed_selector = failed_match.group(2).strip()
                        if last_failed_type == 'cssselector':
                            last_failed_type = 'css'
                        logger.debug(f"Captured failed selector: {last_failed_type}={last_failed_selector}")
                    
                    # Capture selector from request if failure log not produced (proxy 2.x format)
                    request_match = re.search(r'Find Element Request:\s*\{\"using\":\s*\"([^\"]+)\",\s*\"value\":\s*\"([^\"]+)\"', log_str)
                    if request_match:
                        req_type_raw = request_match.group(1).lower()
                        req_value = request_match.group(2).strip()
                        # Normalize type names
                        if req_type_raw in ['css selector', 'cssselector']:
                            req_type = 'css'
                        elif req_type_raw in ['link text', 'partial link text']:
                            req_type = 'link'
                        else:
                            req_type = req_type_raw.replace(' ', '_')  # keep original but safe

                        last_request_type = req_type
                        last_request_selector = req_value
                        logger.debug(f"Captured request selector: {last_request_type}={last_request_selector}")
                    
                    # Check for successful element finds after failures (indicates healing)
                    # Healenium works by intercepting failed finds and returning healed elements
                    if "POST /wd/hub/session" in log_str and "/element" in log_str:
                        # Element find request
                        logger.debug("Element find request detected")
                    
                    # Look for healing indicators in various formats
                    healing_indicators = [
                        # Exact format from Healenium logs
                        (r'Using healed locator: Scored\(score=([\d.]+), value=By\.(\w+): (.+)\)', 3),
                        # Healenium proxy logs when healing occurs
                        (r'Healed locator.*?["\']([^"\']+)["\'].*?to.*?["\']([^"\']+)["\']', 2),
                        (r'Successfully healed.*?from.*?["\']([^"\']+)["\'].*?to.*?["\']([^"\']+)["\']', 2),
                        (r'Healing completed.*?original:.*?["\']([^"\']+)["\'].*?healed:.*?["\']([^"\']+)["\']', 2),
                        # When element is found after healing
                        (r'Found element.*?using.*?selector.*?["\']([^"\']+)["\'].*?healed.*?to.*?["\']([^"\']+)["\']', 2),
                        (r'Element.*?["\']([^"\']+)["\'].*?healed.*?to.*?["\']([^"\']+)["\']', 2),
                        # Healing success messages
                        (r'Healing.*?successful.*?["\']([^"\']+)["\'].*?->.*?["\']([^"\']+)["\']', 2),
                        (r'Self-healing.*?["\']([^"\']+)["\'].*?to.*?["\']([^"\']+)["\']', 2),
                        # Score-based healing
                        (r'Best.*?match.*?["\']([^"\']+)["\'].*?score.*?([\d.]+)', 2),
                    ]
                    
                    for pattern, group_count in healing_indicators:
                        match = re.search(pattern, log_str, re.IGNORECASE)
                        if match and len(match.groups()) >= group_count:
                            try:
                                if group_count == 3 and 'Using healed locator' in log_str:
                                    # Handle the exact Healenium format
                                    score = float(match.group(1))
                                    type_to = match.group(2).lower()  # xpath, css, etc.
                                    value_to = match.group(3)
                                    
                                    # Prefer failed selector; fall back to last request selector
                                    if last_failed_selector and last_failed_type:
                                        value_from = last_failed_selector
                                        type_from = last_failed_type
                                    elif 'last_request_selector' in locals() and last_request_selector:
                                        value_from = last_request_selector
                                        type_from = last_request_type
                                    else:
                                        value_from = "unknown"
                                        type_from = "unknown"
                                    
                                    # Log for debugging
                                    logger.info(f"Parsed healing: {type_from}={value_from} -> {type_to}={value_to} (score={score})")
                                    
                                elif group_count == 2:
                                    value_from = match.group(1)
                                    value_to = match.group(2) if match.lastindex >= 2 else value_from
                                    score = 0.95
                                    
                                    # Try to extract score if present
                                    score_match = re.search(r'score.*?([\d.]+)', log_str, re.IGNORECASE)
                                    if score_match:
                                        score = float(score_match.group(1))
                                    
                                    # Detect selector type from the values
                                    type_from = self._detect_selector_type(value_from)
                                    type_to = self._detect_selector_type(value_to)
                                else:
                                    continue
                                
                                # Get current step index if available
                                current_step_index = self.context.counters.get('index', -1) if hasattr(self.context, 'counters') else -1
                                
                                healing_data = {
                                    'original_selector': {'type': type_from, 'value': value_from.strip()},
                                    'healed_selector': {'type': type_to, 'value': value_to.strip()},
                                    'score': score,
                                    'timestamp': time.time(),
                                    'healing_duration_ms': 100,  # Approximate
                                    'step_index': current_step_index  # Track which step this healing belongs to
                                }
                                
                                # Store in context with step index validation
                                self.context.last_healed_element = healing_data
                                self.context.healing_data = healing_data  # Also store in healing_data
                                logger.info(f"Detected healing for step {current_step_index}: {value_from} -> {value_to} (score: {score})")
                                
                                # Emit healing event immediately via WebSocket
                                try:
                                    if hasattr(self.context, 'feature_id') and hasattr(self.context, 'counters'):
                                        step_index = self.context.counters.get('index', 0)
                                        self._send_healing_notification(healing_data, step_index)
                                except Exception as e:
                                    logger.debug(f"Could not send immediate healing notification: {e}")
                                    
                            except Exception as e:
                                logger.debug(f"Error parsing healing indicator: {e}")
                            
            except Exception as e:
                logger.debug(f"Log monitoring error: {e}")
        
        # Start monitoring thread
        self._log_monitor_thread = threading.Thread(target=monitor_logs, daemon=True)
        self._log_monitor_thread.start()
        logger.debug(f"Started log monitoring for proxy: {self.proxy_container.name}")
    
    def _query_healenium_database(self, selector_type: str, selector_value: str, since_time: float) -> Optional[Dict[str, Any]]:
        """Query Healenium database for healing information"""
        # For now, return None as we rely on log monitoring
        # This could be enhanced to query the Healenium backend API directly
        return None
    
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
            from utility.common import get_cometa_socket_url
            
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
            logger.info(f"Sent immediate healing notification for step {step_index}")
        except Exception as e:
            logger.debug(f"Failed to send healing notification: {e}")
    
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
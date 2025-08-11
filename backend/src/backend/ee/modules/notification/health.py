"""
Health check module for Telegram notification system.

This module provides comprehensive health checks for all components
of the notification system including database, Telegram API, and configuration.
"""

import logging
import time
from typing import Dict, Any, Tuple, List
from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
from django.utils import timezone
from django.conf import settings

from backend.utility.configurations import ConfigurationManager
from .models import TelegramUserLink, TelegramSubscription, FeatureTelegramOptions
import requests

logger = logging.getLogger(__name__)


class HealthCheckStatus:
    """Constants for health check statuses."""
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    UNHEALTHY = "unhealthy"


class ComponentHealth:
    """Health check result for a single component."""
    
    def __init__(self, name: str, status: str, message: str = "", 
                 details: Dict[str, Any] = None, duration_ms: float = 0):
        self.name = name
        self.status = status
        self.message = message
        self.details = details or {}
        self.duration_ms = duration_ms
        self.timestamp = timezone.now()
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON response."""
        return {
            "name": self.name,
            "status": self.status,
            "message": self.message,
            "details": self.details,
            "duration_ms": round(self.duration_ms, 2),
            "timestamp": self.timestamp.isoformat()
        }


class TelegramHealthChecker:
    """Health checker for Telegram notification system."""
    
    def __init__(self):
        self.checks = [
            self.check_database,
            self.check_cache,
            self.check_telegram_api,
            self.check_configuration,
            self.check_models,
            self.check_webhook
        ]
        
    def check_all(self) -> Tuple[str, List[ComponentHealth]]:
        """
        Run all health checks and return overall status and individual results.
        
        Returns:
            Tuple of (overall_status, list_of_component_results)
        """
        results = []
        has_unhealthy = False
        has_degraded = False
        
        for check_func in self.checks:
            try:
                result = check_func()
                results.append(result)
                
                if result.status == HealthCheckStatus.UNHEALTHY:
                    has_unhealthy = True
                elif result.status == HealthCheckStatus.DEGRADED:
                    has_degraded = True
                    
            except Exception as e:
                logger.error(f"Health check {check_func.__name__} failed", exc_info=True)
                results.append(ComponentHealth(
                    name=check_func.__name__.replace("check_", ""),
                    status=HealthCheckStatus.UNHEALTHY,
                    message=f"Check failed: {str(e)}"
                ))
                has_unhealthy = True
        
        # Determine overall status
        if has_unhealthy:
            overall_status = HealthCheckStatus.UNHEALTHY
        elif has_degraded:
            overall_status = HealthCheckStatus.DEGRADED
        else:
            overall_status = HealthCheckStatus.HEALTHY
            
        return overall_status, results
    
    def check_database(self) -> ComponentHealth:
        """Check database connectivity and performance."""
        start_time = time.time()
        
        try:
            # Test database connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            
            # Test model queries
            user_count = TelegramUserLink.objects.filter(is_active=True).count()
            sub_count = TelegramSubscription.objects.count()
            
            duration_ms = (time.time() - start_time) * 1000
            
            # Check performance
            if duration_ms > 1000:
                status = HealthCheckStatus.DEGRADED
                message = "Database response time is slow"
            else:
                status = HealthCheckStatus.HEALTHY
                message = "Database is responding normally"
            
            return ComponentHealth(
                name="database",
                status=status,
                message=message,
                details={
                    "active_users": user_count,
                    "active_subscriptions": sub_count,
                    "response_time_ms": round(duration_ms, 2)
                },
                duration_ms=duration_ms
            )
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ComponentHealth(
                name="database",
                status=HealthCheckStatus.UNHEALTHY,
                message=f"Database error: {str(e)}",
                duration_ms=duration_ms
            )
    
    def check_cache(self) -> ComponentHealth:
        """Check cache connectivity and performance."""
        start_time = time.time()
        test_key = "health_check_test_key"
        test_value = "health_check_test_value"
        
        try:
            # Test cache operations
            cache.set(test_key, test_value, 60)
            retrieved_value = cache.get(test_key)
            cache.delete(test_key)
            
            duration_ms = (time.time() - start_time) * 1000
            
            if retrieved_value != test_value:
                return ComponentHealth(
                    name="cache",
                    status=HealthCheckStatus.UNHEALTHY,
                    message="Cache read/write test failed",
                    duration_ms=duration_ms
                )
            
            # Check performance
            if duration_ms > 100:
                status = HealthCheckStatus.DEGRADED
                message = "Cache response time is slow"
            else:
                status = HealthCheckStatus.HEALTHY
                message = "Cache is working properly"
            
            return ComponentHealth(
                name="cache",
                status=status,
                message=message,
                details={"response_time_ms": round(duration_ms, 2)},
                duration_ms=duration_ms
            )
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ComponentHealth(
                name="cache",
                status=HealthCheckStatus.UNHEALTHY,
                message=f"Cache error: {str(e)}",
                duration_ms=duration_ms
            )
    
    def check_telegram_api(self) -> ComponentHealth:
        """Check Telegram API connectivity."""
        start_time = time.time()
        
        try:
            bot_token = ConfigurationManager.get_configuration("COMETA_TELEGRAM_BOT_TOKEN", None)
            
            if not bot_token:
                return ComponentHealth(
                    name="telegram_api",
                    status=HealthCheckStatus.UNHEALTHY,
                    message="Bot token not configured"
                )
            
            # Test API with getMe endpoint
            url = f"https://api.telegram.org/bot{bot_token}/getMe"
            response = requests.get(url, timeout=5)
            duration_ms = (time.time() - start_time) * 1000
            
            if response.status_code != 200:
                return ComponentHealth(
                    name="telegram_api",
                    status=HealthCheckStatus.UNHEALTHY,
                    message=f"API returned status {response.status_code}",
                    details={"status_code": response.status_code},
                    duration_ms=duration_ms
                )
            
            data = response.json()
            if not data.get("ok"):
                return ComponentHealth(
                    name="telegram_api",
                    status=HealthCheckStatus.UNHEALTHY,
                    message="API returned error",
                    details={"error": data.get("description", "Unknown error")},
                    duration_ms=duration_ms
                )
            
            # Check response time
            if duration_ms > 2000:
                status = HealthCheckStatus.DEGRADED
                message = "Telegram API response is slow"
            else:
                status = HealthCheckStatus.HEALTHY
                message = "Telegram API is accessible"
            
            return ComponentHealth(
                name="telegram_api",
                status=status,
                message=message,
                details={
                    "bot_username": data.get("result", {}).get("username"),
                    "response_time_ms": round(duration_ms, 2)
                },
                duration_ms=duration_ms
            )
            
        except requests.exceptions.Timeout:
            duration_ms = (time.time() - start_time) * 1000
            return ComponentHealth(
                name="telegram_api",
                status=HealthCheckStatus.UNHEALTHY,
                message="Telegram API timeout",
                duration_ms=duration_ms
            )
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ComponentHealth(
                name="telegram_api",
                status=HealthCheckStatus.UNHEALTHY,
                message=f"API check failed: {str(e)}",
                duration_ms=duration_ms
            )
    
    def check_configuration(self) -> ComponentHealth:
        """Check required configuration values."""
        required_configs = [
            "COMETA_TELEGRAM_BOT_TOKEN",
            "COMETA_DOMAIN"
        ]
        
        missing_configs = []
        for config_name in required_configs:
            if not ConfigurationManager.get_configuration(config_name, None):
                missing_configs.append(config_name)
        
        if missing_configs:
            return ComponentHealth(
                name="configuration",
                status=HealthCheckStatus.UNHEALTHY,
                message="Required configuration missing",
                details={"missing": missing_configs}
            )
        
        # Check optional but recommended configs
        optional_configs = [
            "COMETA_TELEGRAM_WEBHOOK_SECRET"
        ]
        
        missing_optional = []
        for config_name in optional_configs:
            if not ConfigurationManager.get_configuration(config_name, None):
                missing_optional.append(config_name)
        
        if missing_optional:
            return ComponentHealth(
                name="configuration",
                status=HealthCheckStatus.DEGRADED,
                message="Optional configuration missing",
                details={"missing_optional": missing_optional}
            )
        
        return ComponentHealth(
            name="configuration",
            status=HealthCheckStatus.HEALTHY,
            message="All required configuration present"
        )
    
    def check_models(self) -> ComponentHealth:
        """Check database models and migrations."""
        try:
            # Test model queries
            TelegramUserLink.objects.exists()
            TelegramSubscription.objects.exists()
            FeatureTelegramOptions.objects.exists()
            
            return ComponentHealth(
                name="models",
                status=HealthCheckStatus.HEALTHY,
                message="All models are accessible"
            )
            
        except Exception as e:
            return ComponentHealth(
                name="models",
                status=HealthCheckStatus.UNHEALTHY,
                message=f"Model check failed: {str(e)}"
            )
    
    def check_webhook(self) -> ComponentHealth:
        """Check webhook configuration."""
        start_time = time.time()
        
        try:
            bot_token = ConfigurationManager.get_configuration("COMETA_TELEGRAM_BOT_TOKEN", None)
            if not bot_token:
                return ComponentHealth(
                    name="webhook",
                    status=HealthCheckStatus.UNHEALTHY,
                    message="Bot token not configured"
                )
            
            # Get webhook info
            url = f"https://api.telegram.org/bot{bot_token}/getWebhookInfo"
            response = requests.get(url, timeout=5)
            duration_ms = (time.time() - start_time) * 1000
            
            if response.status_code != 200:
                return ComponentHealth(
                    name="webhook",
                    status=HealthCheckStatus.UNHEALTHY,
                    message=f"Failed to get webhook info",
                    duration_ms=duration_ms
                )
            
            data = response.json()
            webhook_info = data.get("result", {})
            webhook_url = webhook_info.get("url", "")
            
            if not webhook_url:
                return ComponentHealth(
                    name="webhook",
                    status=HealthCheckStatus.DEGRADED,
                    message="No webhook configured",
                    details={"webhook_url": None},
                    duration_ms=duration_ms
                )
            
            # Check for errors
            last_error = webhook_info.get("last_error_message")
            if last_error:
                return ComponentHealth(
                    name="webhook",
                    status=HealthCheckStatus.DEGRADED,
                    message="Webhook has recent errors",
                    details={
                        "webhook_url": webhook_url,
                        "last_error": last_error,
                        "last_error_date": webhook_info.get("last_error_date")
                    },
                    duration_ms=duration_ms
                )
            
            return ComponentHealth(
                name="webhook",
                status=HealthCheckStatus.HEALTHY,
                message="Webhook is configured",
                details={
                    "webhook_url": webhook_url,
                    "pending_update_count": webhook_info.get("pending_update_count", 0),
                    "has_custom_certificate": webhook_info.get("has_custom_certificate", False)
                },
                duration_ms=duration_ms
            )
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            return ComponentHealth(
                name="webhook",
                status=HealthCheckStatus.UNHEALTHY,
                message=f"Webhook check failed: {str(e)}",
                duration_ms=duration_ms
            )


def health_check_view(request):
    """
    Health check endpoint for monitoring.
    
    Returns JSON with overall status and individual component statuses.
    Returns 200 for healthy/degraded, 503 for unhealthy.
    """
    checker = TelegramHealthChecker()
    overall_status, results = checker.check_all()
    
    response_data = {
        "status": overall_status,
        "timestamp": timezone.now().isoformat(),
        "components": [result.to_dict() for result in results]
    }
    
    # Return 503 if unhealthy for monitoring tools
    status_code = 503 if overall_status == HealthCheckStatus.UNHEALTHY else 200
    
    return JsonResponse(response_data, status=status_code)


def liveness_check_view(request):
    """
    Simple liveness check for Kubernetes/container orchestration.
    
    Returns 200 if the application is running.
    """
    return JsonResponse({"status": "alive", "timestamp": timezone.now().isoformat()})


def readiness_check_view(request):
    """
    Readiness check for Kubernetes/container orchestration.
    
    Checks if the application is ready to serve requests.
    """
    try:
        # Quick database check
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        
        # Quick cache check
        cache.set("readiness_check", "ok", 10)
        cache.get("readiness_check")
        
        return JsonResponse({
            "status": "ready",
            "timestamp": timezone.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Readiness check failed: {str(e)}")
        return JsonResponse({
            "status": "not_ready",
            "error": str(e),
            "timestamp": timezone.now().isoformat()
        }, status=503)
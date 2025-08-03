"""
Custom exceptions and error handling for the notification module.

This module provides comprehensive error handling for all notification-related
operations, including Telegram webhook processing, subscriptions, and message sending.
"""

import logging
import traceback
from typing import Optional, Dict, Any
from django.http import JsonResponse
from django.conf import settings

logger = logging.getLogger(__name__)


class NotificationError(Exception):
    """Base exception for all notification-related errors."""
    
    def __init__(self, message: str, code: str = "NOTIFICATION_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(message)
        self.code = code
        self.details = details or {}
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert exception to dictionary for JSON response."""
        return {
            "error": str(self),
            "code": self.code,
            "details": self.details
        }


class TelegramError(NotificationError):
    """Base exception for Telegram-specific errors."""
    
    def __init__(self, message: str, code: str = "TELEGRAM_ERROR", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, code, details)


class AuthenticationError(TelegramError):
    """Raised when authentication fails."""
    
    def __init__(self, message: str = "Authentication failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AUTH_ERROR", details)


class AuthorizationError(TelegramError):
    """Raised when user lacks required permissions."""
    
    def __init__(self, message: str = "Permission denied", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "AUTHZ_ERROR", details)


class ValidationError(TelegramError):
    """Raised when input validation fails."""
    
    def __init__(self, message: str = "Validation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "VALIDATION_ERROR", details)


class RateLimitError(TelegramError):
    """Raised when rate limits are exceeded."""
    
    def __init__(self, message: str = "Rate limit exceeded", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "RATE_LIMIT_ERROR", details)


class WebhookError(TelegramError):
    """Raised when webhook processing fails."""
    
    def __init__(self, message: str = "Webhook processing failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "WEBHOOK_ERROR", details)


class SubscriptionError(TelegramError):
    """Raised when subscription operations fail."""
    
    def __init__(self, message: str = "Subscription operation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "SUBSCRIPTION_ERROR", details)


class MessageSendError(TelegramError):
    """Raised when sending messages fails."""
    
    def __init__(self, message: str = "Failed to send message", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "MESSAGE_SEND_ERROR", details)


class DatabaseError(NotificationError):
    """Raised when database operations fail."""
    
    def __init__(self, message: str = "Database operation failed", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "DATABASE_ERROR", details)


class ConfigurationError(NotificationError):
    """Raised when configuration is missing or invalid."""
    
    def __init__(self, message: str = "Configuration error", details: Optional[Dict[str, Any]] = None):
        super().__init__(message, "CONFIG_ERROR", details)


def handle_notification_error(func):
    """
    Decorator for comprehensive error handling in notification views.
    
    This decorator:
    - Catches all exceptions
    - Logs detailed error information
    - Returns appropriate HTTP responses
    - Ensures sensitive information is not exposed
    """
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except NotificationError as e:
            # Log the error with appropriate level
            if isinstance(e, (AuthenticationError, AuthorizationError)):
                logger.warning(f"{e.code}: {str(e)}", extra={"details": e.details})
            else:
                logger.error(f"{e.code}: {str(e)}", extra={"details": e.details})
            
            # Return appropriate response
            response_data = {
                "success": False,
                "error": str(e),
                "code": e.code
            }
            
            # Include details only in debug mode
            if settings.DEBUG:
                response_data["details"] = e.details
            
            # Determine HTTP status code
            status_map = {
                "AUTH_ERROR": 401,
                "AUTHZ_ERROR": 403,
                "VALIDATION_ERROR": 400,
                "RATE_LIMIT_ERROR": 429,
                "NOT_FOUND": 404,
            }
            status = status_map.get(e.code, 400)
            
            return JsonResponse(response_data, status=status)
            
        except Exception as e:
            # Log unexpected errors with full traceback
            logger.error(
                f"Unexpected error in {func.__name__}: {str(e)}",
                exc_info=True,
                extra={
                    "function": func.__name__,
                    "source_module": func.__module__,
                    "traceback": traceback.format_exc()
                }
            )
            
            # Return generic error response
            response_data = {
                "success": False,
                "error": "An unexpected error occurred"
            }
            
            # Include detailed error only in debug mode
            if settings.DEBUG:
                response_data["debug_error"] = str(e)
                response_data["traceback"] = traceback.format_exc()
            
            return JsonResponse(response_data, status=500)
    
    return wrapper


class ErrorContext:
    """
    Context manager for error handling with cleanup.
    
    Usage:
        with ErrorContext("Processing notification", cleanup_func):
            # Code that might raise exceptions
            pass
    """
    
    def __init__(self, operation: str, cleanup_func=None):
        self.operation = operation
        self.cleanup_func = cleanup_func
        
    def __enter__(self):
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is not None:
            logger.error(
                f"Error during {self.operation}: {exc_val}",
                exc_info=True,
                extra={
                    "operation": self.operation,
                    "exception_type": exc_type.__name__,
                    "exception": str(exc_val)
                }
            )
            
            # Run cleanup if provided
            if self.cleanup_func:
                try:
                    self.cleanup_func()
                except Exception as cleanup_error:
                    logger.error(
                        f"Error during cleanup for {self.operation}: {cleanup_error}",
                        exc_info=True
                    )
        
        # Don't suppress the exception
        return False


def validate_required_fields(data: Dict[str, Any], required_fields: list, field_types: Optional[Dict[str, type]] = None):
    """
    Validate required fields in data dictionary.
    
    Args:
        data: Dictionary to validate
        required_fields: List of required field names
        field_types: Optional dictionary mapping field names to expected types
    
    Raises:
        ValidationError: If validation fails
    """
    missing_fields = [field for field in required_fields if field not in data or data[field] is None]
    if missing_fields:
        raise ValidationError(
            f"Missing required fields: {', '.join(missing_fields)}",
            details={"missing_fields": missing_fields}
        )
    
    if field_types:
        type_errors = {}
        for field, expected_type in field_types.items():
            if field in data and data[field] is not None:
                if not isinstance(data[field], expected_type):
                    type_errors[field] = {
                        "expected": expected_type.__name__,
                        "actual": type(data[field]).__name__
                    }
        
        if type_errors:
            raise ValidationError(
                "Field type validation failed",
                details={"type_errors": type_errors}
            )


def safe_int_conversion(value: Any, field_name: str, min_value: Optional[int] = None, max_value: Optional[int] = None) -> int:
    """
    Safely convert a value to integer with validation.
    
    Args:
        value: Value to convert
        field_name: Name of the field (for error messages)
        min_value: Optional minimum value
        max_value: Optional maximum value
    
    Returns:
        Converted integer value
    
    Raises:
        ValidationError: If conversion or validation fails
    """
    try:
        int_value = int(value)
    except (TypeError, ValueError):
        raise ValidationError(
            f"Invalid {field_name}: must be an integer",
            details={field_name: value}
        )
    
    if min_value is not None and int_value < min_value:
        raise ValidationError(
            f"Invalid {field_name}: must be at least {min_value}",
            details={field_name: int_value, "min_value": min_value}
        )
    
    if max_value is not None and int_value > max_value:
        raise ValidationError(
            f"Invalid {field_name}: must be at most {max_value}",
            details={field_name: int_value, "max_value": max_value}
        )
    
    return int_value
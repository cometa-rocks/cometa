from django.db import models
from backend.models import Feature
import datetime

from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError
from django.utils import timezone

class FeatureTelegramOptions(models.Model):
    """
    Telegram notification configuration options for features
    Separated from Feature model to keep it clean and follow single responsibility principle
    """
    id = models.AutoField(primary_key=True)
    feature = models.OneToOneField(Feature, on_delete=models.CASCADE, related_name='telegram_options')
    
    # Message content options
    include_department = models.BooleanField(default=False, help_text="Include department name in notification")
    include_application = models.BooleanField(default=False, help_text="Include application name in notification")
    include_environment = models.BooleanField(default=False, help_text="Include environment name in notification")
    include_feature_name = models.BooleanField(default=False, help_text="Include feature name in notification")
    include_datetime = models.BooleanField(default=False, help_text="Include execution date and time in notification")
    include_execution_time = models.BooleanField(default=False, help_text="Include execution duration in notification")
    include_browser_timezone = models.BooleanField(default=False, help_text="Include browser timezone information in notification")
    include_browser = models.BooleanField(default=False, help_text="Include browser information (e.g., Chrome 136, Edge 135) in notification")
    include_overall_status = models.BooleanField(default=False, help_text="Include overall test status in notification")
    include_step_results = models.BooleanField(default=False, help_text="Include step-by-step results in notification")
    include_pixel_diff = models.BooleanField(default=False, help_text="Include pixel difference information in notification")
    include_feature_url = models.BooleanField(default=False, help_text="Include feature URL link in notification")
    include_failed_step_details = models.BooleanField(default=False, help_text="Include detailed information about failed steps in notification")
    
    # Override global settings options
    override_telegram_settings = models.BooleanField(default=False, help_text="Override global Telegram settings for this feature")
    override_bot_token = models.TextField(null=True, blank=True, help_text="Override bot token for this feature only")
    override_chat_ids = models.TextField(null=True, blank=True, help_text="Override chat IDs for this feature (comma-separated)")
    override_message_thread_id = models.IntegerField(null=True, blank=True, help_text="Send to specific thread in group chat")
    
    # Attachment options
    attach_pdf_report = models.BooleanField(default=False, help_text="Attach PDF test report to notification")
    attach_screenshots = models.BooleanField(default=False, help_text="Attach step screenshots to notification")
    
    # Custom message and send conditions
    custom_message = models.TextField(null=True, blank=True, help_text="Custom message to include at the top of notification")
    send_on_error = models.BooleanField(default=False, help_text="Send notification only when test fails")
    do_not_use_default_template = models.BooleanField(default=False, help_text="When enabled, only send the custom message (no default template)")
    
    # Maximum notifications on error settings
    check_maximum_notification_on_error_telegram = models.BooleanField(default=False, help_text="Enable maximum number of Telegram notifications on errors")
    maximum_notification_on_error_telegram = models.IntegerField(default=3, validators=[MinValueValidator(1)], help_text="Maximum number of Telegram notifications to send on consecutive errors")
    number_notification_sent_telegram = models.IntegerField(default=0, validators=[MinValueValidator(0)], help_text="Current count of consecutive Telegram notifications sent on errors")
    
    # Timestamps
    created_on = models.DateTimeField(default=timezone.now, editable=True, null=False, blank=False)
    updated_on = models.DateTimeField(default=timezone.now, editable=True, null=False, blank=False)
    
    def save(self, *args, **kwargs):
        self.updated_on = timezone.now()
        return super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Telegram options for {self.feature.feature_name}"
    
    class Meta:
        ordering = ['feature__feature_name']
        verbose_name_plural = "Feature Telegram Options"


class TelegramSubscription(models.Model):
    """
    Stores Telegram chat subscriptions for automated notifications
    Links authenticated users to their Telegram chat IDs with proper access control
    """
    id = models.AutoField(primary_key=True)
    user_id = models.IntegerField(help_text="User ID from session authentication")
    chat_id = models.CharField(max_length=50, help_text="Telegram chat ID for notifications")
    feature_id = models.IntegerField(help_text="Feature ID user has access to")
    department_id = models.IntegerField(help_text="Department ID for access validation")
    environment_id = models.IntegerField(help_text="Environment ID for access validation")
    
    # Subscription settings
    is_active = models.BooleanField(default=True, help_text="Whether subscription is active")
    notification_types = models.JSONField(default=list, help_text="Types of notifications to send (e.g., ['on_failure', 'on_success'])")
    
    # Metadata
    created_on = models.DateTimeField(default=timezone.now, editable=True, null=False, blank=False)
    updated_on = models.DateTimeField(default=timezone.now, editable=True, null=False, blank=False)
    last_notification_sent = models.DateTimeField(null=True, blank=True, help_text="Last time a notification was sent")
    
    def save(self, *args, **kwargs):
        self.updated_on = timezone.now()
        return super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Telegram subscription for user {self.user_id} - chat {self.chat_id}"
    
    class Meta:
        ordering = ['-created_on']
        verbose_name_plural = "Telegram Subscriptions"
        unique_together = ['user_id', 'chat_id', 'feature_id']


class TelegramUserLink(models.Model):
    """
    Links Telegram chat IDs to authenticated Cometa users via GitLab OAuth
    Stores authentication tokens and user information for secure access
    """
    id = models.AutoField(primary_key=True)
    user_id = models.IntegerField(db_index=True, help_text="User ID from OIDCAccount")
    chat_id = models.CharField(max_length=50, unique=True, help_text="Telegram chat ID")
    
    # Telegram user info
    username = models.CharField(max_length=255, null=True, blank=True, help_text="Telegram username if available")
    first_name = models.CharField(max_length=255, null=True, blank=True, help_text="Telegram first name")
    last_name = models.CharField(max_length=255, null=True, blank=True, help_text="Telegram last name")
    
    # GitLab OAuth user info
    gitlab_username = models.CharField(max_length=255, null=True, blank=True, help_text="GitLab username")
    gitlab_email = models.CharField(max_length=255, null=True, blank=True, help_text="GitLab email")
    gitlab_name = models.CharField(max_length=255, null=True, blank=True, help_text="GitLab full name")
    
    # Authentication tokens
    auth_token = models.CharField(max_length=255, null=True, blank=True, help_text="Temporary authentication token")
    auth_token_expires = models.DateTimeField(null=True, blank=True, help_text="Authentication token expiration")
    
    # Status and verification
    is_active = models.BooleanField(default=True, help_text="Whether the link is active")
    is_verified = models.BooleanField(default=False, help_text="Whether the link has been verified via GitLab OAuth")
    
    # Metadata
    created_on = models.DateTimeField(default=timezone.now, editable=True, null=False, blank=False)
    updated_on = models.DateTimeField(default=timezone.now, editable=True, null=False, blank=False)
    last_interaction = models.DateTimeField(null=True, blank=True, help_text="Last time user interacted with bot")
    last_auth_attempt = models.DateTimeField(null=True, blank=True, help_text="Last authentication attempt")
    
    def save(self, *args, **kwargs):
        self.updated_on = timezone.now()
        return super().save(*args, **kwargs)
    
    def is_auth_token_valid(self):
        """Check if the authentication token is still valid"""
        if not self.auth_token or not self.auth_token_expires:
            return False
        return timezone.now() < self.auth_token_expires
    
    def generate_auth_token(self):
        """Generate a new authentication token"""
        import secrets
        self.auth_token = secrets.token_urlsafe(32)
        self.auth_token_expires = timezone.now() + timezone.timedelta(minutes=5)
        self.save()
        return self.auth_token
    
    def clear_auth_token(self):
        """Clear the authentication token"""
        self.auth_token = None
        self.auth_token_expires = None
        self.save()
    
    def __str__(self):
        return f"User {self.user_id} ({self.gitlab_username or 'unverified'}) -> Chat {self.chat_id}"
    
    class Meta:
        ordering = ['-created_on']
        verbose_name_plural = "Telegram User Links"

from django.db import models
from backend.models import Feature
import datetime

from django.core.validators import MinValueValidator, MaxValueValidator
from django.core.exceptions import ValidationError


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
    
    # Attachment options
    attach_pdf_report = models.BooleanField(default=False, help_text="Attach PDF test report to notification")
    attach_screenshots = models.BooleanField(default=False, help_text="Attach step screenshots to notification")
    
    # Custom message and send conditions
    custom_message = models.TextField(null=True, blank=True, help_text="Custom message to include at the top of notification")
    send_on_error = models.BooleanField(default=False, help_text="Send notification only when test fails")
    
    # Maximum notifications on error settings
    check_maximum_notification_on_error_telegram = models.BooleanField(default=False, help_text="Enable maximum number of Telegram notifications on errors")
    maximum_notification_on_error_telegram = models.IntegerField(default=3, validators=[MinValueValidator(1)], help_text="Maximum number of Telegram notifications to send on consecutive errors")
    number_notification_sent_telegram = models.IntegerField(default=0, validators=[MinValueValidator(0)], help_text="Current count of consecutive Telegram notifications sent on errors")
    
    # Timestamps
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    updated_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    
    def save(self, *args, **kwargs):
        self.updated_on = datetime.datetime.utcnow()
        return super().save(*args, **kwargs)
    
    def __str__(self):
        return f"Telegram options for {self.feature.feature_name}"
    
    class Meta:
        ordering = ['feature__feature_name']
        verbose_name_plural = "Feature Telegram Options"

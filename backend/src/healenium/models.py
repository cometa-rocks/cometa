from django.db import models
from django.utils import timezone


class HealeniumResult(models.Model):
    """
    Stores healing events that occurred during test execution.
    This model tracks when Healenium successfully healed a broken selector.
    """
    id = models.AutoField(primary_key=True)
    feature_result = models.ForeignKey(
        'backend.Feature_result', 
        on_delete=models.CASCADE, 
        related_name="healenium_results"
    )
    step_result = models.ForeignKey(
        'backend.Step_result', 
        on_delete=models.CASCADE, 
        related_name="healenium_result", 
        null=True, 
        blank=True
    )
    step_name = models.TextField()
    step_index = models.IntegerField()
    original_selector = models.TextField()
    healed_selector = models.TextField()
    selector_type_from = models.CharField(max_length=50)  # e.g., "cssSelector", "xpath"
    selector_type_to = models.CharField(max_length=50)
    confidence_score = models.FloatField()  # 0.0 to 1.0
    healing_duration_ms = models.IntegerField()
    healing_session_id = models.CharField(max_length=255)  # Selenium session ID
    created_date = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name_plural = "Healenium Results"
        ordering = ['-created_date']
        indexes = [
            models.Index(fields=['feature_result', 'step_index']),
            models.Index(fields=['healing_session_id']),
            models.Index(fields=['created_date']),
        ]
    
    def __str__(self):
        return f"HealeniumResult #{self.id}"
    
    @property
    def feature_name(self):
        """Get the feature name from the related feature_result"""
        try:
            if self.feature_result:
                return self.feature_result.feature_name
            return "Unknown"
        except AttributeError:
            return "Unknown"
    
    @property
    def feature_id(self):
        """Get the feature ID from the related feature_result"""
        try:
            if self.feature_result and hasattr(self.feature_result, 'feature_id'):
                return self.feature_result.feature_id.feature_id
            return None
        except AttributeError:
            return None

from django.db import models
from backend.models import OIDCAccount


class HouseKeepingLogs(models.Model):
    id = models.AutoField(primary_key=True)
    created_on = models.DateTimeField(auto_now_add=True, editable=False, null=False, blank=False)
    success = models.BooleanField(default=False)
    list_files_to_clean = models.JSONField(default=list, null = True, blank=True)
    house_keeping_logs =  models.JSONField(default=list, null=True, blank=True)
    approved_by = models.ForeignKey(OIDCAccount, blank=True,null=True, on_delete=models.CASCADE, help_text='Log deletion approved by User')
    class Meta:
        ordering = ['created_on']
        verbose_name_plural = "HouseKeepingLogs"

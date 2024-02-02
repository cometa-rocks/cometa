# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from backend.models import (
    SoftDeletableModel,
    Department,
    Feature_result
)
from django.db import models
from datetime import datetime


class ResponseHeaders(SoftDeletableModel):
    id = models.AutoField(primary_key=True)
    result_id = models.OneToOneField(Feature_result, related_name="result_id", on_delete=models.CASCADE,
                                          blank=False, null=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, blank=False)
    vulnerable_headers_info = models.JSONField(default=list)
    created_on = models.DateTimeField(default=datetime.utcnow, editable=True, null=False, blank=False,
                                      help_text='When was created')
    headers_count = models.IntegerField(default=0)

    class Meta:
        verbose_name_plural = "ResponseHeaders"

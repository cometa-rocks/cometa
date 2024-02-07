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

# This Model contains all the network reponse which was received while receiving response
class ResponseHeaders(SoftDeletableModel):
    id = models.AutoField(primary_key=True)
    result_id = models.OneToOneField(Feature_result, related_name="result_id", on_delete=models.CASCADE,
                                          blank=False, null=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE, blank=False)
    responses = models.JSONField(default=list)
    network_response_count = models.IntegerField(default=0)
    vulnerable_response_count = models.IntegerField(default=0)
    created_on = models.DateTimeField(default=datetime.utcnow, editable=True, null=False, blank=False,
                                      help_text='When was created')

    class Meta:
        verbose_name_plural = "ResponseHeaders"

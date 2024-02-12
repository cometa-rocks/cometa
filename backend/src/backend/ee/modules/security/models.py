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
                                      help_text='When it was created')

    class Meta:
        verbose_name_plural = "ResponseHeaders"

class VulnerableHeader(models.Model):
    id = models.AutoField(primary_key=True)
    header_name = models.CharField(blank=False, null=False, max_length=30)
    # A value or value pattern which can be vulnerable as the value of this header.
    vulnerable_values = models.JSONField(default=list)
    # This will store links or blogs reporting the reported vulnerability. In case it is necessary to show the user on the screen why this is considered a vulnerability.
    reasons_of_vulnerabiltiy = models.JSONField(default=list)
    created_on = models.DateTimeField(default=datetime.utcnow, editable=True, null=False, blank=False,
                                      help_text='When it was created')

    class Meta:
        verbose_name_plural = "VulnerableHeaders"
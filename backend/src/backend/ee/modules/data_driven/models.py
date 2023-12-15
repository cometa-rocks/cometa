# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from backend.models import (
    SoftDeletableModel,
    Feature_result
)
from django.db import models
from datetime import datetime

class DataDriven_Runs(SoftDeletableModel):
    run_id = models.AutoField(primary_key=True)
    file = models.ForeignKey("File", on_delete=models.SET_NULL, null=True, related_name="ddr_file")
    feature_results = models.ManyToManyField(Feature_result)
    date_time = models.DateTimeField(default=datetime.utcnow, editable=True, null=False, blank=False)
    archived = models.BooleanField(default=False)
    status = models.CharField(max_length=100, default='')
    total = models.IntegerField(default=0)
    fails = models.IntegerField(default=0)
    ok = models.IntegerField(default=0)
    skipped = models.IntegerField(default=0)
    execution_time = models.IntegerField(default=0)
    pixel_diff = models.BigIntegerField(default=0)
    
    class Meta:
        ordering = ['-date_time']
        verbose_name_plural = "Data Driven Runs"
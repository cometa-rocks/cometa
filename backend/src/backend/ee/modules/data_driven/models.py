# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from backend.models import (
    SoftDeletableModel,
    Feature_result,
    OIDCAccount
)
from django.db import models
from django.utils import timezone

class DataDriven_Runs(SoftDeletableModel):
    run_id = models.AutoField(primary_key=True)
    file = models.ForeignKey("File", on_delete=models.SET_NULL, null=True, related_name="ddr_file")
    feature_results = models.ManyToManyField(Feature_result)
    date_time = models.DateTimeField(default=timezone.now, editable=True, null=False, blank=False)
    archived = models.BooleanField(default=False)
    status = models.CharField(max_length=100, default='')
    running = models.BooleanField(default=False)
    total = models.IntegerField(default=0)
    fails = models.IntegerField(default=0)
    ok = models.IntegerField(default=0)
    skipped = models.IntegerField(default=0)
    execution_time = models.IntegerField(default=0)
    pixel_diff = models.BigIntegerField(default=0)
    # File lock identifier for preventing concurrent execution on the same file
    lock_identifier = models.CharField(max_length=255, null=True, blank=True, 
                                     help_text="Unique identifier for the file lock during DDT execution")
    # User who initiated this DDT run (for proper budget checks and permissions)
    initiated_by = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, null=True, blank=True, 
                                   related_name="initiated_ddr_runs",
                                   help_text="User who initiated this data-driven test run")
    
    class Meta:
        ordering = ['-date_time']
        verbose_name_plural = "Data Driven Runs"
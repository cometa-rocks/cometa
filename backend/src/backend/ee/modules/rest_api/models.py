from backend.models import (
    SoftDeletableModel,
    Department
)
from django.db import models
from datetime import datetime
from django_cryptography.fields import encrypt

class REST_API(SoftDeletableModel):
    id = models.AutoField(primary_key=True)
    department = models.ForeignKey(Department, on_delete=models.CASCADE)
    call = encrypt(models.JSONField(default=dict))
    created_on = models.DateTimeField(default=datetime.utcnow, editable=True, null=False, blank=False, help_text='When was created')

    class Meta:
        verbose_name_plural = "REST APIs"
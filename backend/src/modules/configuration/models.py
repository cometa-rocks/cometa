from django.db import models

# Create your models here.
from django.db import models
from backend.models import OIDCAccount
from django.core.exceptions import ValidationError
import datetime
from backend.utility.encryption import encrypt

class Configuration(models.Model):
    id = models.AutoField(primary_key=True)
    configuration_name = models.CharField(max_length=100, default=None, blank=False, null=False, unique=True)
    configuration_value = models.TextField(default="")
    default_value = models.TextField(default="",blank=True)
    encrypted = models.BooleanField(default=False)
    can_be_deleted = models.BooleanField(default=False)
    can_be_edited = models.BooleanField(default=False)
    created_by = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, related_name="create_by_user", null=True)
    updated_by = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, related_name="update_by_user", null=True)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=False, null=False, blank=False)
    updated_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=False, null=False, blank=False)
    
    def save(self, *args, **kwargs):
        if not self.can_be_edited and self.id:
            raise ValidationError(f'{self.configuration_name} configuration can not be edited')  
            
        self.updated_on = datetime.datetime.utcnow()
        if self.encrypted:
            self.configuration_value = encrypt(self.configuration_value)
        
        return super(Configuration, self).save(*args, **kwargs)
    
    class Meta:
        ordering = ['configuration_name']
        verbose_name_plural = "Configurations"

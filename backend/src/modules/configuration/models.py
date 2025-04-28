# author : Anand Kushwaha
# version : 10.0.0
# date : 2024-08-09

from django.db import models

# Create your models here.
from django.db import models
from backend.models import OIDCAccount
from django.core.exceptions import ValidationError
import datetime, os, requests
from backend.utility.encryption import encrypt
from backend.utility.configurations import ConfigurationManager
from backend.utility.config_handler import get_cometa_behave_url
from backend.utility.functions import getLogger

configuration_type_choices = (
    ('all','all'), # configuration holing type = all will be visible to all services of cometa 
    ('backend','backend'), # configuration holing type = backend will be only used in only backend services
)

logger = getLogger()
class Configuration(models.Model):
    id = models.AutoField(primary_key=True)
    configuration_name = models.CharField(max_length=100, default=None, blank=False, null=False, unique=True)
    configuration_value = models.TextField(default="")
    default_value = models.TextField(default="",blank=True)
    encrypted = models.BooleanField(default=False)
    configuration_type = models.CharField(choices=configuration_type_choices ,max_length=30, default='backend', blank=False)
    can_be_deleted = models.BooleanField(default=False)
    can_be_edited = models.BooleanField(default=False)
    created_by = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, related_name="create_by_user", null=True)
    updated_by = models.ForeignKey(OIDCAccount, on_delete=models.SET_NULL, related_name="update_by_user", null=True)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=False, null=False, blank=False)
    updated_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=False, null=False, blank=False)
    
    def save(self, *args, **kwargs):            
        self.updated_on = datetime.datetime.utcnow()
        if self.encrypted:
            self.configuration_value = encrypt(self.configuration_value)
        
        return_data = super(Configuration, self).save(*args, **kwargs)
        # Refresh configuration from memory
        conf = ConfigurationManager()
        conf.create_db_connection() 
        conf.load_configuration_from_db()
        logger.info("Updating the configuration in the behave")
        requests.get(f'{get_cometa_behave_url()}/update_configurations')
        return return_data
    
    class Meta:
        ordering = ['configuration_name']
        verbose_name_plural = "Configurations"

    def __str__(self) -> str:
        return self.configuration_name
    
# Define the parent directory for file uploads
PARENT_DIR = '/code/config/'

def validate_safe_path(value):
    """
    Validates the given path to ensure it resides within the allowed parent directory.
    """
    full_path = os.path.abspath(os.path.join(PARENT_DIR, value.strip('/')))
    if not full_path.startswith(PARENT_DIR):
        raise ValidationError("Invalid path: Detected path traversal attempt.")
    return full_path

def validate_file_size(file):
    """Validates that the file size does not exceed 5 MB."""
    max_size_mb = 5
    if file.size > max_size_mb * 1024 * 1024:
        raise ValidationError(f"File size cannot exceed {max_size_mb} MB.")

class ConfigurationFile(models.Model):
    name = models.CharField(max_length=100)  # Name field
    file_name = models.CharField(max_length=50,blank=False, default="")  # Name field
    path = models.CharField(
        max_length=150,
        help_text="Specify the relative path under '/code/config/'.",
    )  # Path field
    file = models.FileField(upload_to="config", blank=True, null=True)  # Optional file field

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        """
        Override the save method to automatically save the file to the given path.
        """
        if self.file:
            # Validate file size
            validate_file_size(self.file)

            # Validate and construct the full save path
            sanitized_path = validate_safe_path(self.path)
            os.makedirs(sanitized_path, exist_ok=True)  # Ensure the directory exists

            # Save the file to the sanitized path
            file_path = os.path.join(sanitized_path, self.file_name)
            with open(file_path, 'wb') as destination:
                for chunk in self.file.chunks():
                    destination.write(chunk)
            # Update the file field with the new file path (relative to MEDIA_ROOT)
            self.file = None

        # Call the original save method
        super().save(*args, **kwargs)


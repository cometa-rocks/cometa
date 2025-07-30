# author : Anand Kushwaha
# version : 10.0.0
# date : 2024-10-14

from django.db import models
from backend.models import OIDCAccount, File
from .service_manager import ServiceManager
from backend.ee.modules.mobile.models import Mobile
from django.core.exceptions import ValidationError
from django.db.models import UniqueConstraint
from threading import Thread
from datetime import datetime
from backend.utility.functions import getLogger

logger = getLogger()



# File Status
service_type = (
    (
        "Emulator",
        "Emulator",
    ),
    (
        "Browser",
        "Browser",
    ),
)

# File Status
service_status = (
    (
        "Running",
        "Running",
    ),
    (
        "Deleting",
        "Deleting",
    ),
    (
        "Stopped",
        "Stopped",
    )
)


# This models keeps track of containers created by user i.e. android emulators and any other container
class ContainerService(models.Model):
    id = models.AutoField(primary_key=True)
    image = models.ForeignKey(
        Mobile, blank=True, on_delete=models.DO_NOTHING, null=True, default=None
    )  # mobile_id
    image_name =  models.CharField(max_length=50,blank=True, null=True, default="")# mobile_id
    image_version =models.CharField(max_length=15, blank=True, null=True,default="") # mobile_id
    in_use =models.BooleanField(default=False) # mobile_id
    since_in_use = models.DateTimeField(blank=True, null=True, default=None)
    service_id = models.TextField(blank=False, unique=True)
    service_status = models.CharField(
        choices=service_status, max_length=15, default="Running"
    )
    service_type = models.CharField(
        choices=service_type, max_length=15, default="Emulator"
    )
    information = models.JSONField(default=dict, null=False, blank=False)
    # Installed apk files
    apk_file = models.ManyToManyField(File, blank=True)
    shared = models.BooleanField(default=False)
    created_on = models.DateTimeField(
        auto_now_add=True, editable=False, null=False, blank=False
    )
    created_by = models.ForeignKey(
        OIDCAccount,
        on_delete=models.SET_NULL,
        null=True,
        default=None,
        related_name="container_created_by",
    )
    department_id = models.IntegerField(default=1)
    labels = models.JSONField(default=dict, null=False, blank=False)
    devices_time_zone = models.CharField(max_length=50, blank=True, null=True, default="")

    class Meta:
        ordering = ["created_on"]
        verbose_name_plural = "ContainerServices"
        # unique_together = ('image', 'created_by')
        constraints = [
            UniqueConstraint(fields=['image', 'created_by'], name='unique_image_created_by')
        ]

    
    def __str__(self) -> str:
        return f"{self.id} {self.created_by}"
    
    def save(self, *args, **kwargs):
        service_manager = ServiceManager()

        if self.in_use:
            self.since_in_use = datetime.now()
        
        if not self.id:
            if self.service_type == "Emulator":
                # Perform delete and return true
                image = self.image.mobile_json["image"]
                service_manager.prepare_emulator_service_configuration(image=image)
            else:
                image = f"{self.image_name}:{self.image_version}"
                service_manager.prepare_browser_service_configuration(
                    browser=self.image_name,
                    version=self.image_version,
                    labels=self.labels if self.labels else {},
                    devices_time_zone=self.devices_time_zone if self.devices_time_zone else '',
                )
            try:
                service_details = service_manager.create_service()
                if "error" in service_details:
                    raise ValidationError(service_details["error"])
                self.service_id = service_details["Id"]
                self.service_status = "Running"
                self.information = service_details
            except Exception as e:
                service_id = service_details.get("Id", None)
                if service_id:
                    service_manager.delete_service(service_name_or_id=service_id)
                logger.error(f"Failed to create container: {e}")
                raise ValidationError(f"Failed to create container: {e}")
            return super(ContainerService, self).save()

        else:
            if kwargs.get("action", "") == "restart":
                result, message = service_manager.restart_service(
                    service_name_or_id=self.service_id
                )
                if result:
                    self.service_details = service_manager.inspect_service(self.service_id)
                    self.service_status = "Running"
                    return super(ContainerService, self).save()

            elif kwargs.get("action", "") == "stop":
                result, message = service_manager.stop_service(
                    service_name_or_id=self.service_id
                )
                if result:
                    self.service_details = service_manager.inspect_service(self.service_id)
                    self.service_status = "Stopped"
                    return super(ContainerService, self).save()

            if "shared" in kwargs and kwargs["shared"] is not None:
                print("Updating share")
                self.shared = kwargs["shared"]
                return super(ContainerService, self).save()

            if "apk_file" in kwargs and kwargs["apk_file"] is not None:
                file = File.objects.get(id=kwargs["apk_file"])
                file_name = service_manager.upload_file( 
                    service_name_or_id=self.service_id, file_path=file.path
                )
                if not file_name:
                    raise ValidationError("Failed to upload file")
                result, message = service_manager.install_apk(
                    service_name_or_id=self.service_id, apk_file_name=file_name
                )
                if result:
                    self.apk_file.add(kwargs["apk_file"])
                    return super(ContainerService, self).save()
                else:
                    raise ValidationError(message)
                
            return super(ContainerService, self).save()
                    

    def delete(self, *args, **kwargs):
        # Store the service_id before deletion for async processing
        service_id = self.service_id
        
        # Perform the database deletion first
        super(ContainerService, self).delete()
        
        # Run service deletion in background thread to avoid blocking
        def delete_service_async():
            try:
                service_manager = ServiceManager()
                result, message = service_manager.delete_service(
                    service_name_or_id=service_id
                )
                if not result:
                    logger.warning(f"Failed to delete service {service_id}: {message}")
                else:
                    logger.info(f"Successfully deleted service {service_id}")
            except Exception as e:
                logger.error(f"Error deleting service {service_id}: {e}")
        
        # Start background thread for service deletion
        thread = Thread(target=delete_service_async, daemon=True)
        thread.start()
        
        return True

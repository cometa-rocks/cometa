from django.db import models
from backend.models import OIDCAccount, File
from .service_manager import ServiceManager
from backend.ee.modules.mobile.models import Mobile
from django.core.exceptions import ValidationError
from django.db.models import UniqueConstraint
# File Status
from backend.utility.functions import getLogger

logger = getLogger()

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
        "Stopped",
        "Stopped",
    ),
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
    service_id = models.TextField(blank=False, unique=True)
    service_status = models.CharField(
        choices=service_status, max_length=15, default="Exited"
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
        if not self.id:
            if service_type == "Emulator":
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
                
            service_details = service_manager.create_service()
            logger.debug(service_details)
            self.service_id = service_details["Id"]
            self.service_status = "Running"
            self.information = service_details["information"]
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

            if kwargs.get("shared", "") != "":
                print("Updating share")
                self.shared = kwargs.get("shared")
                return super(ContainerService, self).save()

            if kwargs.get("apk_file", "") != "":
                file = File.objects.get(id=kwargs["apk_file"])
                file_name = service_manager.upload_file(
                    service_name_or_id=self.service_id, file_path=file.path
                )
                if not file_name:
                    raise ValidationError(message)
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
        service_manager = ServiceManager()
        result, message = service_manager.delete_service(
            service_name_or_id=self.service_id
        )
        if not result:
            return False
        # Perform delete and return true
        super(ContainerService, self).delete()
        return True

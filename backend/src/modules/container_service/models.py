from django.db import models
from backend.models import OIDCAccount
from .service_manager import ServiceManager


# File Status
service_type = (
    ('Emulator', 'Emulator',),
    ('Browser', 'Browser',),
)

# File Status
service_status = (
    ('Running', 'Running',),
    ('Exited', 'Exited',),
)


# This models keeps track of containers created by user i.e. android emulators and any other container
class ContainerService(models.Model):
    id = models.AutoField(primary_key=True)
    container_image = models.CharField(max_length=250, blank=False)
    service_id = models.TextField(blank=False,unique=True)
    service_status = models.CharField(choices=service_status, max_length=15, default="Exited", )
    service_type = models.CharField(choices=service_type, max_length=15, default="Emulator", )
    information = models.JSONField(default=dict, null=False, blank=False)
    user = models.ForeignKey(
        OIDCAccount,
        blank=False,
        null=True,
        on_delete=models.CASCADE,
        help_text="User started this service",
    )
    created_on = models.DateTimeField(
        auto_now_add=True, editable=False, null=False, blank=False
    )

    class Meta:
        ordering = ["created_on"]
        verbose_name_plural = "ContainerServices"
        
    def save(self, *args, **kwargs):
        
        if not self.id:             
            # Perform delete and return true
            service_manager = ServiceManager()
            service_manager.prepare_emulator_service_configuration(image=self.container_image)
            service_details = service_manager.create_service()
            self.service_id = service_details["Id"]
            self.service_status = "Running"
            self.information = service_details
            super(ContainerService, self).save()
            return {"success": True}
        
        else:
            if kwargs.get('action',"")=="restart":
                service_manager = ServiceManager()
                result, message  = service_manager.restart_service(service_name_or_id=self.service_id)
                if result:
                    self.service_status = "Running"
                    super(ContainerService, self).save()
                return {"success": result, "message": message}
                
            elif kwargs.get('action',"")=="stop":
                service_manager = ServiceManager()
                result, message = service_manager.stop_service(service_name_or_id=self.service_id)   
                if result:         
                    self.service_status = "Exited"
                    super(ContainerService, self).save()
                return {"success": result, "message": message}
            
    def delete(self, *args, **kwargs):
        service_manager = ServiceManager()
        result, message = service_manager.delete_service(service_name_or_id=self.service_id)
        if not result:
            return False
        # Perform delete and return true
        super(ContainerService, self).delete()
        return True
from django.db import models


class Mobile(models.Model):
    mobile_id = models.AutoField(primary_key=True)
    mobile_image_name = models.CharField(max_length=50, unique=True, null=False, blank=False,default="Android_12.0_API31_x86_64")
    mobile_json = models.JSONField(default=dict)
    capabilities = models.JSONField(default=dict)
    def __str__( self ):
        return f"Name={self.mobile_image_name} DN={self.mobile_json['deviceName']}"
    class Meta:
        ordering = ['mobile_id']

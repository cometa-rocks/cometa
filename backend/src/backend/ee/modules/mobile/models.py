from django.db import models


class Mobile(models.Model):
    mobile_id = models.AutoField(primary_key=True)
    mobile_json = models.JSONField(default=dict)
    def __str__( self ):
        return f"Name={self.mobile_json['image']}, API={self.mobile_json['api_level']} DN={self.mobile_json['deviceName']}"
    class Meta:
        ordering = ['mobile_id']

# author : Anand Kushwaha
# version : 10.0.0
# date : 2024-07-11

from .models import HouseKeepingLogs
from rest_framework import serializers

class HouseKeepingLogsSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = HouseKeepingLogs
        fields = '__all__'
        extra_kwargs = {
            'list_files_to_clean': {'required': False},
            'house_keeping_logs': {'required': False},
        }

    
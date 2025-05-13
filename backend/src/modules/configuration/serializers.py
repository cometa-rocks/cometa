# author : Anand Kushwaha
# version : 10.0.0
# date : 2024-08-09
 
from .models import Configuration
from rest_framework import serializers

class ConfigurationSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Configuration
        fields = '__all__'
        extra_kwargs = {
            'configuration_value': {'required': False},
            'default_value': {'required': False},
            'configuration_type': {'required': False},
        }

    
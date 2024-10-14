from .models import ContainerService
from rest_framework import serializers

class ContainerServiceSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = ContainerService
        fields = '__all__'
        # fields = ['id','container_image', 'service_id', 'service_type']
        extra_kwargs = {
            'container_image': {'required': False},
            'service_id': {'required': False},
            'service_type': {'required': False},
            'information': {'required': False},
            'user': {'required': False},
        }

    
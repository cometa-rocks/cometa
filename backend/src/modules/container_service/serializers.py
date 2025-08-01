# author : Anand Kushwaha
# version : 10.0.0
# date : 2024-10-14

from .models import ContainerService
from rest_framework import serializers
from backend.utility.functions import getLogger

logger = getLogger()


class ContainerServiceSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    capabilities = serializers.JSONField(source='image.capabilities', read_only=True)
    hostname = serializers.CharField(source='information.Config.Hostname', read_only=True)
    running = serializers.BooleanField(source='information.State.Running', read_only=True)
    image_name = serializers.CharField(required=False)
    
    class Meta:
        model = ContainerService
        # fields = '__all__'
        fields = ['id', 'image', 'service_id','image_name','image_version', 'service_type', 'service_status', 'shared','apk_file', 'created_by', 'created_on',
                  'hostname', 'labels','capabilities','running','department_id', 'created_by_name', 'in_use' ]
        extra_kwargs = {
            'image': {'required': False},
            'service_id': {'required': False},
            'image_name': {'required': False},
            'image_version': {'required': False},
            'service_type': {'required': True},
            'information': {'required': False},
            'created_by': {'required': True},
            'shared': {'required': True},
            'apk_file': {'required': False},
            'department_id': {'required': False},
        }

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        # Compute image_name for output
        if instance.image is not None:
            rep['image_name'] = getattr(instance.image, 'mobile_image_name', None)
        else:
            rep['image_name'] = instance.image_name
        return rep

    def update(self, instance, validated_data):
        # Handle APK installation separately
        if 'apk_file' in validated_data:
            apk_id = validated_data.pop('apk_file')
            # Call the model's save method with apk_file as kwargs
            instance.save(apk_file=apk_id)
        
        # Handle shared status separately
        if 'shared' in validated_data:
            shared = validated_data.pop('shared')
            instance.save(shared=shared)
        
        # Handle other fields normally
        return super().update(instance, validated_data)
    
    # def create(self, validated_data):
    #     if 'container_image' not in validated_data or not validated_data['container_image']:
    #         raise serializers.ValidationError({"container_image": "This field is required."})
    #     return super().create(validated_data)
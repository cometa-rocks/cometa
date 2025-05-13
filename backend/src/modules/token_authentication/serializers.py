# author : Anand Kushwaha
# version : 10.0.0
# date : 2025-03-07

from .models import OIDCUserAppSecret
from rest_framework import serializers

class OIDCUserAppSecretSerializer(serializers.ModelSerializer):
    secret_id = serializers.CharField(source='secret_id', read_only=True)
    
    class Meta:
        model = OIDCUserAppSecret
        fields = '__all__'
        fields = ['token_id','name', 'secret_id', 'last_used']
        extra_kwargs = {
            'name': {'required': True},
            'token_id': {'required': False},
            'secret_id': {'required': False},
            'last_used': {'required': False},
        }

    # def create(self, validated_data):
    #     if 'container_image' not in validated_data or not validated_data['container_image']:
    #         raise serializers.ValidationError({"container_image": "This field is required."})
    #     return super().create(validated_data)
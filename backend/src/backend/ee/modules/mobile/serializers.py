from .models import Mobile
from rest_framework import serializers

class MobileSerializer(serializers.ModelSerializer):
    
    class Meta:
        model = Mobile
        fields = '__all__'
        extra_kwargs = {
            'mobile_json': {'required': True},
            'capabilities': {'required': True}
        }

    
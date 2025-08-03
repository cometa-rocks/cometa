from .models import FeatureTelegramOptions
from rest_framework import serializers

class FeatureTelegramOptionsSerializer(serializers.ModelSerializer):
    """
    Serializer for FeatureTelegramOptions model
    """
    class Meta:
        model = FeatureTelegramOptions
        fields = '__all__'
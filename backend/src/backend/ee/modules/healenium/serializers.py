from rest_framework import serializers
from .models import HealeniumResult
from backend.common import datetimeTZFormat


class HealeniumResultSerializer(serializers.ModelSerializer):
    created_date = serializers.DateTimeField(format=datetimeTZFormat)
    confidence_percentage = serializers.SerializerMethodField()
    healing_method = serializers.SerializerMethodField()
    
    class Meta:
        model = HealeniumResult
        fields = [
            'id', 'step_name', 'step_index', 'original_selector', 'healed_selector',
            'selector_type_from', 'selector_type_to', 'confidence_score', 
            'confidence_percentage', 'healing_duration_ms', 'healing_session_id',
            'created_date', 'healing_method'
        ]
    
    def get_confidence_percentage(self, obj):
        """Convert confidence score to percentage"""
        return int(obj.confidence_score * 100)
    
    def get_healing_method(self, obj):
        """Return the healing method used"""
        # For now, return a default value
        # In the future, this could be stored in the model
        return "Score-based Tree Comparison"
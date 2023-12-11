# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from rest_framework import serializers
from .models import (
    REST_API
)
import json

################################
# Rest API model serializers #
################################
class RESTAPISerializer(serializers.ModelSerializer):
    call = serializers.SerializerMethodField()
    class Meta:
        model = REST_API
        fields = '__all__'
        depth = 0
    
    def get_call(self, instance):
        if type(instance.call) == dict:
            return instance.call
        return json.loads(instance.call)
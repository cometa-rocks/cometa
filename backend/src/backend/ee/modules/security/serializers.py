# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from rest_framework import serializers
from .models import ResponseHeaders
from backend.views import GetUserDepartments


################################
# Network Response Headers model serializers #
################################
class ResponseHeadersSerializer(serializers.ModelSerializer):
    # Allow to send data as json from another model object

    class Meta:
        model = ResponseHeaders
        # This fields also shows in the Django Rest Framework screen
        fields = ['id', 'feature_result', 'department', 
                  'vulnerable_headers_info', 'headers_count','created_on']

    def validate(self, data):
        departments = GetUserDepartments(self.context['request'])
        if data.get('department') not in departments:
            raise serializers.ValidationError("You do not belong to this department")
        return data
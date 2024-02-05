# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from rest_framework import serializers
from .models import ResponseHeaders
from backend.models import Department


################################
# Network Response Headers model serializers #
################################
class ResponseHeadersSerializer(serializers.ModelSerializer):
    # Allow to send data as json from another model object

    class Meta:
        model = ResponseHeaders
        # This fields also shows in the Django Rest Framework screen
        fields = ['id', 'result_id',
                  'vulnerable_headers_info', 'headers_count', 'created_on']

    def validate(self, data):
        if data.get('result_id'):
            department = Department.objects.get(department_id=data.get('result_id').department_id)
            data['department'] = department
        return data

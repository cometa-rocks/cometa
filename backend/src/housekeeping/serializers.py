from .models import HouseKeepingLogs

class HouseKeepingLogsSerializer:
    
    class Meta:
        model = HouseKeepingLogs
        fields = [
            'created_on',
            'id',
            'success',
            'execution_time',
            'list_files_to_clean',
            'house_keeping_logs',
            'approved_by'
        ]
        extra_kwargs = {
            'list_files_to_clean': {'required': False},
            'house_keeping_logs': {'required': False},
        }

    
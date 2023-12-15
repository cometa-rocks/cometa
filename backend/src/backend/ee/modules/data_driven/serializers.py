# ###
# Sponsored by Mercedes-Benz AG, Stuttgart
# ###

from backend.models import (
    Feature_Runs
)
from backend.serializers import (
    FileSerializer
)
from backend.common import (
    datetimeTZFormat
)
from rest_framework import serializers


######################################
# Data Driven Runs model serializers #
######################################
class DataDrivenRunsSerializer(serializers.ModelSerializer):

    # feature_results = FeatureResultSerializer(many=True, read_only=True)
    run_id = serializers.IntegerField(read_only=True)
    is_removed = serializers.BooleanField(read_only=True)
    archived = serializers.BooleanField(read_only=True)
    status = serializers.CharField(read_only=True)
    total = serializers.IntegerField(read_only=True)
    fails = serializers.IntegerField(read_only=True)
    ok = serializers.IntegerField(read_only=True)
    skipped = serializers.IntegerField(read_only=True)
    execution_time = serializers.IntegerField(read_only=True)
    pixel_diff = serializers.IntegerField(read_only=True)
    file = FileSerializer(read_only=True)
    date_time = serializers.DateTimeField(format=datetimeTZFormat, read_only=True)

    class Meta:
        model = Feature_Runs
        fields = (
            "run_id",
            "is_removed",
            "archived",
            "status",
            "total",
            "fails",
            "ok",
            "skipped",
            "execution_time",
            "pixel_diff",
            "file",
            "date_time",
            # "feature_results"
        )
        # extra_fields = ['feature_results']
        # exclude = ["feature_results"]
    
    @staticmethod
    def setup_eager_loading(queryset):
        #select_related for 'to-one' relationships
        queryset = queryset.select_related('file')

        #prefetch_related for 'to-many' relationships
        queryset = queryset.prefetch_related('feature_results')

        return queryset
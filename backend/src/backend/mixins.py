from django.db.models.query import QuerySet
from django.db.models import Prefetch, OuterRef, Subquery, ForeignKey, CASCADE
from .models import *
from pprint import pprint
class FeatureMixin():
    @classmethod
    def fast_loader(cls, queryset:QuerySet):
        queryset = queryset.select_related(
            'last_edited', 
            'created_by',
            'last_edited__user_permissions',
            'created_by__user_permissions',
            'info'
        )
        """ .prefetch_related(
            Prefetch(
                'feature_results',
                queryset=Feature_result.objects.extra(where=['"backend_feature_result"."feature_result_id" IN (SELECT max(feature_result_id) OVER (PARTITION BY feature_id_id) FROM backend_feature_result)']).order_by('-feature_result_id'),
                to_attr='info'
            )
        ) """
        return queryset

class FeatureRunsMixin():
    @classmethod
    def fast_loader(cls, queryset:QuerySet):
        queryset = queryset.prefetch_related(
            Prefetch(
                'feature_results',
                queryset=Feature_result.available_objects.all().order_by('-feature_result_id'),
                to_attr='results'
            )
        ).select_related(
            'feature'
        )
        return queryset

class VariablesMixin():
    @classmethod
    def fast_loader(cls, queryset:QuerySet):
        queryset = queryset.select_related(
            'department',
            'environment',
            'feature',
            'updated_by',
            'created_by'
        )
        return queryset

class FolderFeatureMixin():
    @classmethod
    def fast_loader(cls, queryset:QuerySet):
        queryset = queryset.select_related(
            'folder',
            'feature'
        )
        return queryset

class FolderMixin():
    @classmethod
    def fast_loader(cls, queryset:QuerySet):
        queryset = queryset.prefetch_related(
            Prefetch(
                'child',
                queryset=Folder.objects.all(),
                to_attr='childs'
            )
        )
        return queryset
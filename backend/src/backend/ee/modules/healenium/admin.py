from django.contrib import admin
from .models import HealeniumResult


@admin.register(HealeniumResult)
class HealeniumResultAdmin(admin.ModelAdmin):
    list_display = ['id', 'step_name', 'confidence_score', 'created_date']
    list_filter = ['created_date']
    search_fields = ['step_name']
    
    # Use raw_id_fields to avoid loading related objects in dropdowns
    raw_id_fields = ['feature_result', 'step_result']
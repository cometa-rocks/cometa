from django.contrib import admin
from .models import ResponseHeaders


# Register your models here.
@admin.register(ResponseHeaders)
class ResponseHeadersAdmin(admin.ModelAdmin):
    # By adding this you will a filter field added in right of admin panel
    list_filter = ['id', 'result_id']
    # By adding this you will see the search option in the admin panel
    search_fields = ['id', 'result_id', 'headers_count']

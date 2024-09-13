from django.contrib import admin
from .models import *


class ConfigurationAdmin(admin.ModelAdmin):
    model = Configuration
    search_fields = ['id','configuration_name','created_by','updated_by']
    list_display = ('id', 'configuration_name','encrypted','can_be_deleted','can_be_edited','created_by','updated_by','created_on','updated_on')
    list_filter = ('encrypted',)
    readonly_fields = ('created_by', 'updated_by','created_on','updated_on')

admin.site.register(Configuration, ConfigurationAdmin)

from django.contrib import admin
from .models import *

@admin.register(Configuration)
class ConfigurationAdmin(admin.ModelAdmin):
    model = Configuration
    search_fields = ['id','configuration_name']
    list_display = ('id', 'configuration_name','configuration_type','encrypted','can_be_deleted','can_be_edited','created_by','updated_by','created_on','updated_on')
    list_filter = ('encrypted','configuration_type')
    readonly_fields = ('created_by', 'updated_by','created_on','updated_on')


@admin.register(ConfigurationFile)
class ConfigurationFilesAdmin(admin.ModelAdmin):
    list_display = ('name', 'file_name','path')  # Columns displayed in the admin list view
    list_filter = ('path',)  # Enable filtering by the 'path' field
    search_fields = ('name', 'file_name','path')  # Enable searching by 'name' and 'path'

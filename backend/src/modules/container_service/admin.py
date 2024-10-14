from django.contrib import admin
from .models import ContainerService

class ContainerServiceAdmin(admin.ModelAdmin):
    model = ContainerService
    search_fields = ['id', 'service_id', 'service_type', 'information']
    list_display = ('id', 'service_id', 'service_type', 'created_on')
    list_filter = ('service_id','service_type',)
    readonly_fields = ('service_id', 'information','created_on')

admin.site.register(ContainerService, ContainerServiceAdmin)

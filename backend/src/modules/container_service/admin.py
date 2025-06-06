# author : Anand Kushwaha
# version : 10.0.0
# date : 2024-10-14

from django.contrib import admin
from .models import ContainerService

class ContainerServiceAdmin(admin.ModelAdmin):
    model = ContainerService
    search_fields = ['id', 'service_id', 'service_type', 'information']
    list_display = ('id', 'image','created_by','shared','service_status', 'created_on')
    list_filter = ('image','created_by','service_type',)
    readonly_fields = ('service_id', 'information','created_on')

admin.site.register(ContainerService, ContainerServiceAdmin)

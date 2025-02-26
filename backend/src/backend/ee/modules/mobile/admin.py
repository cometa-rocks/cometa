from django.contrib import admin
from .models import Mobile

class MobileAdmin(admin.ModelAdmin):
    model = Mobile
    search_fields = ['id', 'mobile_id', 'mobile_json']

admin.site.register(Mobile, MobileAdmin)

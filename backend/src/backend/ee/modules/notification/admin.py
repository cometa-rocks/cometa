from django.contrib import admin
from .models import FeatureTelegramOptions

class FeatureTelegramOptionsAdmin(admin.ModelAdmin):
    model = FeatureTelegramOptions
    # search_fields = ['id', 'mobile_id', 'mobile_json']

admin.site.register(FeatureTelegramOptions, FeatureTelegramOptionsAdmin)

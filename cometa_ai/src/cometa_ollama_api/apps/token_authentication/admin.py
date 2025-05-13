from django.contrib import admin
from .models import OIDCUserAppSecret

# @admin.register(OIDCUserAppSecret)
class OIDCUserAppSecretAdmin(admin.ModelAdmin):
    model = OIDCUserAppSecret
    search_fields = ['token_id','name', 'secret_id']
    exclude = ('secret_id', 'secret_key')  # Excludes from form
    list_display = ('token_id','name', 'secret_id', 'secret_key','created_on', 'last_used')
    readonly_fields = ('created_on', 'last_used')  # Optional: Prevents editing

admin.site.register(OIDCUserAppSecret, OIDCUserAppSecretAdmin)

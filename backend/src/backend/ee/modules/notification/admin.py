from django.contrib import admin
from .models import FeatureTelegramOptions, TelegramSubscription, TelegramUserLink

class FeatureTelegramOptionsAdmin(admin.ModelAdmin):
    model = FeatureTelegramOptions
    # search_fields = ['id', 'mobile_id', 'mobile_json']

class TelegramSubscriptionAdmin(admin.ModelAdmin):
    model = TelegramSubscription
    list_display = ['id', 'user_id', 'chat_id', 'feature_id', 'department_id', 'environment_id', 'is_active', 'created_on']
    list_filter = ['is_active', 'department_id', 'environment_id', 'created_on']
    search_fields = ['user_id', 'chat_id', 'feature_id']
    readonly_fields = ['created_on', 'updated_on', 'last_notification_sent']
    fieldsets = (
        ('Subscription Info', {
            'fields': ('user_id', 'chat_id', 'feature_id', 'department_id', 'environment_id')
        }),
        ('Settings', {
            'fields': ('is_active', 'notification_types')
        }),
        ('Timestamps', {
            'fields': ('created_on', 'updated_on', 'last_notification_sent'),
            'classes': ('collapse',)
        })
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).order_by('-created_on')

class TelegramUserLinkAdmin(admin.ModelAdmin):
    model = TelegramUserLink
    list_display = ['id', 'user_id', 'chat_id', 'gitlab_username', 'gitlab_email', 'is_active', 'is_verified', 'created_on']
    list_filter = ['is_active', 'is_verified', 'created_on']
    search_fields = ['user_id', 'chat_id', 'username', 'first_name', 'last_name', 'gitlab_username', 'gitlab_email']
    readonly_fields = ['created_on', 'updated_on', 'last_interaction', 'last_auth_attempt', 'auth_token_expires']
    fieldsets = (
        ('User Link Info', {
            'fields': ('user_id', 'chat_id')
        }),
        ('Telegram Info', {
            'fields': ('username', 'first_name', 'last_name')
        }),
        ('GitLab Info', {
            'fields': ('gitlab_username', 'gitlab_email', 'gitlab_name')
        }),
        ('Authentication', {
            'fields': ('auth_token', 'auth_token_expires'),
            'classes': ('collapse',)
        }),
        ('Status', {
            'fields': ('is_active', 'is_verified')
        }),
        ('Timestamps', {
            'fields': ('created_on', 'updated_on', 'last_interaction', 'last_auth_attempt'),
            'classes': ('collapse',)
        })
    )
    
    def get_queryset(self, request):
        return super().get_queryset(request).order_by('-created_on')

admin.site.register(FeatureTelegramOptions, FeatureTelegramOptionsAdmin)
admin.site.register(TelegramSubscription, TelegramSubscriptionAdmin)
admin.site.register(TelegramUserLink, TelegramUserLinkAdmin)

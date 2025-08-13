from .models import FeatureTelegramOptions, TelegramSubscription, TelegramUserLink
from rest_framework import serializers
from django.core.validators import MinValueValidator, MaxValueValidator
import re


class FeatureTelegramOptionsSerializer(serializers.ModelSerializer):
    """
    Serializer for FeatureTelegramOptions model with comprehensive validation.
    """
    class Meta:
        model = FeatureTelegramOptions
        fields = '__all__'
        
    def validate_override_bot_token(self, value):
        """Validate bot token format if provided."""
        if value and not re.match(r'^\d+:[A-Za-z0-9_-]+$', value):
            raise serializers.ValidationError(
                "Invalid bot token format. Expected format: 123456:ABC-DEF..."
            )
        return value
    
    def validate_override_chat_ids(self, value):
        """Validate chat IDs format."""
        if value:
            chat_ids = value.split(',')
            for chat_id in chat_ids:
                chat_id = chat_id.strip()
                if not chat_id:
                    continue
                if not re.match(r'^-?\d+$', chat_id):
                    raise serializers.ValidationError(
                        f"Invalid chat ID format: {chat_id}. Must be a number."
                    )
        return value
    
    def validate_maximum_notification_on_error_telegram(self, value):
        """Ensure maximum notifications is reasonable."""
        if value < 1 or value > 100:
            raise serializers.ValidationError(
                "Maximum notifications must be between 1 and 100."
            )
        return value


class TelegramNotificationRequestSerializer(serializers.Serializer):
    """
    Serializer for telegram notification request validation.
    """
    feature_result_id = serializers.IntegerField(
        required=True,
        min_value=1,
        error_messages={
            'required': 'feature_result_id parameter is required',
            'invalid': 'feature_result_id must be a valid integer',
            'min_value': 'feature_result_id must be positive'
        }
    )


class TelegramWebhookUpdateSerializer(serializers.Serializer):
    """
    Serializer for Telegram webhook update validation.
    """
    update_id = serializers.IntegerField(required=True)
    message = serializers.DictField(required=False)
    callback_query = serializers.DictField(required=False)
    
    def validate(self, data):
        """Ensure at least one update type is present."""
        if not data.get('message') and not data.get('callback_query'):
            raise serializers.ValidationError(
                "Update must contain either a message or callback_query"
            )
        return data


class TelegramAuthRequestSerializer(serializers.Serializer):
    """
    Serializer for Telegram authentication request validation.
    """
    chat_id = serializers.CharField(
        required=True,
        max_length=50,
        error_messages={
            'required': 'chat_id is required',
            'max_length': 'chat_id is too long'
        }
    )
    
    def validate_chat_id(self, value):
        """Validate chat ID format."""
        if not re.match(r'^-?\d+$', value):
            raise serializers.ValidationError("Invalid chat ID format")
        return value


class TelegramSubscriptionSerializer(serializers.ModelSerializer):
    """
    Serializer for TelegramSubscription with validation.
    """
    notification_types = serializers.ListField(
        child=serializers.ChoiceField(
            choices=['on_success', 'on_failure', 'on_error', 'always']
        ),
        default=['on_failure', 'on_success']
    )
    
    class Meta:
        model = TelegramSubscription
        fields = [
            'id', 'user_id', 'chat_id', 'feature_id', 'department_id',
            'environment_id', 'is_active', 'notification_types',
            'created_on', 'updated_on', 'last_notification_sent'
        ]
        read_only_fields = ['id', 'created_on', 'updated_on']
        
    def validate_chat_id(self, value):
        """Validate chat ID format."""
        if not re.match(r'^-?\d+$', value):
            raise serializers.ValidationError("Invalid chat ID format")
        return value
    
    def validate(self, data):
        """Validate subscription data consistency."""
        # Ensure user has access to the feature/department
        # This would be implemented based on your permission system
        return data


class TelegramUserLinkSerializer(serializers.ModelSerializer):
    """
    Serializer for TelegramUserLink with validation.
    """
    class Meta:
        model = TelegramUserLink
        fields = [
            'id', 'user_id', 'chat_id', 'username', 'first_name',
            'last_name', 'gitlab_username', 'gitlab_email', 'gitlab_name',
            'is_active', 'is_verified', 'created_on', 'updated_on',
            'last_interaction', 'last_auth_attempt'
        ]
        read_only_fields = [
            'id', 'auth_token', 'auth_token_expires', 'created_on', 'updated_on'
        ]
        
    def validate_chat_id(self, value):
        """Validate chat ID format."""
        if not re.match(r'^-?\d+$', value):
            raise serializers.ValidationError("Invalid chat ID format")
        return value
    
    def validate_gitlab_email(self, value):
        """Validate email format if provided."""
        if value:
            from django.core.validators import validate_email
            try:
                validate_email(value)
            except Exception:
                raise serializers.ValidationError("Invalid email format")
        return value


class SetWebhookSerializer(serializers.Serializer):
    """
    Serializer for set webhook request validation.
    """
    url = serializers.URLField(
        required=True,
        error_messages={
            'required': 'Webhook URL is required',
            'invalid': 'Invalid URL format'
        }
    )
    secret_token = serializers.CharField(
        required=False,
        min_length=8,
        max_length=256,
        error_messages={
            'min_length': 'Secret token must be at least 8 characters',
            'max_length': 'Secret token is too long'
        }
    )
    
    def validate_url(self, value):
        """Ensure webhook URL is HTTPS in production."""
        if not value.startswith('https://') and not value.startswith('http://localhost'):
            raise serializers.ValidationError(
                "Webhook URL must use HTTPS (except for localhost)"
            )
        return value
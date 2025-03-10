from django.db import models
from backend.models import OIDCAccount, Permissions
from django.core.exceptions import ValidationError
from django.core.validators import MinLengthValidator
from django.db.models import UniqueConstraint
import datetime
import secrets
import string

class OIDCUserAppSecret(models.Model):
    token_id = models.AutoField(primary_key=True, auto_created=True)
    secret_id = models.CharField(
        max_length=50, 
        unique=True
    )
    secret_key = models.CharField(
        max_length=250
    )
    name = models.CharField(max_length=100)
    oidc_account = models.ForeignKey(OIDCAccount, on_delete=models.CASCADE, null=False, blank=False)
    created_on = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    last_used = models.DateTimeField(default=datetime.datetime.utcnow, editable=True, null=False, blank=False)
    failed_count = models.IntegerField(default=0, help_text="+1 on each failed login.")

    class Meta:
        ordering = ["created_on"]
        verbose_name_plural = "OIDCUserAppSecrets"
        constraints = [
            UniqueConstraint(fields=['oidc_account', 'name'], name='unique_secret_name')
        ]

    def __str__(self) -> str:
        return f"{self.secret_id} {self.oidc_account}"

    def generate_secret_id(self):
        """Generate a unique secret_id with at least 30 characters."""
        while True:
            secret_id = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(40))
            if not OIDCUserAppSecret.objects.filter(secret_id=secret_id).exists():
                return secret_id

    def generate_secret_key(self):
        """Generate a secure secret_key with at least 50 characters."""
        return secrets.token_urlsafe(112)[:230]  # Generate a 50-character secure key

    def save(self, *args, **kwargs):
        """Overrides the save method to auto-generate secret_id and secret_key."""
        if not self.name.strip():
            raise ValidationError("Name cannot be empty")

        # Ensure secret_id and secret_key are automatically generated if missing
        if not self.secret_id:
            self.secret_id = self.generate_secret_id()
        if not self.secret_key:
            self.secret_key = self.generate_secret_key()

        super().save(*args, **kwargs)

    # def delete(self, *args, **kwargs):
    #     service_manager = ServiceManager()
    #     result, message = service_manager.delete_service(
    #         service_name_or_id=self.service_id
    #     )
    #     if not result:
    #         return False
    #     # Perform delete and return true
    #     super(ContainerService, self).delete()
    #     return True

from django.apps import AppConfig


class ContainerServiceConfig(AppConfig):
    name = 'backend.ee.modules.notification'
    
    def ready(self):
        """Import signals when app is ready"""
        from . import signals

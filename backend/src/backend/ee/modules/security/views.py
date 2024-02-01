from rest_framework.permissions import AllowAny
from .serializers import ResponseHeadersSerializer
from .models import ResponseHeaders
from rest_framework.viewsets import ModelViewSet


class ResponseHeadersViewSet(ModelViewSet):
    serializer_class = ResponseHeadersSerializer
    queryset = ResponseHeaders.objects.all()
    permission_classes = (AllowAny,)

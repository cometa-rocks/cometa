"""
URL patterns for the RAG system.
"""
from django.urls import path
from .views import rag_query, rag_stats

app_name = 'rag_system'

urlpatterns = [
    path('query/', rag_query, name='rag_query'),
    path('stats/', rag_stats, name='rag_stats'),
] 
"""
Django admin interface for RAG system models.
"""
from django.contrib import admin
from django.utils.html import format_html
from .models import Document, DocumentChunk

class DocumentChunkInline(admin.TabularInline):
    model = DocumentChunk
    fields = ('chunk_index', 'content_preview', 'embedding_id')
    readonly_fields = ('chunk_index', 'content_preview', 'embedding_id')
    extra = 0
    can_delete = False
    
    def content_preview(self, obj):
        if len(obj.content) > 150:
            return f"{obj.content[:150]}..."
        return obj.content
    content_preview.short_description = "Content"
    
    def has_add_permission(self, request, obj=None):
        return False

@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('title', 'content_type', 'status', 'chunk_count', 'created_at')
    list_filter = ('content_type', 'status', 'created_at')
    search_fields = ('title', 'source', 'description')
    readonly_fields = ('id', 'created_at', 'updated_at', 'chunk_count', 'status_badge')
    inlines = [DocumentChunkInline]
    fieldsets = (
        (None, {
            'fields': ('id', 'title', 'source', 'description', 'content_type')
        }),
        ('Status', {
            'fields': ('status_badge', 'error_message', 'chunk_count')
        }),
        ('Content', {
            'fields': ('content',),
            'classes': ('collapse',)
        }),
        ('Timestamps', {
            'fields': ('created_at', 'updated_at')
        }),
    )
    
    def status_badge(self, obj):
        colors = {
            Document.STATUS_PENDING: 'orange',
            Document.STATUS_PROCESSING: 'blue',
            Document.STATUS_COMPLETED: 'green',
            Document.STATUS_FAILED: 'red',
        }
        return format_html(
            '<span style="padding: 5px 10px; border-radius: 5px; background-color: {}; color: white;">{}</span>',
            colors.get(obj.status, 'gray'),
            obj.get_status_display()
        )
    status_badge.short_description = "Status"

@admin.register(DocumentChunk)
class DocumentChunkAdmin(admin.ModelAdmin):
    list_display = ('chunk_preview', 'document_title', 'chunk_index', 'created_at')
    list_filter = ('document__content_type', 'created_at')
    search_fields = ('content', 'document__title')
    readonly_fields = ('id', 'document', 'chunk_index', 'embedding_id', 'created_at', 'updated_at')
    
    def chunk_preview(self, obj):
        if len(obj.content) > 50:
            return f"{obj.content[:50]}..."
        return obj.content
    chunk_preview.short_description = "Chunk Preview"
    
    def document_title(self, obj):
        return obj.document.title
    document_title.short_description = "Document" 
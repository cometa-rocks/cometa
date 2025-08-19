from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Avg
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import HealeniumResult
from .serializers import HealeniumResultSerializer


class HealeniumResultViewSet(viewsets.ModelViewSet):
    """
    ViewSet for viewing and updating Healenium results.
    Provides read and update access to healing events.
    """
    queryset = HealeniumResult.objects.all()
    serializer_class = HealeniumResultSerializer
    http_method_names = ['get', 'post', 'patch', 'head', 'options']
    
    def get_queryset(self):
        """Filter results based on query parameters"""
        queryset = super().get_queryset()
        
        # Filter by feature_result_id if provided
        feature_result_id = self.request.query_params.get('feature_result_id')
        if feature_result_id:
            queryset = queryset.filter(feature_result_id=feature_result_id)
        
        # Filter by feature_id if provided
        feature_id = self.request.query_params.get('feature_id')
        if feature_id:
            queryset = queryset.filter(feature_result__feature_id=feature_id)
        
        return queryset
    
    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """
        Get healing statistics for a feature or feature result.
        """
        feature_id = request.query_params.get('feature_id')
        feature_result_id = request.query_params.get('feature_result_id')
        
        queryset = self.get_queryset()
        
        if feature_result_id:
            queryset = queryset.filter(feature_result_id=feature_result_id)
        elif feature_id:
            queryset = queryset.filter(feature_result__feature_id=feature_id)
        
        # Calculate statistics
        stats = queryset.aggregate(
            total_healings=Count('id'),
            avg_confidence=Avg('confidence_score'),
            avg_duration=Avg('healing_duration_ms')
        )
        
        # Get most healed selectors
        most_healed = queryset.values('original_selector').annotate(
            count=Count('id')
        ).order_by('-count')[:5]
        
        # Get selector type transitions
        type_transitions = queryset.values(
            'selector_type_from', 'selector_type_to'
        ).annotate(
            count=Count('id')
        ).order_by('-count')
        
        return Response({
            'total_healings': stats['total_healings'],
            'average_confidence': round(stats['avg_confidence'] * 100, 2) if stats['avg_confidence'] else 0,
            'average_duration_ms': round(stats['avg_duration'], 2) if stats['avg_duration'] else 0,
            'most_healed_selectors': list(most_healed),
            'selector_type_transitions': list(type_transitions)
        })
    
    @action(detail=False, methods=['get'])
    def by_step(self, request):
        """
        Get healing results grouped by step for a feature result.
        """
        feature_result_id = request.query_params.get('feature_result_id')
        if not feature_result_id:
            return Response(
                {'error': 'feature_result_id is required'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        results = HealeniumResult.objects.filter(
            feature_result_id=feature_result_id
        ).order_by('step_index')
        
        serializer = self.get_serializer(results, many=True)
        return Response(serializer.data)
    
    @method_decorator(csrf_exempt)
    @action(detail=False, methods=['post'], url_path='save')
    def save_healing_result(self, request):
        """
        Save a healing result from Behave tests.
        This endpoint is called from the test execution environment.
        """
        try:
            data = request.data
            
            # Extract selector types if not provided
            selector_type_from = data.get('selector_type_from', 'unknown')
            selector_type_to = data.get('selector_type_to', 'unknown')
            
            # Parse selector types from selectors if needed
            if selector_type_from == 'unknown' and 'original_selector' in data:
                if 'By.' in data['original_selector']:
                    selector_type_from = data['original_selector'].split('By.')[1].split('(')[0]
            
            if selector_type_to == 'unknown' and 'healed_selector' in data:
                if 'By.' in data['healed_selector']:
                    selector_type_to = data['healed_selector'].split('By.')[1].split('(')[0]
            
            # Create the healing result
            healing_result = HealeniumResult.objects.create(
                feature_result_id=data['feature_result_id'],
                step_result_id=data.get('step_result_id'),
                step_name=data['step_name'],
                step_index=data['step_index'],
                original_selector=data['original_selector'],
                healed_selector=data['healed_selector'],
                selector_type_from=selector_type_from,
                selector_type_to=selector_type_to,
                confidence_score=float(data.get('confidence_score', 0)),
                healing_duration_ms=int(data.get('healing_duration_ms', 0)),
                healing_session_id=data.get('healing_session_id', data.get('session_id', ''))
            )
            
            serializer = self.get_serializer(healing_result)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': str(e)}, 
                status=status.HTTP_400_BAD_REQUEST
            )

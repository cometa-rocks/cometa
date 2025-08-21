from rest_framework import status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import HealeniumResult
from backend.utility.functions import getLogger

logger = getLogger()


def _parse_selector_type(current_type, selector):
    """
    Parse selector type from selector string if not already known.
    
    Args:
        current_type: Current selector type ('unknown' if needs parsing)
        selector: Selector string that may contain 'By.' pattern
    
    Returns:
        Parsed selector type or original if already known/unparseable
    """
    if current_type == 'unknown' and selector and 'By.' in selector:
        try:
            parsed_type = selector.split('By.')[1].split('(')[0]
            logger.debug(f"Parsed selector type: {parsed_type} from selector: {selector}")
            return parsed_type
        except (IndexError, AttributeError):
            logger.debug(f"Could not parse selector type from: {selector}")
    return current_type


@csrf_exempt
@api_view(['POST'])
def save_healing_result(request):
    """
    Internal endpoint for saving healing results from behave container.
    This endpoint is for internal container-to-container communication only.
    """
    logger.debug("Healenium save_healing_result endpoint called")
    
    try:
        data = request.data
        feature_result_id = data.get('feature_result_id')
        step_name = data.get('step_name', 'Unknown')
        
        logger.info(f"Saving healing result for feature_result_id: {feature_result_id}, step: '{step_name}'")
        logger.debug(f"Healing data received: {data}")
        
        # Extract selector types if not provided
        selector_type_from = data.get('selector_type_from', 'unknown')
        selector_type_to = data.get('selector_type_to', 'unknown')
        
        # Parse selector types from selectors if needed
        selector_type_from = _parse_selector_type(selector_type_from, data.get('original_selector'))
        selector_type_to = _parse_selector_type(selector_type_to, data.get('healed_selector'))
        
        # Log the healing transformation
        original_selector = data.get('original_selector', 'unknown')
        healed_selector = data.get('healed_selector', 'unknown')
        confidence_score = round(float(data.get('confidence_score', 0)), 2)
        logger.info(f"Healing transformation: {original_selector} -> {healed_selector} (confidence: {confidence_score})")
        
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
            confidence_score=confidence_score,
            healing_duration_ms=int(data.get('healing_duration_ms', 0)),
            healing_session_id=data.get('healing_session_id', data.get('session_id', ''))
        )
        
        logger.info(f"Successfully saved healing result with ID: {healing_result.id}")
        logger.debug(f"Healing result created: feature_result_id={feature_result_id}, step_index={data.get('step_index')}")
        
        return Response({'success': True, 'id': healing_result.id}, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"Failed to save healing result: {str(e)}")
        logger.debug(f"Request data causing error: {data if 'data' in locals() else 'No data parsed'}")
        return Response({'success': False, 'error': str(e)})
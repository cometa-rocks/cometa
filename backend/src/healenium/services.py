import logging
from typing import Dict, Any, Optional
from django.db import transaction
from .models import HealeniumResult

logger = logging.getLogger(__name__)


class HealeniumService:
    """Service class to handle Healenium result creation and management"""
    
    @staticmethod
    def save_healing_result(
        feature_result_id: int,
        step_result_id: Optional[int],
        step_name: str,
        step_index: int,
        healing_data: Dict[str, Any],
        session_id: str
    ) -> Optional[HealeniumResult]:
        """
        Save a healing event to the database.
        
        Args:
            feature_result_id: ID of the feature result
            step_result_id: ID of the step result (optional)
            step_name: Name of the step where healing occurred
            step_index: Index of the step in the feature
            healing_data: Dictionary containing healing information
            session_id: Selenium session ID
            
        Returns:
            HealeniumResult instance if saved successfully, None otherwise
        """
        try:
            # Extract selector types
            original_selector = healing_data.get('original_selector', '')
            healed_selector = healing_data.get('healed_selector', '')
            
            # Parse selector types (e.g., "By.cssSelector(#login)" -> "cssSelector")
            selector_type_from = 'unknown'
            selector_type_to = 'unknown'
            
            if 'By.' in original_selector:
                selector_type_from = original_selector.split('By.')[1].split('(')[0]
            if 'By.' in healed_selector:
                selector_type_to = healed_selector.split('By.')[1].split('(')[0]
            
            # Create the healing result
            with transaction.atomic():
                healing_result = HealeniumResult.objects.create(
                    feature_result_id=feature_result_id,
                    step_result_id=step_result_id,
                    step_name=step_name,
                    step_index=step_index,
                    original_selector=original_selector,
                    healed_selector=healed_selector,
                    selector_type_from=selector_type_from,
                    selector_type_to=selector_type_to,
                    confidence_score=healing_data.get('confidence_score', 0) / 100.0,  # Convert to 0-1 range
                    healing_duration_ms=healing_data.get('healing_duration_ms', 0),
                    healing_session_id=session_id
                )
                
                logger.info(
                    f"Saved Healenium result for step {step_index}: "
                    f"{original_selector} -> {healed_selector} "
                    f"(score: {healing_result.confidence_score})"
                )
                
                return healing_result
                
        except Exception as e:
            logger.error(f"Failed to save Healenium result: {str(e)}")
            return None
    
    @staticmethod
    def get_healing_history(feature_id: int, limit: int = 10) -> list:
        """
        Get recent healing history for a feature.
        
        Args:
            feature_id: ID of the feature
            limit: Maximum number of results to return
            
        Returns:
            List of HealeniumResult instances
        """
        try:
            return HealeniumResult.objects.filter(
                feature_result__feature_id=feature_id
            ).select_related(
                'feature_result', 
                'step_result'
            ).order_by('-created_date')[:limit]
        except Exception as e:
            logger.error(f"Failed to get healing history: {str(e)}")
            return []
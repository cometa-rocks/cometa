"""
Position-Based Encoding System

A reusable system for encoding multiple attributes into a single string field,
where each position can use one or more characters to represent different attributes.
"""

import logging

logger = logging.getLogger(__name__)

class PositionEncoder:
    """
    Reusable position-based encoding system for any model.
    Supports both single-character and multi-character positions.
    """
    
    # Registry of encoders for different models
    _encoders = {}
    
    def __init__(self, model_name):
        self.model_name = model_name
        self.positions = {}
        self.position_map = {}  # Maps logical position to (start_idx, end_idx)
        self.total_length = 0
        
    def add_position(self, position, attribute_name, choices, 
                     required_field=None, check_enabled=True, width=1):
        """
        Add a new position with its configuration.
        
        Args:
            position: Integer position in the string (0-based logical position)
            attribute_name: Name of the attribute (e.g., 'email_notification_frequency')
            choices: List of tuples [(code, display_name), ...]
            required_field: Field name that must be True for this position to be active
            check_enabled: Whether to check if the feature is enabled
            width: Number of characters this position uses (default=1)
        
        Note: Default is always '_' repeated to match width. 
              Positions can only contain valid choice codes or underscores.
        """
        # Validate choice codes don't contain underscores
        for code, display_name in choices:
            if '_' in code:
                logger.error(f"Invalid choice code '{code}' contains underscore")
                raise ValueError(f"Choice code '{code}' cannot contain underscore (reserved character)")
        
        # Default is always underscore(s) matching the width
        default = '_' * width
        
        # Calculate the actual string indices for this position
        start_idx = 0
        for pos in sorted(self.positions.keys()):
            if pos < position:
                start_idx += self.positions[pos]['width']
        
        end_idx = start_idx + width
        
        # Check for overlapping positions BEFORE adding
        self._check_position_overlap(position, start_idx, end_idx)
        
        self.positions[position] = {
            'name': attribute_name,
            'choices': dict(choices),
            'choices_reverse': {v: k for k, v in dict(choices).items()},
            'default': default,
            'required_field': required_field,
            'check_enabled': check_enabled,
            'width': width,
            'start_idx': start_idx,
            'end_idx': end_idx
        }
        
        # Update position map for all positions (in case we inserted in the middle)
        self._rebuild_position_map()
        
        logger.debug(f"Added position {position} for {self.model_name}: {attribute_name} (width={width}, indices=[{start_idx}:{end_idx}])")
        return self
    
    def _check_position_overlap(self, new_position, new_start_idx, new_end_idx):
        """
        Check if a new position would overlap with existing positions.
        
        Args:
            new_position: The logical position number being added
            new_start_idx: Starting string index for the new position
            new_end_idx: Ending string index for the new position
            
        Raises:
            ValueError: If the new position would overlap with existing positions
        """
        for pos, config in self.positions.items():
            # Skip if it's the same position (updating existing)
            if pos == new_position:
                continue
                
            existing_start = config['start_idx']
            existing_end = config['end_idx']
            
            # Check for overlap
            if (new_start_idx < existing_end and new_end_idx > existing_start):
                logger.error(
                    f"Position {new_position} (indices [{new_start_idx}:{new_end_idx}]) "
                    f"overlaps with position {pos} (indices [{existing_start}:{existing_end}])"
                )
                raise ValueError(
                    f"Position {new_position} would overlap with existing position {pos}. "
                    f"New position uses indices [{new_start_idx}:{new_end_idx}], "
                    f"but position {pos} already uses indices [{existing_start}:{existing_end}]"
                )
    
    def _rebuild_position_map(self):
        """Rebuild the position map after adding/modifying positions."""
        current_idx = 0
        for pos in sorted(self.positions.keys()):
            config = self.positions[pos]
            config['start_idx'] = current_idx
            config['end_idx'] = current_idx + config['width']
            current_idx += config['width']
        self.total_length = current_idx
    
    @classmethod
    def register(cls, model_name):
        """Register an encoder for a model."""
        encoder = cls(model_name)
        cls._encoders[model_name] = encoder
        logger.info(f"Registered position encoder for model: {model_name}")
        return encoder
    
    @classmethod
    def get_encoder(cls, model_name):
        """Get encoder for a specific model."""
        return cls._encoders.get(model_name)
    
    def decode_position(self, options_string, position, model_instance=None):
        """Decode a specific position to its display value."""
        if position not in self.positions:
            return None
        
        config = self.positions[position]
        
        # Check if this position requires a field to be enabled
        if config['check_enabled'] and config['required_field'] and model_instance:
            if not getattr(model_instance, config['required_field'], False):
                logger.debug(f"Position {position} disabled: {config['required_field']}=False")
                return None
            
        if not options_string or len(options_string) < config['end_idx']:
            return None
            
        # Extract the code from the correct position
        code = options_string[config['start_idx']:config['end_idx']]
        
        # Check if it's the default value
        if code == config['default']:
            return None
            
        # Strip any padding if the code is shorter than width
        code = code.rstrip('_')
        
        value = config['choices'].get(code)
        if value:
            logger.debug(f"Decoded position {position}: '{code}' → '{value}'")
        return value
    
    def encode_position(self, options_string, position, display_value):
        """Encode a display value to its character code at a position."""
        if position not in self.positions:
            logger.error(f"Position {position} not configured for {self.model_name}")
            raise ValueError(f"Position {position} not configured for {self.model_name}")
            
        config = self.positions[position]
        
        # Get the character code for this display value
        if display_value is None:
            code = config['default']
        else:
            code = config['choices_reverse'].get(display_value)
            if code is None:
                # Try to find by code if display_value is already a code
                if display_value in config['choices']:
                    code = display_value
                else:
                    logger.warning(f"Unknown value '{display_value}' for position {position}, using default")
                    code = config['default']
        
        # Ensure code matches the width (pad with _ if needed)
        if len(code) < config['width']:
            code = code.ljust(config['width'], '_')
        elif len(code) > config['width']:
            code = code[:config['width']]
        
        # Convert string to list for manipulation
        options_list = list(options_string or '')
        
        # Pad with defaults if needed to reach the position
        while len(options_list) < config['end_idx']:
            options_list.append('_')
            
        # Set the characters at the correct indices
        for i, char in enumerate(code):
            options_list[config['start_idx'] + i] = char
        
        # Convert back to string, strip trailing defaults
        result = ''.join(options_list)
        
        # Remove trailing underscores only
        while result.endswith('_'):
            result = result[:-1]
            
        logger.debug(f"Encoded position {position}: '{display_value}' → '{code}' (result: '{result}')")
        return result
    
    def get_position_for_attribute(self, attribute_name):
        """Get the position number for a given attribute name."""
        for position, config in self.positions.items():
            if config['name'] == attribute_name:
                return position
        return None
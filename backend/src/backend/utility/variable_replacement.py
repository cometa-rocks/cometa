"""
Variable replacement utility for notifications (email, Telegram, etc.)
Optimized for performance using regex-based replacement
"""

import re
import html
import datetime
import logging
from django.forms.models import model_to_dict

from backend.utility.functions import getLogger
from backend.models import Variable
from backend.utility.encryption import decrypt
from backend.utility.configurations import ConfigurationManager
from backend.utility.configurations import ConfigurationManager
logger = getLogger()

# Cache encryption configuration
_ENCRYPTION_START = None

def get_encryption_start():
    """Get encryption start marker (cached)"""
    global _ENCRYPTION_START
    if _ENCRYPTION_START is None:
        _ENCRYPTION_START = ConfigurationManager.get_configuration('COMETA_ENCRYPTION_START', '')
    return _ENCRYPTION_START


def replace_feature_variables(text, feature_result, use_html_breaks=True):
    """
    Replace variables in text with actual values using regex for performance
    
    Args:
        text (str): Text containing variables to replace
        feature_result: FeatureResult model instance  
        use_html_breaks (bool): Whether to use <br /> for line breaks (email) or \n (Telegram)
        
    Returns:
        str: Text with variables replaced
    """
    if not text or not text.strip():
        return text
        
    try:
        # Build variable lookup dict for fast access
        variables = _build_variable_lookup(feature_result, use_html_breaks)
        
        # Single regex replacement pass
        def replace_variable(match):
            var_name = match.group(1)
            return variables.get(var_name, match.group(0))  # Return original if not found
        
        # Pattern matches $variable_name or ${variable_name}
        pattern = r'\$\{?([a-zA-Z_][a-zA-Z0-9_]*)\}?'
        return re.sub(pattern, replace_variable, text)
        
    except Exception as e:
        logger.error(f"Error in replace_feature_variables: {e}")
        return text


def _build_variable_lookup(feature_result, use_html_breaks=True):
    """
    Build a single lookup dict with all variables for O(1) access
    
    Returns:
        dict: Variable name -> processed value mapping
    """
    variables = {}
    line_break = '<br />' if use_html_breaks else '\n'
    
    # Add built-in feature variables
    info = model_to_dict(feature_result)
    info['status'] = 'PASSED' if info['success'] else 'FAILED'
    
    # Add feature URL variable
    domain = ConfigurationManager.get_configuration('COMETA_DOMAIN', '')
    if domain:
        info['url'] = f"https://{domain}/#/{feature_result.department_name}/{feature_result.app_name}/{feature_result.feature_id.feature_id}"
    
    for key, value in info.items():
        if isinstance(value, (int, str, datetime.datetime, bool)):
            # Special formatting for result_date
            if key == 'result_date' and isinstance(value, datetime.datetime):
                # Format as "YYYY-MM-DD HH:MM:SS UTC"
                formatted_date = value.strftime("%Y-%m-%d %H:%M:%S UTC")
                variables[key] = formatted_date
            else:
                processed_value = line_break.join(str(value).splitlines())
                variables[key] = processed_value
    
    # Add user variables from database
    try:
        user_variables = Variable.objects.filter(
            feature=feature_result.feature_id,
            environment=feature_result.feature_id.environment_id,
            department=feature_result.feature_id.department_id
        )
        
        for variable in user_variables:
            name = variable.variable_name
            value = variable.variable_value
            
            # Skip invalid variables
            if not _is_valid_variable(name, value):
                continue
                
            # Decrypt if needed
            if variable.encrypted and value:
                value = _decrypt_value(value)
                if value is None:
                    continue
            
            # Process value based on output format
            if use_html_breaks:
                processed_value = '<br />'.join(html.escape(str(value)).splitlines())
            else:
                processed_value = '\n'.join(str(value).splitlines())
            
            # Store with clean name (remove $ prefix if present)
            clean_name = name[1:] if name.startswith('$') else name
            variables[clean_name] = processed_value
            
    except Exception as e:
        logger.error(f"Error loading user variables: {e}")
    
    return variables


def _is_valid_variable(name, value):
    # Check value size limit
    if value and len(str(value)) > 100000:  # 100KB limit
        logger.warning(f"Variable value too large: {name}")
        return False
        
    return True


def _decrypt_value(encrypted_value):
    """Decrypt a value if it's encrypted"""
    try:
        encryption_start = get_encryption_start()
        if encryption_start and str(encrypted_value).startswith(encryption_start):
            return decrypt(encrypted_value)
        return encrypted_value
    except Exception as e:
        logger.error(f"Decryption failed: {e}")
        return None 
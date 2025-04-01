import logging
from ollama import Client
from src.utility.common import get_logger

def process_chat_completion(data):
    """
    Process chat completion using Ollama with granite3.2 model
    
    Args:
        data (dict): Chat data containing messages, system prompt, etc.
            Expected format:
            {
                "messages": [
                    {"role": "system", "content": "You are a helpful assistant"},
                    {"role": "user", "content": "Hello, how are you?"}
                ],
                "system_prompt": "Optional system prompt to override first message",
                "temperature": 0.1,  # Optional temperature parameter
                "top_p": 0.9,        # Optional top_p parameter
                "max_tokens": 1024   # Optional max_tokens parameter
            }
    
    Returns:
        dict: Result containing:
            - success (bool): Whether the completion was successful
            - message (str): The generated response on success
            - error (str): Error message on failure
    """
    logger = get_logger()
    
    try:
        # Extract messages from data
        messages = data.get("messages", [])
        
        # Add or replace system prompt if provided
        system_prompt = data.get("system_prompt")
        if system_prompt and messages:
            # Check if first message is a system message
            if messages[0].get("role") == "system":
                messages[0]["content"] = system_prompt
            else:
                # Add system message at the beginning
                messages.insert(0, {"role": "system", "content": system_prompt})
        elif system_prompt:
            # No messages but system prompt is provided
            messages = [{"role": "system", "content": system_prompt}]
            
        # Ensure there are messages to process
        if not messages:
            return {
                "success": False,
                "message": "",
                "error": "No messages provided for chat completion"
            }
            
        # Extract optional parameters
        options = {}
        for param in ["temperature", "top_p", "max_tokens"]:
            if param in data and data[param] is not None:
                options[param] = data[param]
                
        logger.debug(f"Processing chat completion with {len(messages)} messages")
        
        # Initialize Ollama client
        client = Client()
        
        # Call Ollama chat API with the granite3.2 model
        response = client.chat(
            model="granite3.2",
            messages=messages,
            **options
        )
        
        # Extract the assistant's response
        if response and hasattr(response, "message") and response.message.content:
            return {
                "success": True,
                "message": response.message.content,
                "error": ""
            }
        else:
            return {
                "success": False,
                "message": "",
                "error": "Received empty response from Ollama"
            }
            
    except Exception as e:
        logger.error(f"Error in chat completion: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return {
            "success": False,
            "message": "",
            "error": str(e)
        } 
import ollama
import os
from src.utility.common import get_logger

logger = get_logger()

# Get the default model from environment variable or use llama3 as default
CHATBOT_MODEL_NAME = os.getenv("CHATBOT_MODEL_NAME", "granite3.2")

def process_chat(message, model=None, conversation_history=None):
    """
    Process a chat message using Ollama
    
    Args:
        message (str): The user's message
        model (str, optional): The model to use for chat. Defaults to CHATBOT_MODEL_NAME.
        conversation_history (list, optional): Previous conversation history in the format
                                              [{"role": "user", "content": "..."},
                                               {"role": "assistant", "content": "..."}]
        
    Returns:
        dict: Response containing success status and model's response
    """
    try:
        logger.debug(f"Processing chat message: {message}")
        
        # Use specified model or default
        model_name = model if model else CHATBOT_MODEL_NAME
        logger.debug(f"Using model: {model_name}")
        
        # Create message format for Ollama
        messages = []
        
        # Add conversation history if provided
        if conversation_history and isinstance(conversation_history, list):
            logger.debug(f"Adding conversation history with {len(conversation_history)} messages")
            messages.extend(conversation_history)
        
        # Add the current message
        messages.append({"role": "user", "content": message})
        
        logger.debug(f"Total messages being sent to model: {len(messages)}")
        
        # Call Ollama API
        chat_response = ollama.chat(
            model=model_name,
            messages=messages,
            options={
                    "temperature": 0.0,
                    "top_p": 0.95,
                    "top_k": 100,
                    "num_predict": 1500,
                })
        
        # Extract and return the response content
        response = chat_response["message"]["content"]
        logger.debug(f"Chat response: {response[:100]}...")  # Log first 100 chars of response
        
        return {
            "success": True,
            "response": response,
            "model": model_name
        }
        
    except Exception as e:
        logger.error(f"Error processing chat: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "model": model_name if model else CHATBOT_MODEL_NAME
        } 
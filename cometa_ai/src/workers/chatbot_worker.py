import ollama
import os
from src.utility.common import get_logger
from src.cometa_ollama_api.apps.rag_system.config import (
    CHATBOT_MODEL_NAME,
    OLLAMA_TEMPERATURE,
    OLLAMA_TOP_P,
    OLLAMA_TOP_K,
    OLLAMA_NUM_PREDICT,
    OLLAMA_NUM_CTX
)

logger = get_logger()

# Get the default model from environment variable or use the config value

def process_chat(message, conversation_history=None):
    """
    Process a chat message using Ollama
    
    Args:
        message (str): The user's message
        conversation_history (list, optional): Previous conversation history in the format
                                              [{"role": "user", "content": "..."},
                                               {"role": "assistant", "content": "..."}]
        
    Returns:
        dict: Response containing success status and model's response
    """
    try:
        logger.debug(f"Processing chat message: {message}")
        
        # Always use the configured model
        logger.debug(f"Using model: {CHATBOT_MODEL_NAME}")
        
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
            model=CHATBOT_MODEL_NAME,
            messages=messages,
            options={
                    "temperature": OLLAMA_TEMPERATURE,
                    "top_p": OLLAMA_TOP_P,
                    "top_k": OLLAMA_TOP_K,
                    "num_predict": OLLAMA_NUM_PREDICT,
                    "num_ctx": OLLAMA_NUM_CTX
                })
        
        # Extract and return the response content
        response = chat_response["message"]["content"]
        logger.debug(f"Chat response: {response[:100]}...")  # Log first 100 chars of response
        
        return {
            "success": True,
            "response": response,
            "model": CHATBOT_MODEL_NAME
        }
        
    except Exception as e:
        logger.error(f"Error processing chat: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "model": CHATBOT_MODEL_NAME
        } 
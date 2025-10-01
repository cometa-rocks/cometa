from typing import Any, Dict, List, Optional, TypedDict

import ollama
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

# Optional RAG support (keeps worker functional if RAG stack is unavailable)
try:
    from src.cometa_ollama_api.apps.rag_system.rag_engine import RAGEngine  # type: ignore
except Exception:
    RAGEngine = None  # type: ignore

class ConversationMessage(TypedDict):
    role: str
    content: str


class ChatResult(TypedDict, total=False):
    success: bool
    response: str
    model: str
    error: str


SYSTEM_PROMPT = (
    "You are Co.meta Support for the Co.meta web UI. "
    "Always answer in HTML (<p>, <ul>, <ol>, <code>). "
    "Provide step-by-step UI instructions; do not discuss feature files/Gherkin/PRs unless explicitly asked."
)

# Get the default model from environment variable or use the config value

def process_chat(
    message: str,
    conversation_history: Optional[List[ConversationMessage]] = None
) -> ChatResult:
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
        
        # Messages: system prompt + history + user
        messages: List[ConversationMessage] = [{"role": "system", "content": SYSTEM_PROMPT}]
        if conversation_history and isinstance(conversation_history, list):
            logger.debug(f"Adding conversation history with {len(conversation_history)} messages")
            history_messages: List[ConversationMessage] = [
                {"role": m["role"], "content": m["content"]}
                for m in conversation_history
                if isinstance(m, dict)
                and isinstance(m.get("role"), str)
                and isinstance(m.get("content"), str)
            ]
            messages.extend(history_messages)
        messages.append({"role": "user", "content": message})

        # RAG context (HTML) to bias answers toward UI docs, if available
        if RAGEngine:
            try:
                rag = RAGEngine()
                res = rag.query(f"Co.meta UI usage: {message}", num_results=4)
                items = res.get("results", []) if res.get("rag_available") else []
                keep = []
                for it in items:
                    meta = (it.get("metadata") or {})
                    src = (meta.get("source") or "").lower()
                    cat = (meta.get("category") or "").lower()
                    if "developer" in cat or "/developer/" in src or "contributing" in src:
                        continue
                    keep.append(it)
                keep = keep[:2]
                if keep:
                    ctx_html = "<p>Relevant Co.meta UI docs:</p>" + "".join(
                        f"<p>{(k.get('text') or '').strip()}</p>" for k in keep
                    )
                    messages.insert(1, {"role": "system", "content": ctx_html})
            except Exception:
                pass
        
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

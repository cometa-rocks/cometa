import os
from backend.utility.configurations import ConfigurationManager, logger

# It a wrapper to in case way of getting env info changes
def get_config(key,default_value):
    return os.getenv(key,default_value)


def get_cometa_socket_url():
    return f'http://{get_config("SOCKET_SERVER_URL","cometa_socket")}:{get_config("SOCKET_SERVER_PORT","3001")}'

def get_cometa_crontab_url():
    return f'http://{get_config("CRONTAB_SERVER_URL","crontab")}:{get_config("CRONTAB_SERVER_PORT","8080")}'

def get_cometa_behave_url():
    return f'http://{get_config("BEHAVE_SERVER_URL","behave")}:{get_config("BEHAVE_SERVER_PORT","8001")}'

def get_cometa_backend_url():
    return f'http://{get_config("DJANGO_SERVER_URL","django")}:{get_config("DJANGO_SERVER_PORT","8000")}'

def get_cometa_redis_host():
    return get_config("REDIS_SERVER","redis")

def get_cometa_redis_port():
    return get_config("REDIS_PORT","6379")

def get_ollama_ai_api_url():
    host = ConfigurationManager.get_configuration('OLLAMA_AI_HOST', 'ollama.ai')
    port = ConfigurationManager.get_configuration('OLLAMA_AI_PORT', '8002')
    
    protocol = 'https' if ssl_enabled else 'http'
    ai_server_url = f'{protocol}://{host}:{port}/api/chat/'

    logger.info(f"Using Ollama AI API URL: {ai_server_url}")
    
    # host = get_config("OLLAMA_AI_HOST", "ollama.ai.dev") #Change to actual amvara server IP
    # port = get_config("OLLAMA_AI_PORT", "8002")
    return ai_server_url

# Add any new environment with in this function, if environment information will be used in during test
def get_all_cometa_environments():
    return {
        "SOCKET_SERVER_URL":get_config("SOCKET_SERVER_URL","cometa_socket"),
        "SOCKET_SERVER_PORT": get_config("SOCKET_SERVER_PORT","3001"),
        "CRONTAB_SERVER_URL":get_config("CRONTAB_SERVER_URL","crontab"),
        "CRONTAB_SERVER_PORT": get_config("CRONTAB_SERVER_PORT","8080"),
        "BEHAVE_SERVER_URL":get_config("BEHAVE_SERVER_URL","behave"),
        "BEHAVE_SERVER_PORT":get_config("BEHAVE_SERVER_PORT","8001"),
        "DJANGO_SERVER_URL":get_config("DJANGO_SERVER_URL","django"),
        "DJANGO_SERVER_PORT": get_config("DJANGO_SERVER_PORT","8000"),
        "OLLAMA_AI_HOST": get_config("OLLAMA_AI_HOST", "ollama.ai"),
        "OLLAMA_AI_PORT": get_config("OLLAMA_AI_PORT", "8002"),
        "VIDEO_EXTENSION": get_config("VIDEO_EXTENSION","mp4")
    }

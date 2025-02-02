
import os
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
        "VIDEO_EXTENSION": get_config("VIDEO_EXTENSION","mp4")
    }

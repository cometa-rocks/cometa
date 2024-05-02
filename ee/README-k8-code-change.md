# Cometa Front
URL paths are modified  front/apache-conf/paths.conf 

# Environment Variables need pass when creating containers

## Django container - environment variables 

    BEHAVE_SERVER_URL
    BEHAVE_SERVER_PORT

    CRONTAB_SERVER_URL
    CRONTAB_SERVER_PORT

    SOCKET_SERVER_URL
    SOCKET_SERVER_PORT

    DATABASE_SERVER_URL
    DATABASE_SERVER_PORT

    FRONT_SERVER_HOST
    
    DJANGO_SERVER_URL
    DJANGO_SERVER_PORT

## Crontab container - environment variables 
    CRONTAB_SERVER_URL
    CRONTAB_SERVER_PORT
    
## Behave container - environment variables
    CRONTAB_SERVER_URL
    CRONTAB_SERVER_PORT

    SOCKET_SERVER_URL
    SOCKET_SERVER_PORT

    DJANGO_SERVER_URL
    DJANGO_SERVER_PORT

    Optional
    VIDEO_EXTENSION: mkv or mp4 (mkv preferred)
    
## Front container - environment variables
    SOCKET_SERVER_URL
    SOCKET_SERVER_PORT

    DJANGO_SERVER_URL
    DJANGO_SERVER_PORT

    SELENOID_SERVER_URL
    SELENOID_SERVER_PORT
    
    NOVNC_SERVER_URL
    NOVNC_SERVER_PORT

## Selenium Grid with helm
    refer Kubernetes/values-selenium-grid-helm.yaml to set
    VIDEO_EXTENSION: mkv or mp4 (mkv preferred)
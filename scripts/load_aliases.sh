#/bin/bash

# Follow d=docker, l=logs, container first word
alias dlf="docker logs cometa_front"
alias dld="docker logs cometa_django"
alias dlb="docker logs cometa_behave"

# Follow d=docker, r=restart, container first word
alias drfa="docker exec -it cometa_front httpd -k restart"
alias drd="docker exec -it cometa_django fuser -k -HUP 8000/tcp"
alias drb="docker exec -it cometa_behave fuser -k -HUP 8001/tcp"

alias dsdf="docker compose -f docker-compose-dev.yml up --force-recreate apache -d"
alias ds="docker compose up --force-recreate"
# Inspect docker containers

# Follow standers d=docker, i=inspect, container first word
alias dif="docker inspect cometa_front"
alias did="docker inspect cometa_django"
alias dib="docker inspect cometa_behave"
alias dis="docker inspect cometa_socket"

######## Start Containers development mode ##############
# start cometa_front angular in the development mode
alias dsfd="docker exec -it cometa_front ./start.sh serve"


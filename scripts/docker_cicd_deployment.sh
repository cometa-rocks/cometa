#!/bin/bash
# Author: Anand Kushwaha
# Date: 2025-08-06

# v2.0.0, Change date to : 2025-07-07
# we are using the docker compose up --build command to update the image tag with --record flag to create a new revision
# This is to make that production environment is not affected by the new beta or nightly versions of the application 
# Because if server is restarted then it will pulls the image from docker and and sometime it breaks the application 
# This script is used to update the image tag in the docker-compose.yml file and then restart the docker compose


# check if the version.json file exists in the backend/src directory
if [ ! -f "backend/src/version.json" ]; then
    echo "version.json file not found in the backend/src directory"
    exit 1
fi

# check if the version.json file exists in the backend/behave directory
if [ ! -f "backend/behave/version.json" ]; then
    echo "version.json file not found in the backend/behave directory"
    exit 1
fi

# check if the version.json file exists in the backend/scheduler directory

if [ ! -f "backend/scheduler/version.json" ]; then
    echo "version.json file not found in the backend/scheduler directory"
    exit 1
fi

# check if the version.json file exists in the backend/ws-server directory

if [ ! -f "backend/ws-server/version.json" ]; then
    echo "version.json file not found in the backend/ws-server directory"
    exit 1
fi

# check if the version.json file exists in the front directory

if [ ! -f "front/src/assets/config.json" ]; then
    echo "version.json file not found in the front directory"
    exit 1
fi      

# When we are deploying on any other branch other than master, assummuing that is for testing purposes
# so we are using the version key to get the version
VERSION_KEY="version"

if [ "$CI_COMMIT_BRANCH" == "master" ]; then
    # when are deploying on master, we are using the version_stable key to get the stable version  
    VERSION_KEY="stable_version"
fi


# get the version from the version.json file
django_version=$(jq -r ".$VERSION_KEY" backend/src/version.json)
behave_version=$(jq -r ".$VERSION_KEY" backend/behave/version.json)
scheduler_version=$(jq -r ".$VERSION_KEY" backend/scheduler/version.json)
ws_server_version=$(jq -r ".$VERSION_KEY" backend/ws-server/version.json)
front_stable_version=$(jq -r ".$VERSION_KEY" front/src/assets/config.json)

# create the image name for the docker images
django_image_name="cometa/django:$django_version"
behave_image_name="cometa/behave:$behave_version"
scheduler_image_name="cometa/scheduler:$scheduler_version"
ws_server_image_name="cometa/socket:$ws_server_version"
front_image_name="cometa/front:$front_stable_version"

# print the image names
echo "--------------------------------------------------"
echo "Docker images to be used for this deployment:"
echo "--------------------------------------------------"
echo "django_image_name: $django_image_name"
echo "behave_image_name: $behave_image_name"
echo "scheduler_image_name: $scheduler_image_name"
echo "ws_server_image_name: $ws_server_image_name"
echo "front_image_name: $front_image_name"
echo "--------------------------------------------------"



# now modify docker-compose.yml file to use the new version
echo "Updating docker-compose.yml with specific versions..."

# Check if docker-compose.yml exists
if [ ! -f "docker-compose.yml" ]; then
    echo "Error: docker-compose.yml file not found"
    exit 1
fi

# Replace latest tags with specific versions in docker-compose.yml
echo "Replacing cometa/django:latest with $django_image_name"
sed -i "s|cometa/django:latest|$django_image_name|g" docker-compose.yml

echo "Replacing cometa/behave:latest with $behave_image_name"
sed -i "s|cometa/behave:latest|$behave_image_name|g" docker-compose.yml

echo "Replacing cometa/socket:latest with $ws_server_image_name"
sed -i "s|cometa/socket:latest|$ws_server_image_name|g" docker-compose.yml

echo "Replacing cometa/scheduler:latest with $scheduler_image_name"
sed -i "s|cometa/scheduler:latest|$scheduler_image_name|g" docker-compose.yml

echo "Replacing cometa/front:latest with $front_image_name"
sed -i "s|cometa/front:latest|$front_image_name|g" docker-compose.yml

# if DOCKER_HTTP_PORT is not set, then use 80
if [ -z "$DOCKER_HTTP_PORT" ]; then
    DOCKER_HTTP_PORT=80
fi

echo "DOCKER_HTTP_PORT: $DOCKER_HTTP_PORT"

if [ -z "$COMETA_DATA_FOLDER" ]; then
    COMETA_DATA_FOLDER="./data"
fi

echo "COMETA_DATA_FOLDER: $COMETA_DATA_FOLDER"

echo "Removing the redis data from : $COMETA_DATA_FOLDER/redis/data/dump.rdb"
rm -rf $COMETA_DATA_FOLDER/redis/data/dump.rdb

echo "Replacing <outside_port> with $DOCKER_HTTP_PORT"
sed -i 's/<outside_port>/'$DOCKER_HTTP_PORT'/g' docker-compose.yml


if [ -z "$DOCKER_OPENIDC_CONFIG_EXT" ]; then
    DOCKER_OPENIDC_CONFIG_EXT="basic"
fi

echo "DOCKER_OPENIDC_CONFIG_EXT: $DOCKER_OPENIDC_CONFIG_EXT"

echo "Replacing @@COMETA_CRYPTO_PASSPHRASE@@ with $COMETA_CRYPTO_PASSPHRASE"
sed -i 's/@@COMETA_CRYPTO_PASSPHRASE@@/'$COMETA_CRYPTO_PASSPHRASE'/g' front/apache2/conf/openidc.conf_${DOCKER_OPENIDC_CONFIG_EXT}

echo "docker-compose.yml updated with specific versions"

echo "Stopping the docker compose and removing the orphan containers"
docker compose down --remove-orphans

echo "Starting the docker compose with the new images"
docker compose up -d

echo "Faicon path to be replaced: $COMETA_REPLACE_FAVICON_IN"
echo "Current Branch: $CI_COMMIT_BRANCH"

if [ -z "$COMETA_REPLACE_FAVICON_IN" && -z "$CI_COMMIT_BRANCH" ]; then
    echo "Replacing favicon in the front"
    for FILE in ${COMETA_REPLACE_FAVICON_IN}; do docker exec cometa_front sed -i 's/@@BRANCH@@/'$CI_COMMIT_BRANCH'/g' $FILE; done
fi


echo -e "\e[0Ksection_start:`date +%s`:restart_front\r\e[0KRestarting front"
docker exec cometa_front bash -c "httpd -k restart"
echo -e "\e[0Ksection_end:`date +%s`:restart_front\r\e[0K"

echo -e "\e[0Ksection_start:`date +%s`:parse_actions\r\e[0KParsing actions to update database"
docker exec cometa_django bash -c "curl http://localhost:8000/parseActions/ --silent --retry 5 --retry-delay 10"
echo -e "\e[0Ksection_end:`date +%s`:parse_actions\r\e[0K"
# Update selenoid browsers in database
echo -e "\e[0Ksection_start:`date +%s`:parse_browsers\r\e[0KParsing selenoid browsers to update database"
docker exec cometa_django bash -c "curl http://localhost:8000/parseBrowsers/ --silent --retry 5 --retry-delay 10"
echo -e "\e[0Ksection_end:`date +%s`:parse_browsers\r\e[0K"







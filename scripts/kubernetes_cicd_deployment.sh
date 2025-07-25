#!/bin/bash
# Author: Anand Kushwaha
# Date: 2025-06-06

# v2.0.0, Change date to : 2025-07-07
# we are using the kubectl edit deployment command to update the image tag with --record flag to create a new revision
# This is to make that production environment is not affected by the new beta or nightly versions of the application 
# Because if server is restarted then it will pulls the image from docker and and sometime it breaks the application 


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

if [ ! -f "front/version.json" ]; then
    echo "version.json file not found in the front directory"
    exit 1
fi      

NAME_SPACE="cometa"
django_stable_version=$(cat backend/src/version.json | jq -r '.stable_version')
behave_stable_version=$(cat backend/behave/version.json | jq -r '.stable_version')
scheduler_stable_version=$(cat backend/scheduler/version.json | jq -r '.stable_version')
ws_server_stable_version=$(cat backend/ws-server/version.json | jq -r '.stable_version')
front_stable_version=$(cat front/version.json | jq -r '.stable_version')

echo "Restarting cometa-django-deployment"
kubectl edit deployment cometa-django-deployment cometa-django=cometa/django:$django_stable_version --record --namespace=$NAME_SPACE
echo "cometa-django-deployment restarted"

echo "Restarting cometa-behave-deployment"
kubectl edit deployment cometa-behave-deployment cometa-behave=cometa/behave:$behave_stable_version --record --namespace=$NAME_SPACE
echo "cometa-behave-deployment restarted"

echo "Restarting cometa-scheduler-deployment"
kubectl edit deployment cometa-scheduler-deployment cometa-scheduler=cometa/scheduler:$scheduler_stable_version --record --namespace=$NAME_SPACE
echo "cometa-scheduler-deployment restarted"

echo "Restarting cometa-socket-deployment"
kubectl edit deployment cometa-socket-deployment cometa-socket=cometa/socket:$ws_server_stable_version --record --namespace=$NAME_SPACE
echo "cometa-socket-deployment restarted"

echo "Restarting cometa-front-deployment"
kubectl edit deployment cometa-front-deployment cometa-front=cometa/front:$front_stable_version --record --namespace=$NAME_SPACE
echo "cometa-front-deployment restarted"

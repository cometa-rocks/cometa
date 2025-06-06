#!/bin/bash
# Author: Anand Kushwaha
# Date: 2025-06-06

# we are reusing the same image tag (e.g., :latest) these command will force Kubernetes to pull the updated image

echo "Restarting cometa-django-deployment"
kubectl rollout restart deployment/cometa-django-deployment
echo "cometa-django-deployment restarted"

echo "Restarting cometa-behave-deployment"
kubectl rollout restart deployment/cometa-behave-deployment
echo "cometa-behave-deployment restarted"

echo "Restarting cometa-scheduler-deployment"
kubectl rollout restart deployment/cometa-scheduler-deployment
echo "cometa-scheduler-deployment restarted"

echo "Restarting cometa-socket-deployment"
kubectl rollout restart deployment/cometa-socket-deployment
echo "cometa-socket-deployment restarted"

echo "Restarting cometa-front-deployment"
kubectl rollout restart deployment/cometa-front-deployment
echo "cometa-front-deployment restarted"

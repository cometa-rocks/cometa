### Mount local diskspace to minikube 
> screen -dm minikube mount .:/cometa

> -m: It ignore $STY variable, do create a new screen session.

> -d (-r): It detach the elsewhere running screen (and reattach here).
### Detach screen
screen -d 1643
### Re attache screen
screen -r 1643

# Docker commands
### Get minikube docker access 
> eval $(minikube -p minikube docker-env)
### build docker images
> docker build . -t cometa-python:0.1

### Forword port of cometa-backend to outside
kubectl port-forward --address localhost cometa-django-pod 8000:8000
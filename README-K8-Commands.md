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
### build docker images django
> docker build . -t cometa-python:0.1
### build docker images front
> docker build . -f Dockerfile-Dependency-Build -t cometa-apache:0.1
### Forword port of cometa-backend to outside
kubectl port-forward --address localhost cometa-django-pod 8000:8000

### create NFS volume using 
> https://chat.openai.com/share/31429731-6676-4b7b-ba73-a9b63e3e89e1











#  NFS commands

2. Verify NFS Share Exports
Ensure that the NFS share is correctly exported to the Kubernetes nodes. On the NFS server, check the exports list by running:

> sudo exportfs -v


# get port information
 ss -tulpn
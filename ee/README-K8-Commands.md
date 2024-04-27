# Screen commands 
## Mount local diskspace to minikube 
> screen -dm minikube mount .:/cometa

> -m: It ignore $STY variable, do create a new screen session.

> -d (-r): It detach the elsewhere running screen (and reattach here).
## Detach screen
screen -d 1643
## Re attache screen
screen -r 1643

# Useful Minikube Docker commands
## Get minikube docker access 
> eval $(minikube -p minikube docker-env)

## build docker images django
> docker build . -t cometa-python:0.1
## build docker images front
> docker build . -f Dockerfile-Dependency-Build -t cometa-apache:0.1

## build docker images behave
> docker build . -t cometa/behave:0.1

## build docker images redis
> docker build . -t cometa/redis:0.1

## Forword port of cometa-backend to outside
kubectl port-forward --address localhost cometa-django-pod 8000:8000

## build docker images django
> docker build . -t cometa/socket:0.1

## build docker images front
> docker build . -f Dockerfile-Dependency-Build -t cometa-apache:0.1


## Forword port of cometa-backend to outside
kubectl port-forward --address localhost cometa-django-pod 8000:8000

### create NFS volume using 
> https://chat.openai.com/share/31429731-6676-4b7b-ba73-a9b63e3e89e1

* Issue in running front pod in 443 port
> copy /home/user/.kube to /root/.kube, run port forward command with root

> sudo kubectl port-forward --address localhost service/cometa-front-service 443:443


> kubectl port-forward --address localhost service/selenium-video-service 4444:4444 5900:5900 7900:7900 -n cometa







# get port information
 ss -tulpn



# Minikube Commands
   ```minikube start --driver=docker --force```

start dashboard
    ```nohup minikube dashboard &```

check nohup.out

Start kubernetes dashboard
    ```nohup kubectl proxy --address='0.0.0.0' --accept-hosts='^*$' &```

Create SSH tunnel
    ```ssh -L 8001:localhost:8001 root@88.198.116.6```

Mouse host folder to minikube cluster path
    ```minikube mount .:/cometa```


# Selenium Grid

> sudo kubectl port-forward --address localhost service/selenium-hub 4444:4444 -n cometa
> sudo kubectl port-forward --address localhost service/selenium-video-service 4444:4444 5900:5900 -n cometa

kubectl port-forward --address localhost service/selenium-video-service 4444:4444 5900:5900 -n cometa
kubectl port-forward --address localhost service/selenium-grid-selenium-hub 4444:4444 5900:5900 7900:7900 -n cometa

kubectl port-forward --address 88.198.116.6 service/selenium-grid-selenium-hub 4444:4444 -n cometa
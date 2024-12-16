# useful kubectl commands
    kubectl config view

    kubectl config view --minify --output 'jsonpath={.clusters[0].cluster.server}'

    kubectl config current-context

    kubectl config view

    kubectl config get-contexts
    
    kubectl config set-context

# connect local tanzu env to Lence

When tanzu cluster is running then run
    
    screen -dm kubectl proxy --port=8010 --address='0.0.0.0' --accept-hosts='^*$'

open ~/kube/config > copy content update 
    
    server-url: http://localhost:8010/


# Screen commands 
Mount local diskspace to minikube 
    screen -dm minikube mount .:/cometa

    -m: It ignore $STY variable, do create a new screen session.

    -d (-r): It detach the elsewhere running screen (and reattach here).
Detach screen
    screen -d 1643
Re attache screen
    screen -r 1643

# Useful Development env commands  
> Get minikube docker access (Minikube Docker) ```eval $(minikube -p minikube docker-env)```

> Minikube start ```minikube start --driver=docker --force```

> start dashboard ```nohup minikube dashboard &```

> check nohup.out ```cat nohup.out```

> Start kubernetes dashboard ```nohup kubectl proxy --address='0.0.0.0' --accept-hosts='^*$' &```

> Create SSH tunnel ```ssh -L 8001:localhost:8001 root@88.198.116.6```

> Mount host folder to minikube cluster path ```minikube mount .:/cometa```


# Build images
## build docker images django
    docker build . -t cometa/python:0.1

## build docker images front
    docker build . -t cometa/apache:0.1

## build docker images behave
    docker build . -t cometa/behave:0.1

## build docker images redis
    docker build . -t cometa/redis:0.1

## build docker images django
    docker build . -t cometa/socket:0.1

# Upload docker images to docker hub 
See https://chat.openai.com/share/42936418-983e-408d-9e52-aadc072fc508

* Login to docker hub
> ```docker login```

* Tag the images 
> ```docker tag cometa/postgres:0.1 cometa/postgres:latest```

* Upload container images
> ```docker push cometa/postgres:latest```

* Tag the images 
> ```docker tag cometa/postgres:0.1 cometa/postgres:latest```

* Upload container images
> ```docker push cometa/postgres:latest```



## Port forward using kubectl of cometa containers to outside

    kubectl port-forward --address localhost cometa-django-pod 8000:8000 -n cometa

    sudo kubectl port-forward --address localhost service/cometa-front-service 443:443 -n cometa

    kubectl port-forward --address localhost service/selenium-video-service 4444:4444 5900:5900 7900:7900 -n cometa


### create NFS volume using 
    https://chat.openai.com/share/31429731-6676-4b7b-ba73-a9b63e3e89e1

* Issue in running front pod in 443 port
    copy /home/user/.kube to /root/.kube, run port forward command with root


# get port information
    ss -tulpn


# Selenium Grid Helm chart

    minikube addons enable storage-provisioner-gluster

    helm repo add docker-selenium https://www.selenium.dev/docker-selenium

    helm repo update

    https://github.com/SeleniumHQ/docker-selenium/tree/trunk/charts/selenium-grid

    helm upgrade --install selenium-grid docker-selenium/selenium-grid -n cometa --values ~/lyrid/cometa/segrid.yml

    helm upgrade --install selenium-grid docker-selenium/selenium-grid -n cometa --values helm-selenium.yaml
kubec
    For testing purpose - use below command
    kubectl port-forward --address 88.198.116.6 service/selenium-grid-selenium-hub 4444:4444 -n cometa

    helm uninstall selenium-grid -n cometa

# Selenium Grid

    kubectl port-forward --address localhost service/selenium-hub 4444:4444 -n cometa

    kubectl port-forward --address localhost service/selenium-video-service 4444:4444 5900:5900 -n cometa

    kubectl port-forward --address localhost service/selenium-grid-selenium-hub 4444:4444 5900:5900 7900:7900 -n cometa

    kubectl port-forward --address 88.198.116.6 service/selenium-grid-selenium-hub 4444:4444 -n cometa
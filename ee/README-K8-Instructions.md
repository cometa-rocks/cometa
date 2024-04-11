* Remove --dev from K8-django-service

* cometa-python image is build locally, Upload image to docker-hub use docker file to build image```/backend/src/Dockerfile```

** To do this, needed to make changes in the start.sh. Since few commands will be executed while builing the image not required to run again.

* cometa-apache image is build locally, Upload image to docker-hub to use docker file to build image ```/front/Dockerfile-Dependency-Build```

## Note when using NFS volume and mouting with pods use docker internel IP to avoid the firewal issue

# sequence of pods to be started

    fs-docker-compose
    cometa-volume
    cometa-volume-claim
    k8-postgres-pod
    k8-django-pod
    k8-socket-pod
    k8-front-pod
    k8-redis-pod
    k8-crontab-pod
    k8-behave-pod - Need to
    k8-novnc-pod - Need to
    k8-moon-pod - Need to
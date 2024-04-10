* Remove --dev from K8-django-service

* cometa-python image is build locally, Upload image to docker-hub use docker file to build image```/backend/src/Dockerfile```

** To do this, needed to make changes in the start.sh. Since few commands will be executed while builing the image not required to run again.

* cometa-apache image is build locally, Upload image to docker-hub to use docker file to build image ```/front/Dockerfile-Dependency-Build```

## Note when using NFS volume and mouting with pods use docker internel IP to avoid the firewal issue
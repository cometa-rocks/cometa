* Remove --dev from K8-django-service

* cometa-python image is build locally, Upload image to docker-hub use docker file to build image```/backend/src/Dockerfile```

** To do this, needed to make changes in the start.sh. Since few commands will be executed while builing the image not required to run again.

* cometa-apache image is build locally, Upload image to docker-hub to use docker file to build image ```/front/Dockerfile-Dependency-Build```

cometa-django pod starting
cometa-behave pod starting
cometa-postgres pod started

* fix cometa_postgres volume connection 
* fix - cometa_front restarts after compilation
* Correct cometa front pod restart error
* fix cometa socket restart restart error
* fix cometa behave connection with redis
*  
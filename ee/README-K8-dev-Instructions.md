Steps to setup development env with kubernetes

* Create NFS volumes in docker using nfs-docker-compose.yml file
* Install minikube cluster in the local machine 
* Once started access the dashboard of minikube
* Create Namespace 
* Create Persistent Volume and Persistent Volume Claim
* Create Postgres Deployment
* Create Redis Deployment
* Create NoVNC Deployment
* Create Crontab Deployment
* Create Socket Deployment
* Create Django Deployment
* Create Behave Deployment
* Create Front Deployment

For Test create all container with version cometa/{Container_name}:0.1 all Cometa


## Note when using NFS volume and mounting with pods use docker internal IP to avoid the firewall issue
https://kubernetes.io/docs/concepts/storage/persistent-volumes/#access-modes

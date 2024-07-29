# /bin/bash
docker-compose -f nfs-docker-compose.yml down -d
sleep 5
kubectl -f k8-cometa-namespace.yaml delete
sleep 5
kubectl -f k8-cometa-volume-with-claim.yaml delete
sleep 5
kubectl -f k8-postgres-deployment.yaml delete
sleep 5
kubectl -f k8-django-deployment.yaml delete
sleep 5
kubectl -f k8-redis-deployment.yaml delete
sleep 5
kubectl -f k8-socket-deployment.yaml delete
sleep 5
kubectl -f k8-scheduler-deployment.yaml delete
sleep 5
kubectl -f k8-novnc-deployment.yaml delete
sleep 5
kubectl -f k8-behave-deployment.yaml delete
sleep 5
kubectl -f k8-behave-deployment.yaml delete
sleep 5
kubectl -f k8-front-deployment.yaml delete
sleep 5 
helm uninstall selenium-grid -n cometa
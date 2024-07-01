# /bin/bash
docker-compose -f nfs-docker-compose.yml up -d
sleep 5
kubectl -f k8-cometa-namespace.yaml apply
sleep 5
kubectl -f k8-cometa-volume-with-claim.yaml apply
sleep 5
kubectl -f k8-postgres-deployment.yaml apply
sleep 5
kubectl -f k8-django-deployment.yaml apply
sleep 5
kubectl -f k8-redis-deployment.yaml apply
sleep 5
kubectl -f k8-socket-deployment.yaml apply
sleep 5
kubectl -f k8-scheduler-deployment.yaml apply
sleep 5
kubectl -f k8-novnc-deployment.yaml apply
sleep 5
kubectl -f k8-behave-deployment.yaml apply
sleep 5
kubectl -f k8-behave-deployment.yaml apply
sleep 5
kubectl -f k8-front-deployment.yaml apply

helm repo add docker-selenium https://www.selenium.dev/docker-selenium

helm repo update

helm upgrade --install selenium-grid docker-selenium/selenium-grid -n cometa --values values-selenium-grid-helm.yaml

kubectl port-forward --address localhost service/cometa-front-service 443:443 -n cometa

# useful commands
    kubectl config view

    kubectl config view --minify --output 'jsonpath={.clusters[0].cluster.server}'

    kubectl config current-context

    kubectl config view

    kubectl config get-contexts

 # connect local tanzu env to Lence

* When tanzu cluster is running run
>  screen -dm kubectl proxy --port=8010 --address='0.0.0.0' --accept-hosts='^*$'

* open ~/kube/config > copy content update 
> server-url: http://localhost:8010/


# Selenium Grid Helm chart

minikube addons enable storage-provisioner-gluster

helm repo add docker-selenium https://www.selenium.dev/docker-selenium

helm repo update

https://github.com/SeleniumHQ/docker-selenium/tree/trunk/charts/selenium-grid

helm upgrade --install selenium-grid docker-selenium/selenium-grid -n cometa --values ~/lyrid/cometa/segrid.yml

helm upgrade --install selenium-grid docker-selenium/selenium-grid -n cometa --values helm-selenium.yaml

For testing purpose - use below command
kubectl port-forward --address 88.198.116.6 service/selenium-grid-selenium-hub 4444:4444 -n cometa


helm uninstall selenium-grid -n cometa
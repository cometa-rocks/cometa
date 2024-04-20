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






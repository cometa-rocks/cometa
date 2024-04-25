
# Front

## Make metadata dir persistent in the storage
* Before running front deployment uncomment line:51 and comment line:52 
* run the deployment 
    ```kubectl apply -f k8-front-deployment.yaml```
* Get inside the front pod container 
* make a copy of metadata dir from /code/front/apache-conf/metadata to /share/metadata
* Add the oauth credentials
* delete deployment
    ```kubectl delete -f k8-front-deployment.yaml```

* Before running front deployment uncomment line:52 and comment line:51 
* run the deployment 
    ```kubectl apply -f k8-front-deployment.yaml```


## Update Parse actions once the front is up and running 
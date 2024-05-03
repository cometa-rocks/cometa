# Installation of Cometa in Kubernetes cluster
To install Cometa in the Kubernetes environment, we need to ensure the following deployment containers are up and running.


List of YAML files to be applied:
### The current documentation includes steps for the following four YAML files (which are sufficient for debugging the PV problem):
* [Create Namespace](Kubernetes/k8-cometa-namespace.yaml) 
* [Create Persistent Volume and Persistent Volume Claim](Kubernetes/k8-cometa-volume-with-claim.yaml) 
* [Create Postgres Deployment](Kubernetes/k8-postgres-deployment.yaml) 
* [Create Django Deployment](Kubernetes/k8-django-deployment.yaml) 

### The rest of these deployments should be completed with the Cometa team.
* [Create Redis Deployment](Kubernetes/k8-redis-deployment.yaml)
* [Create NoVNC Deployment](Kubernetes/k8-novnc-deployment.yaml) 
* [Create Scheduler Deployment](Kubernetes/k8-scheduler-deployment.yaml) 
* [Create Behave Deployment](Kubernetes/k8-behave-deployment.yaml) 
* [Create Socket Deployment](Kubernetes/k8-socket-deployment.yaml) 
* [Create Front Deployment](Kubernetes/k8-front-deployment.yaml)
* [Create Selenium Grid with the Selenium Helm chart](Kubernetes/values-selenium-grid-helm.yaml)

## Getting started
Here are the commands you can use to deploy all the deployments: 

**Notes:**
1. Please ensure you run all commands in the same sequence as mentioned.
2. Ensure you are in the directory: ```Your/System/Path/cometa/ee/Kubernetes```
 

### 1. Create Cometa Namespace

* Create the Cometa namespace using the following command:

    **Command**

    ```kubectl apply -f k8-cometa-namespace.yaml```

    **You should see the following output:** 

        namespace "cometa" created

* Verify that the namespace is created using the following command:

    ```kubectl get namespace cometa```

    **You should see the following output:**

        NAME     STATUS   AGE
        cometa   Active   12m


### 2. Create Persistent Volume and Persistent Volume Claim

Please modify the [Kubernetes-dev/k8-cometa-volume-with-claim.yaml](Kubernetes-dev/k8-cometa-volume-with-claim.yaml) file according to your cluster's storage setups, and create the Persistent Volumes (PV) and Persistent Volume Claims (PVC) as specified below.

* Create two Persistent Volumes:

    - **cometa-volume** PV named to store data such as files, screenshots, and videos.
    - **cometa-volume-log** PV for storing logs.

* Create two Persistent Volume Claims:

    - **cometa-volume-claim** PVC named to store data such as files, screenshots, and videos.
    - **cometa-volume-log-claim** PVC for storing logs.


* Create the PVs and PVCs using the following command:

    **Command**

    ```kubectl apply -f k8-cometa-volume-with-claim.yaml```

    **You should see the following output:** 

        ubuntu@Notebook-18:~/kubernetes/tanzu/cometa/ee/Kubernetes$ kubectl apply -f k8-cometa-volume-with-claim.yaml
        persistentvolume/cometa-volume created
        persistentvolumeclaim/cometa-volume-claim created
        persistentvolume/cometa-volume-log unchanged
        persistentvolumeclaim/cometa-volume-log-claim created


* Verify PV's are created using the following command

    ```kubectl get pvc```

* Verify that the PVs are created using the following command:

    ```kubectl get pvc -n cometa```

**Note:** Please ensure that the **STATUS** column in the output of both commands shows **Bound**
  


### 3. Create Postgres deployment

Postgres is used as the database within Cometa, and it utilizes **cometa-volume-claim** PVC within its definition file. Please ensure that you have the cometa-volume-claim available with Read and Write permissions.


* Create the Postgres deployment using the following command:

    **Command**

    ```kubectl apply -f k8-postgres-deployment.yaml```

    **You should see the following output:** 

        ubuntu@Notebook-18:~/kubernetes/tanzu/cometa/ee/Kubernetes$ kubectl apply -f k8-postgres-deployment.yaml
        deployment.apps/cometa-postgres-deployment created
        service/postgres-service created
        networkpolicy.networking.k8s.io/postgres-network-policy created

* Verify that the Postgres deployment has been created using the following command:

    ```kubectl get pods -n cometa```

    **You should see the following output:**

        ubuntu@Notebook-18:~/kubernetes/tanzu/cometa/ee/Kubernetes$ kubectl get pods -n cometa
        NAME                                          READY   STATUS    RESTARTS   AGE
        cometa-postgres-deployment-xxxxxxxxx-xxxxxx   1/1     Running   0          82s

    - For further investigation and debugging, you can use the describe command with your pod name.

    **Command**

    ```kubectl describe pod cometa-postgres-deployment-xxxxxxxxx-xxxxxx -n cometa```

    **You should see the following output:**

    **Note:** Please make sure you see message **Started container postgres** at the last

        ubuntu@Notebook-18:~/kubernetes/tanzu/cometa/ee/Kubernetes$ kubectl describe pod cometa-postgres-deployment-xxxxxxxxx-xxxxxx -n cometa
        Name:             cometa-postgres-deployment-xxxxxxxxx-xxxxxx
        Namespace:        cometa
        Priority:         0
        Service Account:  default
        ........................................................................
        ........................................................................
        ........................................................................
        Events:
            Type    Reason     Age    From               Message
            ----    ------     ----   ----               -------
            Normal  Scheduled  7m32s  default-scheduler  Successfully assigned cometa/cometa-postgres-deployment-xxxxxxxxx-xxxxxx to minikube
            Normal  Pulling    7m32s  kubelet            Pulling image "cometa/postgres:latest"
            Normal  Pulled     7m28s  kubelet            Successfully pulled image "cometa/postgres:latest" in 3.31s (3.31s including waiting)
            Normal  Created    7m28s  kubelet            Created container postgres
            Normal  Started    7m28s  kubelet            Started container postgres


### 4. Create Django deployment

Django is used as the API server within Cometa, and it utilizes the  **cometa-volume-claim** PVC and **Postgres** deployment, which need to be up and running. Please ensure both are available before starting this deployment.

* Create the Django deployment using the following command:

    **Command**

    ```kubectl apply -f k8-django-deployment.yaml```

    **You should see the following output:** 
        ubuntu@Notebook-18:~/kubernetes/tanzu/cometa/ee/Kubernetes$ kubectl apply -f k8-django-deployment.yaml
        deployment.apps/cometa-django-deployment created
        service/cometa-django-service created
        networkpolicy.networking.k8s.io/cometa-django-network-policy created

* Verify that the Django deployment has been created using the following command:

    ```kubectl get pods -n cometa```

    **You should see the following output:**

        ubuntu@Notebook-18:~/kubernetes/tanzu/cometa/ee/Kubernetes$ kubectl get pods -n cometa
        NAME                                          READY   STATUS    RESTARTS   AGE
        cometa-django-deployment-yyyyyyyyy-yyyyy      1/1     Running   0          42s
        cometa-postgres-deployment-xxxxxxxxx-xxxxxx   1/1     Running   0          16m

    - For further investigation and debugging, you can use the describe command with your pod name.

    **Command**

    ```kubectl describe pod cometa-django-deployment-yyyyyyyyy-yyyyy -n cometa```

    **You should see the following output:**

    **Note:** Please make sure you see message **Started container cometa-django** at the last

        ubuntu@Notebook-18:~/kubernetes/tanzu/cometa/ee/Kubernetes$ kubectl describe pod cometa-django-deployment-yyyyyyyyy-yyyyy -n cometa
        Name:             cometa-django-deployment-yyyyyyyyy-yyyyy
        Namespace:        cometa
        Priority:         0
        ........................................................................
        ........................................................................
        ........................................................................
        Events:
            Type    Reason     Age    From               Message
            ----    ------     ----   ----               -------
            Normal  Scheduled  5m40s  default-scheduler  Successfully assigned cometa/cometa-django-deployment-dbf6bc574-g2zlw to minikube
            Normal  Pulling    5m40s  kubelet            Pulling image "cometa/django:latest"
            Normal  Pulled     5m37s  kubelet            Successfully pulled image "cometa/django:latest" in 3.232s (3.232s including waiting)
            Normal  Created    5m37s  kubelet            Created container cometa-django
            Normal  Started    5m37s  kubelet            Started container cometa-django 
<br>
<br>
<br>

# If this works, we can consider the PV issue resolved and proceed with the further installation.
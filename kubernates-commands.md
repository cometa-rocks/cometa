start minikube
   ```minikube start --driver=docker --force```

start dashboard
    ```nohup minikube dashboard &```

check nohup.out

Start kubernetes dashboard
    ```nohup kubectl proxy --address='0.0.0.0' --accept-hosts='^*$' &```

Create SSH tunnel
    ```ssh -L 8001:localhost:8001 root@88.198.116.6```

Mouse host folder to minikube cluster path
    ```minikube mount .:/cometa```


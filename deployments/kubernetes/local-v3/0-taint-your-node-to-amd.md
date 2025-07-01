

### Get all nodes

`kubectl get nodes`

> **Note:** do not taint your master node, to avoid pod schdeuling on master node

### Taint your node with **architecture=amd:NoSchedule**

`kubectl taint nodes <your-node-name> architecture=amd:NoSchedule`
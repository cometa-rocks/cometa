# Get the Node Name: Use the following command to list the nodes:

```kubectl get node```

# Access a Node: Run the command:
az aks nodepool list --resource-group Cometa-RG --cluster-name cometa-prod


az aks show -g Cometa-RG -n cometa-prod --query identityProfile.kubeletidentity.clientId -o tsv



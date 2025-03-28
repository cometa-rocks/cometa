# Create Storage account using command line

az aks show --resource-group Cometa-RG --name cometa-prod --query nodeResourceGroup -o tsv

az storage account create -n cometastorageaccount -g MC_Cometa-RG_cometa-prod_germanywestcentral -l germanywestcentral --sku Premium_LRS


# get connection string for the storage account:
az storage account show-connection-string -n cometastorageaccount -g MC_Cometa-RG_cometa-prod_germanywestcentral -o tsv


export AZURE_STORAGE_CONNECTION_STRING=$(az storage account show-connection-string -n cometastorageaccount -g MC_Cometa-RG_cometa-prod_germanywestcentral -o tsv)


# Add connection string and run command
az storage share create -n cometa-pvc-share --connection-string "DefaultEndpointsProtocol=https;EndpointSuffix=core.windows.net;AccountName=cometastorageaccount;AccountKey=bdz4Pfa0K8Iqt4bhivYWwKa4vIc/JmXPvFPmos+udt4kj6BMM9q8olgeWrwLnLjeT/OL8I8IT6k9+ASt65DRNQ==;BlobEndpoint=https://cometastorageaccount.blob.core.windows.net/"
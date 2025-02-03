
# Kubernetes API Access from Pod

This guide explains how to allow services running inside a Kubernetes pod to access the Kubernetes API for dynamic resource creation, such as creating pods within the cluster.

## Prerequisites
- A running Kubernetes cluster.
- kubectl access configured to interact with the cluster.

## Step 1: Create a Service Account

First, create a new service account that will be used by the pods to interact with the Kubernetes API.

<pre>kubectl create serviceaccount my-service-account</pre>

## Step 2: Create a ClusterRole with Permissions to Create Pods

Define a **ClusterRole** that grants the service account permissions to create pods in the cluster.

Create a file **pod-creator-clusterrole.yaml**:

<pre>
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: pod-creator
rules:
  - apiGroups: [""]
    resources: ["pods"]
    verbs: ["create"]
</pre>

Apply the **ClusterRole**:

<pre>
kubectl apply -f pod-creator-clusterrole.yaml
</pre>

## Step 3: Bind the Service Account to the ClusterRole

Create a **ClusterRoleBinding** that binds the service account to the **ClusterRole** for pod creation.

Create a file **clusterrolebinding.yaml**:

<pre>
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: pod-creator-binding
subjects:
  - kind: ServiceAccount
    name: my-service-account
    namespace: default
roleRef:
  kind: ClusterRole
  name: pod-creator
  apiGroup: rbac.authorization.k8s.io
</pre>

Apply the **ClusterRoleBinding**:

<pre>
kubectl apply -f clusterrolebinding.yaml
</pre>

## Step 4: Configure the Pod to Use the Service Account

When deploying your pod, specify the service account created in Step 1 so the pod can use it to access the Kubernetes API.

Create a file **pod.yaml**:

<pre>
apiVersion: v1
kind: Pod
metadata:
  name: my-pod
spec:
  serviceAccountName: my-service-account
  containers:
  - name: my-container
    image: my-container-image
</pre>

Apply the pod definition:

<pre>
kubectl apply -f pod.yaml
</pre>

## Step 5: Accessing the Kubernetes API from the Pod

Once your pod is running, you can access the Kubernetes API from within the pod. The API server is accessible at **https://kubernetes.default.svc**, and the service account's token is mounted at **/var/run/secrets/kubernetes.io/serviceaccount/token**.

Example Python code to create a pod via the Kubernetes API:

<pre>
import requests

api_server = "https://kubernetes.default.svc"
token = open("/var/run/secrets/kubernetes.io/serviceaccount/token").read()
headers = {
    "Authorization": f"Bearer {token}"
}

# Example: List pods in the 'default' namespace
response = requests.get(f"{api_server}/api/v1/namespaces/default/pods", headers=headers, verify='/var/run/secrets/kubernetes.io/serviceaccount/ca.crt')
print(response.json())
</pre>

Make sure that the appropriate client libraries (like **requests**) are installed in the container for the service running within the pod.

## Security Considerations

- The service account should only have the necessary permissions to interact with the Kubernetes API.
- Scope the permissions to specific namespaces if needed using a **Role** and **RoleBinding** instead of **ClusterRole** and **ClusterRoleBinding** if only namespace-scoped access is required.

## Clean Up

To delete the resources created during this guide, run:

<pre>
kubectl delete serviceaccount my-service-account
kubectl delete clusterrolebinding pod-creator-binding
kubectl delete clusterrole pod-creator
kubectl delete pod my-pod
</pre>

Now your pod should have access to the Kubernetes API, and you can dynamically create resources as needed.

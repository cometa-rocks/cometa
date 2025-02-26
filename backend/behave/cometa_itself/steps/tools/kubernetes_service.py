import uuid, time, logging, sys
from kubernetes import client, config
from kubernetes.client import ApiException

sys.path.append("/opt/code/behave_django")

from utility.config_handler import *
from utility.configurations import ConfigurationManager

# # setup logging
# logging.setLoggerClass(CometaLogger)
# logger = logging.getLogger("FeatureExecution")


class KubernetesServiceManager:
    def __init__(self, logger, browser="chrome", version="131.0", namespace="cometa", data_pv_claim="cometa-data-volume-claim"):
        self.logger = logger

        # Load in-cluster configuration
        self.logger.debug(f"Loading cluster config ")        
        print("Using in-cluster configuration.")
        # Try to load in-cluster configuration
        config.load_incluster_config()
        self.logger.debug(f"Loaded config")
        self.namespace = namespace
        self.data_pv_claim = data_pv_claim
        self.v1 = client.CoreV1Api()
        self.logger.debug(f"Created Client connection")
        # Generate a random UUID
        self.service_random_uuid = uuid.uuid4()
        self.browser = browser
        self.version = version
        self.container_image = f"cometa/{browser}:{version}"
        self.pod_selector = f"{browser}-{version}-{self.service_random_uuid}"
        self.service_name = f"service-{browser}-{self.service_random_uuid}"

        # Define the pod manifest
        self.pod_manifest = {
            "apiVersion": "v1",
            "kind": "Pod",
            "metadata": {
                "name": f"pod-{self.pod_selector}",
                "namespace": self.namespace,
                "labels": {"app": self.pod_selector}
            },
            "spec": {
                "tolerations": [
                    {
                        "key": "architecture",
                        "operator": "Equal",
                        "value": "amd",
                        "effect": "NoSchedule"
                    }
                ],
                "containers": [
                    {
                        "name": "browser",
                        "image": self.container_image,
                        "securityContext": {"allowPrivilegeEscalation": True},
                        "resources": {
                            "limits": {"cpu": "2", "memory": "2Gi"},
                            "requests": {"cpu": "1", "memory": "1Gi"}
                        },
                        "env": [
                            {"name": "AUTO_RECORD", "value": "true"},
                            {"name": "VIDEO_PATH", "value": "/video"}
                        ],
                        "ports": [
                            {"containerPort": 4444, "protocol": "TCP"},
                            {"containerPort": 7900, "protocol": "TCP"}
                        ],
                        "volumeMounts": [
                            {
                                "name": "cometa-volume",
                                "mountPath": "/video",
                                "subPath": "data/cometa/videos"
                            }
                        ]
                    }
                ],
                "volumes": [
                    {
                        "name": "cometa-volume",
                        "persistentVolumeClaim": {
                            "claimName": self.data_pv_claim
                        }
                    }
                ]
            }
        }

        # Define the service manifest
        self.service_manifest = {
            "apiVersion": "v1",
            "kind": "Service",
            "metadata": {
                "name": self.service_name,
                "namespace": self.namespace
            },
            "spec": {
                "selector": {"app": self.pod_selector},
                "ports": [
                    {"name": "selenium", "protocol": "TCP", "port": 4444, "targetPort": 4444},
                    {"name": "vnc", "protocol": "TCP", "port": 7900, "targetPort": 7900}
                ],
                "type": "ClusterIP"
            }
        }

    def create_pod_and_wait_to_running(self, timeout=60):
        self.logger.debug(f"Creating pod '{self.service_name}'")
        try:
            # Create the pod
            self.v1.create_namespaced_pod(namespace=self.namespace, body=self.pod_manifest)
            self.logger.debug(f"Pod '{self.pod_manifest['metadata']['name']}' created.")

            # Wait for the pod to become ready
            start_time = time.time()
            while time.time() - start_time < timeout:
                pod = self.v1.read_namespaced_pod(name=self.pod_manifest['metadata']['name'], namespace=self.namespace)
                if pod.status.phase == "Running":
                    self.logger.debug(f"Pod '{pod.metadata.name}' is running.")
                    return True

                self.logger.debug(f"Pod '{pod.metadata.name}' status is {pod.status.phase}")
                time.sleep(2)

            # Timeout
            self.logger.debug(f"Pod '{self.pod_manifest['metadata']['name']}' did not become ready within {timeout} seconds.")
            self.delete_pod()
            return False
        except ApiException as e:
            self.logger.debug(f"Exception occurred while creating pod: {e}")
            return False

    def create_service(self):
        self.logger.debug(f"Creating Service '{self.service_name}'")
        try:
            service_response = self.v1.create_namespaced_service(namespace=self.namespace, body=self.service_manifest)
            self.logger.debug(f"Service '{service_response.metadata.name}' created.")
            return self.service_name
        except ApiException as e:
            self.logger.debug(f"Exception occurred while creating service: {e}")
            return False

    def delete_pod(self):
        self.logger.debug(f"Deleting Pod '{self.service_name}'")
        try:
            self.v1.delete_namespaced_pod(name=self.pod_manifest['metadata']['name'], namespace=self.namespace)
            self.logger.debug(f"Pod '{self.pod_manifest['metadata']['name']}' deleted.")
        except ApiException as e:
            self.logger.debug(f"Exception occurred while deleting pod: {e}")

    def delete_service(self):
        self.logger.debug(f"Deleting Service '{self.service_name}'")
        try:
            self.v1.delete_namespaced_service(name=self.service_name, namespace=self.namespace)
            self.logger.debug(f"Service '{self.service_name}' deleted.")
        except ApiException as e:
            self.logger.debug(f"Exception occurred while deleting service: {e}")

# # Example usage
# if __name__ == "__main__":
#     try:
#         k8 = KubernetesServiceManager()
#         k8.create_pod_and_wait_to_running()
#         k8.create_service()
#         time.sleep(30)
#         k8.delete_pod()
#         k8.delete_service()
        
#         # Wait for service to become ready
#     except ApiException as e:
#         self.logger.debug(f"An error occurred: {e}")
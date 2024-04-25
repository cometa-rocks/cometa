
import secret_variables
import kubernetes
from kubernetes import client, config

class KubernetesHandler:

    def __init__(self, HOST,logger):
        self.logger = logger
        self.service_create_response = None
        self.pod_create_api_response = None
        self.configuration = client.Configuration()
        # Set the Kubernetes API server address
        self.configuration.host = HOST
        self.configuration.verify_ssl = False
        self.namespace = 'cometa'
        client.Configuration.set_default(self.configuration)

        self.api_instance = client.CoreV1Api()

    def create_pod(self, IMAGE, VIDEO_NAME, SESSION_ID):
        pod_manifest = {
            "apiVersion": "v1",
            "kind": "Pod",
            "metadata": {
                "name": f"cometa-selenium-pod-{SESSION_ID}",
                "namespace": "cometa",
                "labels": {
                    "app": SESSION_ID
                }
            },
            "spec": {
                "terminationGracePeriodSeconds": 10,
                "containers": [
                    {
                        "name": "selenium",
                        "image": IMAGE,
                        "ports": [
                            {
                                "containerPort": 4444
                            },
                            {
                                "containerPort": 5900
                            },
                            {
                                "containerPort": 7900
                            }
                        ],
                        "env": [
                            {
                                "name": "VIDEO_NAME",
                                "value": VIDEO_NAME
                            },
                            {
                                "name": "SE_SCREEN_WIDTH",
                                "value": "1920"
                            },
                            {
                                "name": "SE_SCREEN_HEIGHT",
                                "value": "1080"
                            },
                            {
                                "name": "SE_SCREEN_DEPTH",
                                "value": "24"
                            }
                        ],
                        # "resources": {
                        #     "limits": {
                        #         "memory": "1Gi",
                        #         "cpu": "1"
                        #     }
                        # },
                        "volumeMounts": [
                            {
                                "name": "cometa-volume",
                                "mountPath": "/dev/shm",
                                "subPath": "./browsers"
                            },
                            {
                                "name": "cometa-volume",
                                "mountPath": "/video",
                                "subPath": "./video"
                            }
                        ]
                    }
                ],
                "volumes": [
                    {
                        "name": "cometa-volume",
                        "persistentVolumeClaim": {
                            "claimName": "cometa-volume-claim"
                        }
                    }
                ]
            }
        }
        # Create the pod in the default namespace
        # Call the API to create the pod
        self.pod_create_api_response = self.api_instance.create_namespaced_pod(
            body=pod_manifest,
            namespace=self.namespace
        )

        logger.debug(f"Pod '{self.pod_create_api_response.metadata.name}' created successfully in namespace '{self.namespace}'")

    def create_service(self, SESSION_ID):

        service_manifest = {
            "apiVersion": "v1",
            "kind": "Service",
            "metadata": {
                "name": f"selenium-video-service-{SESSION_ID}",
                "namespace": self.namespace
            },
            "spec": {
                "selector": {
                    "app": SESSION_ID
                },
                "ports": [
                    {
                        "protocol": "TCP",
                        "name": "grid",
                        "port": 4444,
                        "targetPort": 4444
                    },
                    {
                        "protocol": "TCP",
                        "name": "vnc-client",
                        "port": 5900,
                        "targetPort": 5900
                    },
                    {
                        "protocol": "TCP",
                        "name": "vnc-browser",
                        "port": 7900,
                        "targetPort": 7900
                    }
                ]
            }
        }

        self.service_create_response = self.api_instance.create_namespaced_service(
            body=service_manifest,
            namespace=self.namespace
        )

        logger.debug(f"Service '{self.service_create_response.metadata.name}' created successfully in namespace '{self.namespace}'")
    
    


    def get_service_name(self):
        return self.service_create_response.metadata.name
    
    def wait_to_spinup(self):


        # URL to monitor of local pods
        url = f'http://{self.get_service_name()}:4444/status'

        # Define a wait time between retries (in seconds)
        wait_time = 1  # For example, wait 5 seconds between each request

        # Set a flag to track whether the URL is accessible
        url_accessible = False

        # Loop until the URL returns a status code of 200
        while not url_accessible:
            try:
                # Make an HTTP GET request to the URL
                response = requests.get(url)

                # Check the status code of the response
                if response.status_code == 200:
                    # If the status code is 200, the URL is accessible
                    logger.debug(f'Success! URL {url} is accessible.')
                    url_accessible = True
                else:
                    # If the status code is not 200, print the status code and wait
                    logger.debug(f'URL {url} returned status code {response.status_code}. Retrying in {wait_time} seconds...')
                    time.sleep(wait_time)

            except requests.RequestException as e:
                # Handle request exceptions (e.g., connection error)
                logger.debug(f'Browser nov ready Retrying in {wait_time} seconds...')
                time.sleep(wait_time)

        # The loop will exit when the status code 200 is received



    def delete_pod(self):
        self.api_instance.delete_namespaced_pod(
            name=self.pod_create_api_response.metadata.name,
            namespace=self.namespace,
            body=client.V1DeleteOptions()
        )
        logger.debug(f"Pod '{self.pod_create_api_response.metadata.name}' deleted successfully in namespace '{self.namespace}'")

    def delete_service(self):
        time.sleep(30)

        self.api_instance.delete_namespaced_service(
            name=self.service_create_response.metadata.name,
            namespace=self.namespace,
            body=client.V1DeleteOptions()
        )

        logger.debug(f"Service '{self.service_create_response.metadata.name}' deleted successfully in namespace '{self.namespace}'")


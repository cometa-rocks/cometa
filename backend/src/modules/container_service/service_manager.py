import docker, os, requests
import time, traceback
from backend.utility.functions import getLogger, create_tarball
from backend.utility.configurations import ConfigurationManager
from docker.errors import NullResource, NotFound
from backend.utility.uploadFile import decryptFile

logger = getLogger()

import uuid, time, sys, json
from kubernetes import client, config
from kubernetes.client import ApiException


class KubernetesServiceManager:
    
    deployment_type = "kubernetes"
    namespace=ConfigurationManager.get_configuration("COMETA_KUBERNETES_NAMESPACE",'cometa')
    data_pv_claim=ConfigurationManager.get_configuration("COMETA_KUBERNETES_DATA_PVC",'cometa-data-volume-claim')

    def __init__(self,  ):
        # FIXME need to take this value from 
        self.__service_configuration = None
        self.pod_manifest = None
        self.pod_service_manifest = None
                
        # Load in-cluster configuration
        logger.debug(f"Loading cluster config ")        
        # Try to load in-cluster configuration
        config.load_incluster_config()
        logger.debug(f"Loaded config")
        self.v1 = client.CoreV1Api()
        logger.debug(f"Created Client connection")
    
    
    def get_pod_name(self, uuid):
        return f"pod-{uuid}"
    
    def get_service_name(self, uuid):
        return f"service-{uuid}"
        
     
    def __create_pod_and_wait_to_running(self, timeout=60):
        logger.debug(f"Creating pod '{self.pod_manifest['metadata']['name']}'")
        try:
            # Create the pod
            self.v1.create_namespaced_pod(namespace=self.namespace, body=self.pod_manifest)
            logger.debug(f"Pod '{self.pod_manifest['metadata']['name']}' created.")

            # Wait for the pod to become ready
            start_time = time.time()
            while time.time() - start_time < timeout:
                pod = self.v1.read_namespaced_pod(name=self.pod_manifest['metadata']['name'], namespace=self.namespace)
                if pod.status.phase == "Running":
                    logger.debug(f"Pod '{pod.metadata.name}' is running.")
                    return True

                logger.debug(f"Pod '{pod.metadata.name}' status is {pod.status.phase}")
                time.sleep(2)

            # Timeout
            logger.debug(f"Pod '{self.pod_manifest['metadata']['name']}' did not become ready within {timeout} seconds.")
            self.delete_pod()
            return False
        except ApiException as e:
            logger.debug(f"Exception occurred while creating pod: {e}")
            return False

    def __create_pod_url(self, ):
        logger.debug(f"Creating Service '{self.pod_service_manifest['metadata']['name']}'")
        try:
            service_response = self.v1.create_namespaced_service(namespace=self.namespace, body=self.pod_service_manifest)
            logger.debug(f"Service '{service_response.metadata.name}' created.")
            return True
        except ApiException as e:
            logger.debug(f"Exception occurred while creating service: {e}")
            return False

    def __delete_pod(self, pod_id):
        pod_name = self.get_pod_name(pod_id)
        logger.debug(f"Deleting Pod '{pod_name}'")
        try:
            delete_options = client.V1DeleteOptions(
                grace_period_seconds=60
            )
            self.v1.delete_namespaced_pod(name=pod_name, namespace=self.namespace, body=delete_options)
            logger.debug(f"Pod '{pod_name}' deleted.")
        except ApiException as e:
            logger.debug(f"Exception occurred while deleting pod: {e}")

    def __delete_pod_url(self,pod_url_id):
        url_name = self.get_service_name(pod_url_id)
        logger.debug(f"Deleting Pod Service '{url_name}'")
        try:
            self.v1.delete_namespaced_service(name=url_name, namespace=self.namespace)
            logger.debug(f"Service '{url_name}' deleted.")
        except ApiException as e:
            logger.debug(f"Exception occurred while deleting service: {e}")

    def create_service(self,configuration):
        try:
            self.__create_pod_and_wait_to_running()
            if not self.__create_pod_url():
                # In case pod service creation fails delete the pod 
                self.__delete_pod(pod_id = configuration['Id'])
            
            return True
        except Exception:
            logger.debug(f"Exception while creation Kubernetes service\n{configuration}")
            traceback.print_exc()
            return False

    def delete_service(self, service_name_or_id):
        self.__delete_pod(pod_id = service_name_or_id)
        self.__delete_pod_url(pod_url_id = service_name_or_id)
        pass


class DockerServiceManager:
    deployment_type = "docker"

    def __init__(self):
        # Initialize Docker client using the Docker socket
        self.docker_client = docker.DockerClient(base_url="unix://var/run/docker.sock")

    # This method will create the container base on the environment
    def create_service(self, configuration) -> dict:
        logger.info(f"Creating container with configuration : {configuration}")
        container = self.docker_client.containers.run(**configuration)
        return container.attrs

    def get_service_name(self, uuid):
        return self.inspect_service(uuid)['Config']['Hostname']             

    # This method will create the container base on the environment
    def wait_for_service_to_be_running(
        self, service_name_or_id, max_wait_time_seconds=30
    ):
        logger.info(
            f"Waiting for service to be running with max_wait_time_seconds : {max_wait_time_seconds} with container_name_or_id : {service_name_or_id}"
        )
        container = self.docker_client.containers.get(service_name_or_id)
        start_time = time.time()
        while (
            container.status != "running"
            and time.time() - start_time <= max_wait_time_seconds
        ):
            time.sleep(1)
        if time.time() - start_time > max_wait_time_seconds:
            return (
                False,
                f"Service is not running waited for {max_wait_time_seconds} seconds, container_name_or_id : {service_name_or_id}",
            )
        return True, container.status

    # This method will create the container base on the environment
    def restart_service(self, service_name_or_id, *args, **kwargs):
        logger.info(f"Restart service with container_name_or_id : {service_name_or_id}")
        max_wait_time_seconds = kwargs.get("max_wait_time_seconds", 30)
        try:
            # Find the container
            container = self.docker_client.containers.get(service_name_or_id)
            container.restart()
            self.wait_for_service_to_be_running(
                service_name_or_id, max_wait_time_seconds
            )
            return True, container.attrs
        except Exception as e:
            logger.info(
                f"Can not restart the service with container_name_or_id : {service_name_or_id}, error message {str(e)}"
            )
            traceback.print_exc()
            return False, str(e)

    # This method will create the container base on the environment
    def stop_service(self, service_name_or_id, *args, **kwargs):
        logger.info(
            f"Deleting service with container_name_or_id : {service_name_or_id}"
        )
        try:
            # Find the container
            container = self.docker_client.containers.get(service_name_or_id)
            container.stop()
            logger.info(
                f"Container stopped with container_name_or_id : {service_name_or_id}"
            )

            return True, container.attrs
        except (NullResource, NotFound) as null_resource:
            logger.info(
                f"Can not stop service with container_name_or_id : {service_name_or_id}, error message {str(null_resource)}"
            )
            return True, str(null_resource)
        except Exception as e:
            traceback.print_exc()
            return False, str(e)

    def delete_service(self, service_name_or_id):
        logger.info(
            f"Deleting service with container_name_or_id : {service_name_or_id}"
        )
        try:
            # Find the container
            container = self.docker_client.containers.get(service_name_or_id)
            # Stop the container if it's running
            container.stop()
            logger.info(
                f"Container stopped with container_name_or_id : {service_name_or_id}"
            )

            # Remove the container
            container.remove()
            logger.info(
                f"Container removed with container_name_or_id : {service_name_or_id}"
            )
            return True, "Container removed"
        except (NullResource, NotFound) as null_resource:
            logger.info(
                f"Can not delete service with container_name_or_id : {service_name_or_id}, error message {str(null_resource)}"
            )
            return True, str(null_resource)
        except Exception as e:
            traceback.print_exc()
            return False, str(e)

    def pull_image(self, image_name):
        logger.info(f"Pulling the image : {image_name}")
        try:
            # Pull the specified image
            logger.info(f"Pulling image: {image_name}")
            self.docker_client.images.pull(image_name)
            logger.info(f"Image '{image_name}' pulled successfully.")
            return True
        except Exception as e:
            logger.error(f"An error occurred while pulling the image: {str(e)}")
            traceback.print_exc()
            return False

    def upload_file(self, service_name_or_id, file_path, decryptFile=True):
        container = self.docker_client.containers.get(service_name_or_id)

        # Destination path inside the container
        container_dest_path = "/tmp"  # Change as needed
        file_name = file_path.split("/")[-1]
        if decryptFile:
            file_path = decryptFile(file_path)
        # i.e decrypted_file /tmp/6oy2p464
        # Create the tar archive
        logger.debug("Creating a tar stream of file")
        tar_stream = create_tarball(file_path)
        logger.debug(f"Uploading the file to container from {file_path} to {container_dest_path}")
        # This will paste in the mobile container in the same location as decrypted_file_path 
        if container.put_archive(container_dest_path, tar_stream):
            logger.debug("APK File copied to the container")
            # File was not decrypted then file will be copied to container with correct name 
            if not decryptFile:
                return file_name
            
            command = f"mv \"{file_path}\" \"/tmp/{file_name}\""
            # Run the tar extraction command in the container
            exit_code, output = container.exec_run(command)
            if exit_code==0:
                logger.debug(f"APK File moved from file {tar_stream} to the {file_name}")
                return file_name
            else:
                raise Exception(output)
        else:
            raise Exception("Error while uploading apk file to server")
    
    def install_apk(self,service_name_or_id, apk_file_name):
        container = self.docker_client.containers.get(service_name_or_id)

        command = f"adb install \"/tmp/{apk_file_name}\""

        # Run the tar extraction command in the container
        exit_code, output = container.exec_run(command)
        if exit_code == 0:
            return True, f"App {apk_file_name} installed in the emulator container {service_name_or_id}"
        else:
            return False, f"Error while installing app in the emulator container {service_name_or_id}\n{output}"

    def inspect_service(self,service_name_or_id):
        return self.docker_client.containers.get(service_name_or_id).attrs



# Select ServiceManager Parent class based on the deployment 
service_manager = DockerServiceManager

IS_KUBERNETES_DEPLOYMENT = ConfigurationManager.get_configuration("COMETA_DEPLOYMENT_ENVIRONMENT", "docker") == "kubernetes"

if IS_KUBERNETES_DEPLOYMENT:
    service_manager = KubernetesServiceManager
    logger.debug(
        f'Deployment type is {ConfigurationManager.get_configuration("COMETA_DEPLOYMENT_ENVIRONMENT","docker")}'
    )


class ServiceManager(service_manager):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    # This method will create the container base on the environment
    def create_service(self, *args, **kwargs):
        if not self.__service_configuration:
            raise Exception("Please prepare service_configuration configuration first")
        return super().create_service(
            configuration=self.__service_configuration, *args, **kwargs
        )

    # This method will create the container base on the environment
    def restart_service(self, service_name_or_id, *args, **kwargs):
        return super().restart_service(service_name_or_id, *args, **kwargs)

    # This method will create the container base on the environment
    def stop_service(self, service_name_or_id, *args, **kwargs):
        return super().stop_service(service_name_or_id, *args, **kwargs)

    def delete_service(self, service_name_or_id, *args, **kwargs):
        return super().delete_service(service_name_or_id, *args, **kwargs)

    def upload_file(self, service_name_or_id, file_path, *args, **kwargs):
        return super().upload_file(service_name_or_id, file_path, *args, **kwargs)

    def install_apk(self, service_name_or_id, apk_file_name, *args, **kwargs):
        return super().install_apk(service_name_or_id, apk_file_name, *args, **kwargs)

    def inspect_service(self, service_name_or_id,  *args, **kwargs):
        return super().inspect_service(service_name_or_id,  *args, **kwargs)

    def get_host_name_mapping(self):
        # Load the host file mappings
        try:
            # https://redmine.amvara.de/projects/ibis/wiki/Add_DNS_mapping_to_hosts_(etchosts)_file_using_Cometa_configuration
            cometa_test_env_host_file_mappings = ConfigurationManager.get_configuration("COMETA_TEST_ENV_HOST_FILE_MAPPINGS",'[]')
            return json.loads(cometa_test_env_host_file_mappings)
        except Exception as e:
            logger.error("Exception loading the test hostAliases configurations", e)
            return []
        
    def get_video_volume(self):
        info = self.inspect_service("cometa_behave")
        volume_mounts :list = info['HostConfig']['Binds']
        return [volume for volume in volume_mounts if volume.find("/data/videos") >= 0][0].split(":")[0]


    def prepare_emulator_service_configuration(self, image):
        host_mappings = self.get_host_name_mapping()
        
        # Flatten the host mappings for `extra_hosts`
        extra_hosts = [
            f"{hostname}:{entry['ip']}"
            for entry in host_mappings
            for hostname in entry['hostnames']
        ]
        
        if super().deployment_type == "docker":
            video_volume = self.get_video_volume()
            logger.debug("Preparing service emulator service configuration for docker")
            self.__service_configuration = {
                "image": image,  # Replace with your desired image name
                "detach": True,  # Run the container in the background
                "working_dir": "/app",  # Set the working directory inside the container
                "devices": [
                    "/dev/kvm:/dev/kvm"
                ],  # Bind the KVM device for hardware acceleration
                "privileged": True,  # Required to access hardware features and KVM
                "environment": {
                    "DISPLAY": ":0",
                    "VIDEO_PATH": "/video",
                    "AUTO_RECORD": "true"
                },  # Set the DISPLAY environment variable
                "network": "cometa_testing",  # Attach the container to the 'testing' network
                "restart_policy": {"Name": "unless-stopped"},
                "volumes":[
                    f"{video_volume}:/video"
                ],
                "extra_hosts": extra_hosts  # Add the custom host mappings here
            }
        else:
            # Create Configuration for kubernetes
            # Need to implement this section
            pass
        return self.__service_configuration

    def prepare_browser_service_configuration(self, browser="chrome", version="131.0"):
        # Generate a random UUID
        random_uuid = str(uuid.uuid4())
        container_image = f"cometa/{browser}:{version}"
        self.__service_configuration = { "Id": random_uuid }
        browser_memory=ConfigurationManager.get_configuration("COMETA_BROWSER_MEMORY","2")
        browser_cpu=int(ConfigurationManager.get_configuration("COMETA_BROWSER_CPU","1"))
        
        host_mappings = self.get_host_name_mapping()
        
        if super().deployment_type == "docker":        
            video_volume = self.get_video_volume()
            # Flatten the host mappings for `extra_hosts`
            extra_hosts = [
                f"{hostname}:{entry['ip']}"
                for entry in host_mappings
                for hostname in entry['hostnames']
            ]
            # Need to implement  this section
            logger.debug("Preparing service browser service configuration for docker")

            self.__service_configuration = {
                "image": container_image,  # Replace with your desired image name
                "detach": True,  # Run the container in the background
                "working_dir": "/opt/scripts",  # Set the working directory inside the container
                "privileged": True,  # Required to access hardware features and KVM
                "environment": {
                    "AUTO_RECORD": "true",
                    "VIDEO_PATH": "/video",
                    "SE_VNC_NO_PASSWORD": "1",
                    "SE_ENABLE_TRACING": "false"
                },  # Set environment variables
                "network": "cometa_testing",  # Attach the container to the 'cometa_testing' network
                "restart_policy": {"Name": "unless-stopped"},
                "volumes":[
                    f"{video_volume}:/video"
                ],  # Mount volumes
                "extra_hosts": extra_hosts,  # Add custom host mappings
                "ports": {
                    "4444/tcp": None,  # Expose Selenium port without mapping to the host
                    "5900/tcp": None   # Expose VNC port without mapping to the host
                },
                "cpu_shares": browser_cpu*1024,  # Translate CPU request/limits to Docker's CPU shares
                "mem_limit": f"{browser_memory}g"    # Set memory limit
            }
            
        else:
            pod_name = self.get_pod_name(random_uuid)
            service_name = self.get_service_name(random_uuid)
            pod_selectors = {
                "browser":browser,
                "version": version,
                "Id": random_uuid
            }
        
            # Define the pod manifest
            self.pod_manifest = {
                "apiVersion": "v1",
                "kind": "Pod",
                "metadata": {
                    "name": pod_name,
                    "namespace": self.namespace,
                    "labels": pod_selectors
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
                            "image": container_image,
                            "securityContext": {"allowPrivilegeEscalation": True},
                            "resources": {
                                "limits": {"cpu": browser_cpu, "memory": f"{browser_memory}Gi"},
                                "requests": {"cpu": "1", "memory": "1Gi"}
                            },
                            "env": [
                                {"name": "AUTO_RECORD", "value": "true"},
                                {"name": "VIDEO_PATH", "value": "/video"},
                                {"name": "SE_VNC_NO_PASSWORD", "value": "1"},
                                {"name": "SE_ENABLE_TRACING", "value": "false"}
                            ],
                            "ports": [
                                {"containerPort": 4444, "protocol": "TCP"},
                                {"containerPort": 5900, "protocol": "TCP"}
                            ],
                            "volumeMounts": [
                                {
                                    "name": "cometa-volume",
                                    "mountPath": "/opt/scripts/video_recorder.sh",
                                    "subPath": "./scripts/video_recorder.sh"
                                }, 
                                {
                                    "name": "cometa-volume",
                                    "mountPath": "/video",
                                    "subPath": "data/cometa/videos"
                                }
                            ]
                        }
                    ],
                    "hostAliases":host_mappings,
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
            self.pod_service_manifest = {
                "apiVersion": "v1",
                "kind": "Service",
                "metadata": {
                    "name": service_name,
                    "namespace": self.namespace
                },
                "spec": {
                    "selector": pod_selectors,
                    "ports": [
                        {"name": "selenium", "protocol": "TCP", "port": 4444, "targetPort": 4444},
                        {"name": "vnc", "protocol": "TCP", "port": 5900, "targetPort": 5900}
                    ],
                    "type": "ClusterIP"
                }
            }
            
            self.__service_configuration["pod"]= self.pod_manifest, 
            self.__service_configuration["pod_service"]= self.pod_service_manifest, 
            
        return self.__service_configuration
    
    
    def wait_for_selenium_hub_be_up(self,hub_url,timeout=120):
        start_time = time.time()
        interval = 1
        logger.debug(f"Waiting for selenium hub {hub_url} to available")
        while True:
            try:
                response = requests.get(hub_url, timeout=5)
                if response.status_code == 200:
                    print("Selenium Hub is available!")
                    return True
            except requests.exceptions.RequestException:
                pass  # Ignore exceptions and continue to retry

            elapsed_time = time.time() - start_time
            if elapsed_time >= timeout:
                logger.debug(f"Timeout reached. Selenium Hub is not available after {timeout} seconds.")
                return False

            logger.debug(f"Waiting for Selenium Hub to be available... (retrying in {interval} seconds)")
            time.sleep(interval)


    def remove_all_service(self,container_services):
        # Delete all the services which were started during test
        for service in container_services:
            logger.debug(f"Deleting container service with ID : {service['Id']}")
            service_manager = ServiceManager()
            service_manager.delete_service(
                service_name_or_id=service['Id']
            )

    

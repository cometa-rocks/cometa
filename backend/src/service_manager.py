import docker
import time
from backend.utility.functions import getLogger

logger = getLogger()    
 

class KubernetesServiceManager:
    def __init__(self, deployment_type="docker"):
        self.deployment_type = deployment_type

    # This method will create the container base on the environment
    def create_service(self, configuration):
        pass

    def delete_service(self, configuration):
        pass


class DockerServiceManager:
    def __init__(self):
        # Initialize Docker client using the Docker socket
        self.docker_client = docker.DockerClient(base_url="unix://var/run/docker.sock")

    # This method will create the container base on the environment
    def create_service(self, configuration) -> dict:
        logger.info(f"Creating container with configuration : {configuration}")
        container = self.docker_client.containers.run(**configuration)
        return {
            "container_id": container.id,
            "container_name": container.name,
            "short_id": container.short_id,
            "status": container.status,
        }

    # This method will create the container base on the environment
    def wait_for_service_to_be_running(
        self, container_name_or_id, max_wait_time_seconds=30
    ):
        logger.info(f"Waiting for service to be running with max_wait_time_seconds : {max_wait_time_seconds} with container_name_or_id : {container_name_or_id}")
        container = self.docker_client.containers.get(container_name_or_id)
        start_time = time.time()
        while (
            container.status == "running"
            or time.time() - start_time > max_wait_time_seconds
        ):
            return None
        raise Exception(f"Service is not running waited for seconds {max_wait_time_seconds} with container_name_or_id : {container_name_or_id}")

    def delete_service(self, container_name_or_id):
        logger.info(f"Deleting service with container_name_or_id : {container_name_or_id}")
        # Find the container
        container = self.docker_client.containers.get(container_name_or_id)
        # Stop the container if it's running
        if container.status == "running":
            container.stop()
            logger.info(f"Container stopped with container_name_or_id : {container_name_or_id}")

        # Remove the container
        container.remove()
        logger.info(f"Container removed with container_name_or_id : {container_name_or_id}")


class ServiceManager:
    def __init__(self, deployment_type="docker"):
        self.deployment_type = deployment_type

    # This method will create the container base on the environment
    def create_service(self, configuration):

        pass

    def delete_service(self, configuration):
        pass


container_configuration = {
    "image": "cometa/emulator_appium_api_31:latest",  # Replace with your desired image name
    # "name": "emulator_appium_api_31",  # Replace with your desired container name
    "detach": True,  # Run the container in the background
    "working_dir": "/app",  # Set the working directory inside the container
    "devices": ["/dev/kvm:/dev/kvm"],  # Bind the KVM device for hardware acceleration
    "privileged": True,  # Required to access hardware features and KVM
    "environment": {"DISPLAY": ":0"},  # Set the DISPLAY environment variable
    "network": "cometa_testing",  # Attach the container to the 'testing' network
    "restart_policy": {"Name": "unless-stopped"},
}


docker_service_manager = DockerServiceManager()
service_information = docker_service_manager.create_service(container_configuration)
docker_service_manager.wait_for_service_to_be_running(service_information["container_id"])
docker_service_manager.delete_service(service_information["container_id"])
print(service_information)

import docker, os
import time, traceback
from backend.utility.functions import getLogger, create_tarball
from backend.utility.configurations import ConfigurationManager
from docker.errors import NullResource, NotFound
from backend.utility.uploadFile import decryptFile

logger = getLogger()


class KubernetesServiceManager:
    deployment_type = "kubernetes"

    def __init__(self):
        pass

    # This method will create the container base on the environment
    def create_service(self, configuration):
        pass

    def delete_service(self, service_name_or_id):
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
            f"Stopping service with container_name_or_id : {service_name_or_id}"
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

    def upload_file(self, service_name_or_id, file_path):
        container = self.docker_client.containers.get(service_name_or_id)

        # Destination path inside the container
        container_dest_path = "/tmp"  # Change as needed
        file_name = file_path.split("/")[-1]
        decrypted_file_path = decryptFile(file_path)
        # i.e decrypted_file /tmp/6oy2p464
        # Create the tar archive
        tar_stream = create_tarball(decrypted_file_path)
        
        # This will paste in the mobile container in the same location as decrypted_file_path 
        if container.put_archive(container_dest_path, tar_stream):
            logger.debug("APK File copied to the container")
            command = f"mv \"{decrypted_file_path}\" \"/tmp/{file_name}\""

            # Run the tar extraction command in the container
            exit_code, output = container.exec_run(command)
            if exit_code==0:
                logger.debug(f"APK File moved from file {tar_stream} to the {file_name}")
                return file_name
        return
    
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



service_manager = DockerServiceManager
if (
    ConfigurationManager.get_configuration("COMETA_DEPLOYMENT_ENVIRONMENT", "docker")
    == "kubernetes"
):
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

    def prepare_emulator_service_configuration(self, image):
        if super().deployment_type == "docker":
            info = self.inspect_service("cometa_behave")
            volume_mounts :list = info['HostConfig']['Binds']
            video_volume = [volume for volume in volume_mounts if volume.find("/opt/code/videos") >= 0][0].split(":")[0]
            logger.debug("Preparing service configuration")
            self.__service_configuration = {
                "image": image,  # Replace with your desired image name
                # "name": "emulator_appium_api_31",  # Replace with your desired container name
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
                ]
            }
        else:
            # Create Configuration for kubernetes
            pass
        return self.__service_configuration

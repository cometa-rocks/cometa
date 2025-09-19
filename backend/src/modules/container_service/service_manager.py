# author : Anand Kushwaha
# version : 10.0.0
# date : 2024-10-14

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


from backend.utility.functions import detect_deployment_environment


# src container/django container service_manager.py 

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

    def get_service_details(self):
        return self.__service_configuration
     
    def __create_pod_and_wait_to_running(self, timeout=300):
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
            # Define the body of the delete options with the grace period
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

    def create_service(self, configuration):
        try:
            self.__create_pod_and_wait_to_running()
            if not self.__create_pod_url():
                # In case pod service creation fails delete the pod 
                self.__delete_pod(pod_id = configuration['Id'])
                self.__service_configuration = configuration
                
            pod = self.v1.read_namespaced_pod(name=self.pod_manifest['metadata']['name'], namespace=self.namespace)
            return {
                        'Id':configuration['Id'],
                        'service_status':pod.status.phase,
                        'Config':{
                            'Hostname':self.get_service_name(configuration['Id'])
                        },
                        'State':{
                            'Running':pod.status.phase
                        }
                }
        except Exception:
            self.delete_service(service_name_or_id=configuration['Id'])
            logger.debug(f"Exception while creation Kubernetes service\n{configuration}")
            traceback.print_exc()
            return False      
    
    def delete_service(self, service_name_or_id):
        try:
            self.__delete_pod(pod_id = service_name_or_id)
        except Exception as e:
            traceback.print_exc()
            return False, str(e)

        try:
            self.__delete_pod_url(pod_url_id = service_name_or_id)
        except Exception as e:
            traceback.print_exc()
            return False, str(e)

        return True, "Container removed"

    

class DockerServiceManager:
    deployment_type = "docker"

    def __init__(self):
        self.__service_configuration = None
        # Initialize Docker client using the Docker socket
        self.docker_client = docker.DockerClient(base_url="unix://var/run/docker.sock")

    # This method will create the container base on the environment
    def create_service(self, configuration) -> dict:
        try:
            logger.info(f"Creating container with configuration : {configuration}")
            container = self.docker_client.containers.run(**configuration)
            return container.attrs
        except docker.errors.NotFound:
            return {"error": f"Image {configuration['image']} not found"}
        except Exception as e:
            return {"error": f"{str(e)}"}
        

    def get_service_name(self, uuid):
        return self.inspect_service(uuid)['Config']['Hostname']           
    
    def get_service_details(self):
        return self.__service_configuration

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
        logger.info(f"Deleting service with container_name_or_id: {service_name_or_id}")

        max_delete_attempts = 10
        retry_delay = 2  # seconds between retries

        for attempt in range(1, max_delete_attempts + 1):
            logger.info(f"Delete attempt {attempt} for {service_name_or_id}")
            try:
                # Find the container
                try:
                    container = self.docker_client.containers.get(service_name_or_id)
                except NotFound as not_found:
                    logger.info(f"Container not found: {service_name_or_id}. Error: {str(not_found)}")
                    return True, f"Container not found: {service_name_or_id}"

                # Check container state
                container.reload()  # Refresh state
                state = container.attrs.get('State', {})
                status = state.get('Status', 'unknown')
                logger.info(f"Container {service_name_or_id} current state: {status}")

                # Stop the container if it's running or restarting
                if status in ['running', 'restarting']:
                    logger.info(f"Killing container {service_name_or_id} (state: {status})")
                    container.stop(timeout=20)
                    # Wait for container to stop
                    for _ in range(25):
                        container.reload()
                        status = container.attrs.get('State', {}).get('Status', 'unknown')
                        if status == 'exited':
                            break
                        time.sleep(1)
                    logger.info(f"Container {service_name_or_id} stopped (state: {status})")
                else:
                    logger.info(f"Container {service_name_or_id} is not running (state: {status})")

                # Remove the container
                logger.info(f"Removing container {service_name_or_id}")
                container.remove(force=True)
                logger.info(f"Container {service_name_or_id} removed successfully")
                return True, "Container removed"

            except NotFound as not_found:
                logger.info(f"Container not found during deletion: {service_name_or_id}. Error: {str(not_found)}")
                return True, f"Container not found: {service_name_or_id}"
            except Exception as e:
                if "is already in progress" in str(e):
                    logger.info(f"Container {service_name_or_id} is already in progress.")
                    # return True, f"Container {service_name_or_id} is already in progress. Skipping deletion."
                logger.error(f"Error deleting container {service_name_or_id} on attempt {attempt}: {str(e)}")
                if attempt < max_delete_attempts:
                    logger.info(f"Retrying deletion in {retry_delay} seconds...")
                    time.sleep(retry_delay)
                else:
                    traceback.print_exc()
                    logger.error(f"Max delete attempts reached for {service_name_or_id}. Giving up.")
                    return False, f"Failed to delete container after {max_delete_attempts} attempts: {str(e)}"

        
    
    # def delete_service(self, service_name_or_id):
    #     logger.info(
    #         f"Deleting service with container_name_or_id : {service_name_or_id}"
    #     )
        
    #     max_delete_attampts = 10
        
        
    #     def clean_up():
    #         try:
    #             # Find the container
    #             container = self.docker_client.containers.get(service_name_or_id)
    #             # Stop the container if it's running
    #             container.stop()
    #             logger.info(
    #                 f"Container stopped with container_name_or_id : {service_name_or_id}"
    #             )

    #             # Remove the container
    #             container.remove()
    #             logger.info(
    #                 f"Container removed with container_name_or_id : {service_name_or_id}"
    #             )
    #             return True, "Container removed"
    #         except (NullResource, NotFound) as null_resource:
    #             logger.info(
    #                 f"Can not delete service with container_name_or_id : {service_name_or_id}, error message {str(null_resource)}"
    #             )
    #             return True, str(null_resource)
    #         except Exception as e:
    #             traceback.print_exc()
    #             return False, str(e)

    def pull_image(self, image_name):
        try:
            # Check if the image exists locally
            image_list = self.docker_client.images.list()
            for image in image_list:
                if image_name in image.tags:
                    logger.info(f"Image '{image_name}' is already available locally.")
                    return True

            # If the image is not found locally, pull it
            logger.info(f"Image '{image_name}' not found locally. Pulling from Docker Hub...")
            self.docker_client.images.pull(image_name)
            logger.info(f"Image '{image_name}' pulled successfully.")
            return True
        except Exception as e:
            logger.error(f"An error occurred while pulling the image: {str(e)}")
            traceback.print_exc()
            return False

    def upload_file(self, service_name_or_id, file_path, decrypt_file=True):
        container = self.docker_client.containers.get(service_name_or_id)

        # Destination path inside the container
        container_dest_path = "/tmp"  # Change as needed
        file_name = file_path.split("/")[-1]
        if decrypt_file:
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
            if not decrypt_file:
                return file_name
            
            command = f"mv \"{file_path}\" \"/tmp/{file_name}\""
            # Run the tar extraction command in the container
            exit_code, output = container.exec_run(command)
            if exit_code==0:
                logger.debug(f"APK File moved from file {tar_stream} to the {file_name}")
                return file_name
            else:
                raise CustomError(output)
        else:
            raise CustomError("Error while uploading apk file to server")
    
    def install_apk(self,service_name_or_id, apk_file_name):
        container = self.docker_client.containers.get(service_name_or_id)

        # Check if emulator is ready
        try:
            exit_code, output = container.exec_run("adb devices")
            if exit_code != 0:
                return False, "Unable to check emulator status. Please ensure ADB is available."
            
            # Parse the output properly
            lines = output.decode('utf-8').strip().split('\n')
            if len(lines) < 2:  # Should have header + at least one device
                return False, "No emulator device found. Please wait for the emulator to start."
            
            # Check the specific device status (skip header line)
            device_found = False
            for line in lines[1:]:
                if line.strip():  # Skip empty lines
                    parts = line.split('\t')
                    if len(parts) >= 2:
                        device_found = True
                        device_status = parts[1].strip()
                        if device_status == 'offline':
                            logger.info(f"APK installation skipped - Emulator device offline")
                            return False, "Emulator is still starting up. Please wait a moment and try again."
                        elif device_status != 'device':
                            logger.info(f"APK installation skipped - Emulator in unexpected state: {device_status}")
                            return False, f"Emulator is in unexpected state: {device_status}. Please restart the emulator."
            
            if not device_found:
                logger.info(f"APK installation skipped - No emulator device detected")
                return False, "No emulator device detected. Please ensure the emulator is running."
            
            # Check if system is fully booted
            exit_code, output = container.exec_run("adb shell getprop sys.boot_completed")
            if exit_code != 0 or output.strip() != b"1":
                logger.info(f"APK installation skipped - Android system still booting")
                return False, "Android system is still booting. Please wait a moment and try again."
            
            # Check if package service is available
            exit_code, output = container.exec_run("adb shell pm list packages -3")
            if exit_code != 0:
                if b"Can't find service: package" in output:
                    logger.info(f"APK installation skipped - Package service not ready")
                    return False, "Android package service is not ready yet. Please wait a moment and try again."
                else:
                    logger.warning(f"APK installation skipped - Package service error: {output.decode('utf-8').strip()}")
                    return False, f"Error checking package service: {output.decode('utf-8').strip()}"
                
        except Exception as e:
            return False, f"Error checking emulator status: {str(e)}"

        command = f"adb install \"/tmp/{apk_file_name}\""

        # Run the tar extraction command in the container
        exit_code, output = container.exec_run(command)
        if exit_code == 0:
            # Extract package name from the installed APK
            package_name = self._extract_package_name(service_name_or_id, apk_file_name)
            if package_name:
                return True, f"App {apk_file_name} installed with package {package_name}", package_name
            else:
                return True, f"App {apk_file_name} installed in the mobile container {service_name_or_id}", None
        else:
            return False, f"Error while installing app in the mobile container {service_name_or_id}\n{output}"

    def _extract_package_name(self, service_name_or_id, apk_file_name):
        """
        Extract package name from APK file using aapt
        """
        try:
            container = self.docker_client.containers.get(service_name_or_id)
            
            # Use aapt to extract package information
            command = f"aapt dump badging \"/tmp/{apk_file_name}\" | grep package:\ name"
            exit_code, output = container.exec_run(command)
            
            if exit_code == 0:
                output_str = output.decode('utf-8').strip()
                # Parse: package: name='com.example.app'
                if "package: name='" in output_str:
                    package_name = output_str.split("'")[1] if "'" in output_str else None
                    logger.info(f"Extracted package name: {package_name} from {apk_file_name}")
                    return package_name
                else:
                    logger.warning(f"Could not parse package name from output: {output_str}")
                    return None
            else:
                logger.warning(f"Failed to extract package name from {apk_file_name}: {output.decode('utf-8')}")
                return None
                
        except Exception as e:
            logger.error(f"Error extracting package name from {apk_file_name}: {str(e)}")
            return None

    def _get_package_name_from_filename(self, apk_file_name):
        """
        Extract package name from APK filename using common patterns
        """
        # Remove .apk extension
        name_without_ext = apk_file_name.replace('.apk', '')
        
        # Common patterns for package names in filenames
        possible_package_names = []
        
        # Pattern 1: com.example.app_123 -> com.example.app
        if '_' in name_without_ext:
            parts = name_without_ext.split('_')
            if len(parts) > 1:
                possible_package_names.append(parts[0])
        
        # Pattern 2: com.example.app-v123 -> com.example.app
        if '-' in name_without_ext:
            parts = name_without_ext.split('-')
            if len(parts) > 1:
                possible_package_names.append(parts[0])
        
        # Pattern 3: com.example.app -> com.example.app (no version)
        if '.' in name_without_ext and '_' not in name_without_ext and '-' not in name_without_ext:
            possible_package_names.append(name_without_ext)
        
        return possible_package_names

    def _find_package_by_filename(self, service_name_or_id, apk_file_name):
        """
        Find package name by searching through installed packages and matching by filename
        This is a fallback method when package name is not stored
        """
        try:
            container = self.docker_client.containers.get(service_name_or_id)
            
            # Get list of all installed packages
            command = "adb shell pm list packages -3 -f"
            exit_code, output = container.exec_run(command)
            
            if exit_code == 0:
                output_str = output.decode('utf-8').strip()
                lines = output_str.split('\n')
                
                logger.info(f"Searching for APK '{apk_file_name}' in {len(lines)} installed packages")
                
                # Search for the APK filename in the package list
                # Format: package:/data/app/com.example.app-1/base.apk=com.example.app
                for line in lines:
                    if apk_file_name in line:
                        # Extract package name from the line
                        if '=' in line:
                            package_name = line.split('=')[1].strip()
                            logger.info(f"Found package name '{package_name}' for APK '{apk_file_name}'")
                            return package_name
                
                # If exact match not found, try partial match
                logger.info(f"Exact match not found, trying partial match for '{apk_file_name}'")
                
                # Remove file extension for partial matching
                apk_name_without_ext = apk_file_name.replace('.apk', '')
                
                for line in lines:
                    if apk_name_without_ext in line:
                        if '=' in line:
                            package_name = line.split('=')[1].strip()
                            logger.info(f"Found package name '{package_name}' for APK '{apk_file_name}' (partial match)")
                            return package_name
                
                # If still not found, try to extract from the filename itself
                # Many APK filenames contain the package name
                logger.info(f"Trying to extract package name from filename '{apk_file_name}'")
                
                # Common patterns for package names in filenames
                possible_package_names = self._get_package_name_from_filename(apk_file_name)
                
                # Check if any of these possible package names are actually installed
                for possible_package in possible_package_names:
                    # Check if this package is actually installed
                    check_command = f"adb shell pm list packages | grep {possible_package}"
                    check_exit_code, check_output = container.exec_run(check_command)
                    
                    if check_exit_code == 0:
                        package_name = check_output.decode('utf-8').strip().replace('package:', '')
                        logger.info(f"Found package name '{package_name}' for APK '{apk_file_name}' (extracted from filename)")
                        return package_name
                
                logger.warning(f"Could not find package name for APK '{apk_file_name}' in installed packages")
                logger.info(f"Available packages: {lines[:5]}...")  # Show first 5 packages for debugging
                return None
            else:
                logger.warning(f"Failed to list installed packages: {output.decode('utf-8')}")
                return None
                
        except Exception as e:
            logger.error(f"Error finding package by filename for {apk_file_name}: {str(e)}")
            return None

    def uninstall_apk(self, service_name_or_id, package_name):
        """
        Uninstall APK from the mobile container using package name
        """
        container = self.docker_client.containers.get(service_name_or_id)

        # Check if emulator is ready (same checks as install_apk)
        try:
            exit_code, output = container.exec_run("adb devices")
            if exit_code != 0:
                return False, "Unable to check emulator status. Please ensure ADB is available."
            
            # Parse the output properly
            lines = output.decode('utf-8').strip().split('\n')
            if len(lines) < 2:  # Should have header + at least one device
                return False, "No emulator device found. Please wait for the emulator to start."
            
            # Check the specific device status (skip header line)
            device_found = False
            for line in lines[1:]:
                if line.strip():  # Skip empty lines
                    parts = line.split('\t')
                    if len(parts) >= 2:
                        device_found = True
                        device_status = parts[1].strip()
                        if device_status == 'offline':
                            logger.info(f"APK uninstallation skipped - Emulator device offline")
                            return False, "Emulator is still starting up. Please wait a moment and try again."
                        elif device_status != 'device':
                            logger.info(f"APK uninstallation skipped - Emulator in unexpected state: {device_status}")
                            return False, f"Emulator is in unexpected state: {device_status}. Please restart the emulator."
            
            if not device_found:
                logger.info(f"APK uninstallation skipped - No emulator device detected")
                return False, "No emulator device detected. Please ensure the emulator is running."
            
            # Check if system is fully booted
            exit_code, output = container.exec_run("adb shell getprop sys.boot_completed")
            if exit_code != 0 or output.strip() != b"1":
                logger.info(f"APK uninstallation skipped - Android system still booting")
                return False, "Android system is still booting. Please wait a moment and try again."
            
            # Check if package service is available
            exit_code, output = container.exec_run("adb shell pm list packages -3")
            if exit_code != 0:
                if b"Can't find service: package" in output:
                    logger.info(f"APK uninstallation skipped - Package service not ready")
                    return False, "Android package service is not ready yet. Please wait a moment and try again."
                else:
                    logger.warning(f"APK uninstallation skipped - Package service error: {output.decode('utf-8').strip()}")
                    return False, f"Error checking package service: {output.decode('utf-8').strip()}"
                
        except Exception as e:
            return False, f"Error checking emulator status: {str(e)}"

        # Check if package is installed
        command = f"adb shell pm list packages | grep {package_name}"
        exit_code, output = container.exec_run(command)
        if exit_code != 0:
            return False, f"Package {package_name} is not installed on the device"

        # Uninstall the package
        command = f"adb uninstall {package_name}"
        exit_code, output = container.exec_run(command)
        
        if exit_code == 0:
            return True, f"Package {package_name} uninstalled successfully from the mobile container {service_name_or_id}"
        else:
            return False, f"Error while uninstalling package {package_name} from the mobile container {service_name_or_id}\n{output}"


    def inspect_service(self,service_name_or_id):
        return self.docker_client.containers.get(service_name_or_id).attrs

# to initialize the service manager for runserver as by default DockerServiceManager
service_manager = DockerServiceManager
    
if 'runserver' in sys.argv:
    logger.debug("Loading service manager for runserver")
    service_manager = DockerServiceManager if detect_deployment_environment() == 'docker' else KubernetesServiceManager

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

    def uninstall_apk(self, service_name_or_id, package_name, *args, **kwargs):
        return super().uninstall_apk(service_name_or_id, package_name, *args, **kwargs)

    def uninstall_apk_simple(self, service_name_or_id, apk_file_name):
        """
        Simple method to uninstall APK by trying common package name patterns
        This is a fallback when package name is not known
        """
        container = self.docker_client.containers.get(service_name_or_id)
        
        # Get possible package names from filename
        possible_package_names = self._get_package_name_from_filename(apk_file_name)
        
        # Add the filename without extension as a possibility
        name_without_ext = apk_file_name.replace('.apk', '')
        if name_without_ext not in possible_package_names:
            possible_package_names.append(name_without_ext)
        
        logger.info(f"Trying to uninstall APK '{apk_file_name}' with possible package names: {possible_package_names}")
        
        # Try each possible package name
        for package_name in possible_package_names:
            try:
                logger.info(f"Trying to uninstall package: {package_name}")
                
                # Check if package is installed
                check_command = f"adb shell pm list packages | grep {package_name}"
                exit_code, output = container.exec_run(check_command)
                
                if exit_code == 0:
                    # Package is installed, try to uninstall it
                    uninstall_command = f"adb uninstall {package_name}"
                    exit_code, output = container.exec_run(uninstall_command)
                    
                    if exit_code == 0:
                        logger.info(f"Successfully uninstalled package: {package_name}")
                        return True, f"Successfully uninstalled package: {package_name}"
                    else:
                        logger.warning(f"Failed to uninstall package {package_name}: {output.decode('utf-8')}")
                else:
                    logger.info(f"Package {package_name} is not installed")
                    
            except Exception as e:
                logger.error(f"Error trying to uninstall package {package_name}: {str(e)}")
        
        return False, f"Could not uninstall APK '{apk_file_name}'. Tried package names: {possible_package_names}"

    def _find_package_by_filename(self, service_name_or_id, apk_file_name, *args, **kwargs):
        return super()._find_package_by_filename(service_name_or_id, apk_file_name, *args, **kwargs)

    def _get_package_name_from_filename(self, apk_file_name, *args, **kwargs):
        return super()._get_package_name_from_filename(apk_file_name, *args, **kwargs)

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

    def get_container_environments(self):
        # Load the container environment variables
        try:
            container_envs = ConfigurationManager.get_configuration("CONTAINER_ENVS", '{}')
            return json.loads(container_envs)
        except Exception as e:
            logger.error("Exception loading the container environments configurations", e)
            return {}
        
    def get_video_volume(self):
        info = self.inspect_service("cometa_behave")
        volume_mounts :list = info['HostConfig']['Binds']
        return [volume for volume in volume_mounts if volume.find("/data/videos") >= 0][0].split(":")[0]


    def prepare_emulator_service_configuration(self, image):
        host_mappings = self.get_host_name_mapping()
        container_envs = self.get_container_environments()
        
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
                    "AUTO_RECORD": "true",
                    **container_envs  # Add custom container environments from configuration
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

    def prepare_browser_service_configuration(self, browser="chrome", version="131.0", labels={}, devices_time_zone=None):
        # Generate a random UUID
        random_uuid = str(uuid.uuid4())
        container_image = f"cometa/{browser}:{version}"
        self.__service_configuration = { "Id": random_uuid }
        browser_memory=ConfigurationManager.get_configuration("COMETA_BROWSER_MEMORY","2")
        browser_cpu=int(ConfigurationManager.get_configuration("COMETA_BROWSER_CPU","1"))
        
        host_mappings = self.get_host_name_mapping()
        container_envs = self.get_container_environments()
        
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
                    "SE_ENABLE_TRACING": "false",
                    "SE_SESSION_REQUEST_TIMEOUT": "7200",
                    "SE_NODE_SESSION_TIMEOUT": "7200",
                    "SE_NODE_OVERRIDE_MAX_SESSIONS": "true",
                    **container_envs  # Add custom container environments from configuration
                },  # Set environment variables
                "network": "cometa_testing",  # Attach the container to the 'cometa_testing' network
                "restart_policy": {"Name": "unless-stopped"},
                "volumes":[
                    f"{video_volume}:/video",
                    # FIXME this should relative path, adding this for the demo
                    # "/development/cometa/backend/browsers/scripts/video_recorder.sh:/opt/scripts/video_recorder.sh" 

                ],  # Mount volumes
                "extra_hosts": extra_hosts,  # Add custom host mappings
                "ports": {
                    "4444/tcp": None,  # Expose Selenium port without mapping to the host
                    "5900/tcp": None   # Expose VNC port without mapping to the host
                },
                "cpu_shares": browser_cpu*1024,  # Translate CPU request/limits to Docker's CPU shares
                "mem_limit": f"{browser_memory}g",   # Set memory limit
                "labels": labels
            }
            # Add timezone if timezone is provide
            if devices_time_zone:
                self.__service_configuration["environment"]["TZ"] = devices_time_zone
                
            logger.debug(f"Browser Container Configuration {self.__service_configuration}")
            
        else:
            pod_name = self.get_pod_name(random_uuid)
            service_name = self.get_service_name(random_uuid)
            pod_selectors = {
                "browser":browser,
                "version": version,
                "Id": random_uuid,
                **labels
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
                                {"name": "SE_ENABLE_TRACING", "value": "false"},
                                {"name": "SE_SESSION_REQUEST_TIMEOUT", "value": "7200"},
                                {"name": "SE_NODE_SESSION_TIMEOUT", "value": "7200"},
                                {"name": "SE_NODE_OVERRIDE_MAX_SESSIONS", "value": "true"}
                            ] + [
                                {"name": key, "value": str(value)} 
                                for key, value in container_envs.items()
                            ],
                            "ports": [
                                {"containerPort": 4444, "protocol": "TCP"},
                                {"containerPort": 5900, "protocol": "TCP"}
                            ],
                            "volumeMounts": [
                                # {
                                #     "name": "cometa-volume",
                                #     "mountPath": "/opt/scripts/video_recorder.sh",
                                #     "subPath": "./scripts/video_recorder.sh"
                                # }, 
                                {
                                    "name": "cometa-volume",
                                    "mountPath": "/video",
                                    "subPath": "data/cometa/videos"
                                },
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
            # Add timezone if timezone is provide
            if devices_time_zone:
                self.pod_manifest["spec"]["containers"][0]["env"].append({"name": "TZ", "value": devices_time_zone})
            
            
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
        interval = 0.1
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

    
import threading

def remove_running_containers(feature_result):
    def _remove_containers():
        logger.debug(f"Removing containers for feature_result {feature_result.feature_result_id}")
        for mobile in feature_result.mobile:
            # While running mobile tests User have options to connect to already running mobile or start mobile during test
            # If Mobile was started by the test then remove it after execution 
            # If Mobile was started by the user and test only connected to it do not stop it
            if mobile['is_started_by_test']:
                logger.debug(f"Removing containers for feature_result {feature_result.feature_result_id}")
                ServiceManager().delete_service(service_name_or_id = mobile["container_service_details"]["Id"])   

        browser_container_info = feature_result.browser.get("container_service",False)
        if browser_container_info:
            ServiceManager().delete_service(service_name_or_id = browser_container_info["Id"])

    try:
        logger.debug(f"Starting a thread clean up the containers")
        # Create and start thread to handle container removal
        cleanup_thread = threading.Thread(target=_remove_containers)
        cleanup_thread.start()
        logger.debug(f"Container cleanup thread {cleanup_thread.getName()} started")
    except Exception:
        logger.debug("Exception while cleaning up the containers")
        traceback.print_exc()

import docker
import time
from datetime import datetime
import json
import os
from src.utility.common import get_logger

logger = get_logger()

def get_container_status():
    client = docker.from_env()
    containers = client.containers.list(all=True)
    
    status = {
        'timestamp': datetime.now().isoformat(),
        'containers': {}
    }
    
    for container in containers:
        container_info = {
            'name': container.name,
            'status': container.status,
            'state': container.attrs['State'],
            'health': container.attrs['State'].get('Health', {}).get('Status', 'N/A'),
            'created': container.attrs['Created'],
            'image': container.attrs['Config']['Image']
        }
        status['containers'][container.name] = container_info
    
    return status

def monitor_containers():
    while True:
        try:
            status = get_container_status()
            
            # Log the status
            logger.info(f"Container Status: {json.dumps(status, indent=2)}")
            
            # Check for unhealthy containers
            for container_name, info in status['containers'].items():
                if info['health'] == 'unhealthy':
                    logger.error(f"Container {container_name} is unhealthy!")
                if info['status'] == 'exited':
                    logger.error(f"Container {container_name} has exited!")
            
            # Wait for 30 seconds before next check
            time.sleep(30)
            
        except Exception as e:
            logger.error(f"Error monitoring containers: {str(e)}")
            time.sleep(30)  # Wait before retrying

if __name__ == "__main__":
    logger.info("Starting Container Monitoring Service...")
    monitor_containers()
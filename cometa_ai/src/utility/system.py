import subprocess
from src.utility.common import get_logger

logger = get_logger()

def find_and_kill_proc_using_fd(fd_path):
    try:
        # Find the process using the specific file descriptor
        result = subprocess.run(['ps', '-aux'], stdout=subprocess.PIPE, text=True)
        for line in result.stdout.splitlines():
            if fd_path in line:
                # Extract the PID
                pid = int(line.split()[1])
                logger.info(f"Found process {pid} using {fd_path}.")
                
                # Kill the process
                kill_result = subprocess.run(['kill', '-9', str(pid)], stdout=subprocess.PIPE, text=True)
                if kill_result.returncode == 0:
                    logger.info(f"Successfully killed process {pid}.")
                else:
                    logger.error(f"Failed to kill process {pid}.")
                break
        else:
            logger.info(f"No process found using {fd_path}.")
    
    except Exception as e:
        logger.error(f"An error occurred: {e}")

if __name__ == "__main__":
    fd_path = "/proc/"
    find_and_kill_proc_using_fd(fd_path)
import subprocess

def find_and_kill_proc_using_fd(fd_path):
    try:
        # Find the process using the specific file descriptor
        result = subprocess.run(['ps', '-aux'], stdout=subprocess.PIPE, text=True)
        for line in result.stdout.splitlines():
            if fd_path in line:
                # Extract the PID
                pid = int(line.split()[1])
                print(f"Found process {pid} using {fd_path}.")
                
                # Kill the process
                kill_result = subprocess.run(['kill', '-9', str(pid)], stdout=subprocess.PIPE, text=True)
                if kill_result.returncode == 0:
                    print(f"Successfully killed process {pid}.")
                else:
                    print(f"Failed to kill process {pid}.")
                break
        else:
            print(f"No process found using {fd_path}.")
    
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    fd_path = "/proc/"
    find_and_kill_proc_using_fd(fd_path)
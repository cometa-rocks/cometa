#!/bin/bash

# ##################################################
# First time Cometa Setup Script
# ##################################################
#
# Changelog:
# 2025-11-10 RRO Added support for cleanup of Docker container logs for Cometa containers
# 2025-09-17 RRO Added support for docker-compose-dev.yml file & cleanup of cometa containers, images, volumes, networks
# 2025-09-15 RRO Added debug mode to the script
# 2025-08-29 RRO Added check for Rosetta on Apple Silicon Macs, better logging, and show logs for all containers if no container specified
# 2024-02-16 RRO Added option to restart recreate selenoid
# 2023-08-12 RRO Added check on docker hub is reachable by downloading image "Hello-World"
# 2022-10-04 ASO changed sed logic and checking if docker is installed and running.
# 2022-10-03 ASO changing data mount point based on the parameter.
# 2022-09-08 RRO first version
#
VERSION="2025-09-17"

DOCKER_COMPOSE_COMMAND="docker-compose"
CURRENT_PATH=$PWD



#
# source our nice logger
#
HELPERS="helpers"
# source logger function if not sourced already
test `command -v log_wfr` || source "${HELPERS}/logger.sh" || exit

info "------------------------------------------------------------------------"
info "This is $0 version ${VERSION} running for your convenience"
info "------------------------------------------------------------------------"

# 
# use docker-compose.yml or docker-compose-dev.yml depending on branch name we are on
#
DOCKER_COMPOSE_FILE="docker-compose.yml"
# evaluate the branch using git branch
BRANCH=$(git branch --show-current)
if [[ "$BRANCH" != "master" ]]; then
    DOCKER_COMPOSE_FILE="docker-compose-dev.yml"
fi
info "Using $DOCKER_COMPOSE_FILE file on branch $BRANCH"

function SHOW_HELP() {
    cat <<EOF

Usage: $0 [OPTIONS]

Options:
  -h, --help                Show this help message and exit
  -v, --version             Show version information for all Cometa components
  -i, -install              Install and setup Cometa (default behavior)
  --start                   Start Cometa containers (for manual startup)
  -d, --debug               Enable debug mode (set -x)
  -l, --logs [container]    Show logs for a container (selenoid|all) or all containers if none specified
  -r, --restart [container] Restart and recreate a container (e.g. selenoid)
  --root-mount-point        Use /data as the mount point instead of ./data
  --stop-cometa             Stop all Cometa-related containers
  --remove-cometa           Backup data, stop and remove Cometa and Redis volume
  --cleanup-cometa          Clean up only Cometa-related Docker resources (containers, images, volumes, networks)
  --cleanup-images          Clean up only Docker images
  --cleanup-containers      Clean up only Docker containers
  --cleanup-volumes         Clean up only Docker volumes
  --cleanup-networks        Clean up only Docker networks
  --cleanup-logs [size]     Clean up Docker container logs for Cometa containers (default: 100MB)
  --cleanup-all             Clean up all Docker resources
  --update-docker           (WIP) Update Docker and related components
  --check-docker            Check if Docker is installed and running
  --check-docker-compose    Check if Docker Compose is available
  --check-disk-space        Check available disk space
  --check-cpu-cores         Check number of CPU cores
  --check-ram-space         Check available RAM
  --check-requirements      Check all system requirements
  --check-rosetta           Check and install Rosetta on Apple Silicon Macs

Description:
  This script sets up and manages the Cometa test automation platform using Docker.
  It checks system requirements, prepares configuration, and starts all necessary containers.

Examples:
  $0 --help
  $0 --version             # Show version information
  $0 -v                    # Show version information (short form)
  $0 --start               # Start Cometa containers manually
  $0 -install              # Install Cometa
  $0 -i                    # Install Cometa (short form)
  $0 --logs selenoid
  $0 --restart front
  $0 --stop-cometa         # Stop all Cometa containers
  $0 --cleanup-cometa      # Clean up only Cometa-related Docker resources
  $0 --cleanup-images      # Clean up only Docker images
  $0 --cleanup-logs 100    # Clean up logs larger than 100MB for Cometa containers

For more information, see the documentation or contact support.
EOF
}

function SHOW_VERSION() {
    info "=== Cometa Version Information ==="
    info "Script Version: $VERSION"

    # Frontend version
    if [[ -f "front/src/assets/config.json" ]]; then
        frontend_version=$(jq -r '.version' front/src/assets/config.json 2>/dev/null)
        info "Frontend: ${frontend_version:-N/A}"
    else
        info "Frontend: N/A (config file not found)"
    fi

    # Backend versions
    if [[ -f "backend/src/version.json" ]]; then
        backend_version=$(jq -r '.version' backend/src/version.json 2>/dev/null)
        info "Backend API: ${backend_version:-N/A}"
    else
        info "Backend API: N/A (version file not found)"
    fi

    if [[ -f "backend/behave/version.json" ]]; then
        behave_version=$(jq -r '.version' backend/behave/version.json 2>/dev/null)
        info "Behave: ${behave_version:-N/A}"
    else
        info "Behave: N/A (version file not found)"
    fi

    if [[ -f "backend/scheduler/version.json" ]]; then
        scheduler_version=$(jq -r '.version' backend/scheduler/version.json 2>/dev/null)
        info "Scheduler: ${scheduler_version:-N/A}"
    else
        info "Scheduler: N/A (version file not found)"
    fi

    if [[ -f "backend/ws-server/version.json" ]]; then
        websocket_version=$(jq -r '.version' backend/ws-server/version.json 2>/dev/null)
        info "WebSocket: ${websocket_version:-N/A}"
    else
        info "WebSocket: N/A (version file not found)"
    fi

    info "================================"
}

########################################
#
# RETRY
# Retry for curl or any other command
# $1 {curl command}
# $2 {retries}
# $3 {wait retry}
#
#
########################################
function retry() {
    retries=${2:-60}
    wait_retry=${3:-10}
    i=0;
    exitCode=0;
    while [[ "$i" -lt "$retries" ]]; do
        eval $1;
        exitCode=$?
        if [[ "$exitCode" -ne 0 ]]; then
            sleep $wait_retry
            i=$((i+1))
        else
            break
        fi
    done
    return $exitCode
}

#
# Check if docker is working
#
function checkDocker() {
    # check if docker is installed
    if [[ ! $(command -v docker) ]]; then
        error "Docker not installed, please install Docker."
        exit 5;
    fi

    # check if docker is running.
    if [[ ! $(docker ps -a) ]]; then
        error "Either docker daemon is not running or user <${USER}> does not have permissions to use docker."
        info "Please start the docker service or ask your server administrator to add user <${USER}> to 'docker' group."
        exit 5;
    fi  

    # Get the current ulimit value
    current_ulimit=$(ulimit -n)

    info "Ulimit is: $current_ulimit."
    # Check if ulimit is less than 8192
    if [ "${current_ulimit}" -lt 8192 ]; then
        error "Current ulimit is ${current_ulimit} which is not sufficient to run cometa."
cat <<EOF

Instructions to change ulimit :
    First Way
     1. Add the following line to your shell configuration file 
        e.g. In the file ~/.bashrc or ~/.bash_profile add below line

        ulimit -n 8192

     2. Restart your shell or run 'source ~/.bashrc' to apply the changes

    Second Way
     1. Open the /etc/security/limits.conf file in a text editor: i.e. sudo nano /etc/security/limits.conf
     2. Add the configuration, save and close the file

        * hard nofile 65536
        * soft nofile 65536 

     3. Restart your shell to apply the changes

Exit installation ... Exited
EOF
    exit 5;
    else
        info "Ulimit is set to ${current_ulimit}. ulimit is sufficient to run cometa "
    fi


    # Minimum required disk space in gigabytes
    minimum_disk_space=28

    # Get available disk space in gigabytes (using awk to extract the relevant information)
    # Get available disk space in gigabytes (using awk to extract the relevant information)
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS: check root disk
        available_disk_space=$(df -h / | awk 'NR==2 { print $4 }' | sed 's/Gi//')
    else
        # Linux: check Docker's storage location
        available_disk_space=$(df -h /var/lib/docker | awk 'NR==2 { print $4 }' | sed 's/G//')
    fi
    # Extract only the numeric part (including decimal point)
    available_disk_space=$(echo "$available_disk_space" | sed 's/[^0-9.]//g')

    info "Available disk space: $available_disk_space GB."

    # Check if available disk space is less than the minimum required
    if (( available_disk_space < minimum_disk_space )); then
        warning "Warning: Cometa Container normally use around $minimum_disk_space Available disk space is less than $minimum_disk_space GB. Consider freeing up space or upgrade."
        error "Exit installation ... Exited"
        exit 5;
    else
        info "Disk space is sufficient."
    fi


    # check if docker hub is reachable
    if [[ ! $(docker pull "hello-world" ) ]]; then
        error "Docker pull command did not excute correctly. Dockerhub is not reachable.";
        info "--------------------------------------------------------------------------"
        info "Please check your internet connection.";
        info "If running behind a secure proxy, check ~/.docker/config.json ";
        info "And check /etc/systemd/system/docker.service.d/http_proxy.conf to contain the needed";
        info "If you cannot find a solution, please contact us. We are happy to help you.";
        exit 5;
    else
        info "[OK] Checked that docker hub is reachable and images can be downloaded."
        docker rmi hello-world 2>&1 >/dev/null || info "Hello-world image could not be removed"
    fi
}

#
# Switches /data to ./data depending on the parameters
#
function switchDataMountPoint() {
    # check if first parameter contains root
    if [[ "$1" == "root" ]]; then
        # change ./data => /data
        sed -i_template "s#- \./data#- /data#g" ${DOCKER_COMPOSE_FILE}
    else
        # change /data => ./data
        sed -i_template "s#- /data#- \./data#g" ${DOCKER_COMPOSE_FILE}
    fi
}

function checkDockerCompose() {
    # Check if docker-compose is installed.
    if [[ ! -x "$(command -v docker-compose)" ]]; then
        # Check if docker compose is installed.
        if [[ ! $(docker compose version) ]]; then
            error "Missing docker compose and docker-compose. Please install docker compose and try again."
            exit 5;
        else
            info "docker compose (without dash) is available"
            DOCKER_COMPOSE_COMMAND="docker compose"
        fi
    else
        info "docker-compose is available"
    fi
}

function checkDiskSpace() {
    # Disk space check. If too low, the script exits.
    if [[ $(df -h / | awk 'NR==2 {print $4}' | sed 's/G//') < 10 ]]; then
        error "Insufficient disk space."
        info "Please make sure you have at least 10Gb free on your disk for the installation."
        exit 5;
    fi
}

function checkCPUCores() {
    num_cores=$(getconf _NPROCESSORS_ONLN)
    info "Your CPU has $num_cores cores."
    # Checks the total number of CPU's. If too low sends a warning.
    if [[ $num_cores -lt 8 ]]; then
        info "Compared your CPU's core number to be at least 8."
        info "Your CPU has less than 8 cores. Cometa may perform slower than usual."
    else
        info "Cometa will run smoothly."
    fi
}

function checkRAMSpace() {
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS: get total memory in bytes, convert to GB
        total_mem_bytes=$(sysctl -n hw.memsize)
        total_mem_gb=$((total_mem_bytes / 1024 / 1024 / 1024))
    else
        # Linux: get total memory in GB
        total_mem_gb=$(free -g | awk '/^Mem/ {print $2}')
    fi

    info "Your system has $total_mem_gb GB of RAM."
    if [[ $total_mem_gb -lt 8 ]]; then
        info "Compared your RAM memory to be at least 8Gb."
        info "Your RAM memory is lower than 8Gb. Cometa may run into performance issues."
    else
        info "Cometa will fit in there nicely."
    fi
}

function checkRequirements() {
    checkDocker
    checkDockerCompose
    checkDiskSpace
    checkCPUCores
    checkRAMSpace
}

function checkRosetta() {
    if [[ "$(uname)" == "Darwin" ]]; then
        # Check if running on Apple Silicon (ARM64)
        if [[ "$(uname -m)" == "arm64" ]]; then
            info "Detected Apple Silicon (ARM64) architecture"

            # Check if Rosetta is already installed
            if pgrep oahd >/dev/null 2>&1; then
                info "Rosetta is already installed and running"
                return 0
            else
                info "Rosetta is not installed. Installing now..."
                if softwareupdate --install-rosetta --agree-to-license; then
                    info "Rosetta installed successfully"
                else
                    error "Failed to install Rosetta"
                    return 1
                fi
            fi

            # Enable Rosetta support in Docker
            info "Enabling Rosetta support in Docker..."
            if docker run --rm --privileged multiarch/qemu-user-static --reset -p yes; then
                info "Rosetta support enabled in Docker"
            else
                warning "Failed to enable Rosetta support in Docker"
            fi
        else
            info "Running on Intel Mac, Rosetta not needed"
        fi
    else
        info "Not running on macOS, Rosetta not needed"
    fi
}

function updateCrontab() {
    if ! ( crontab -l 2>/dev/null | grep -Fq "${1}" ); then
        ( crontab -l 2>/dev/null; echo "${1}" ) | crontab -
        debug "Crontab ${2}  created."
    else
        debug "Crontab ${2}  already exists."
    fi
}


function initiate_config_dirs(){
    info "Initiating config dirs"
    if ./scripts/init_dirs.sh; then
        info "Initiating config dirs - DONE"
    else
        warning "Failed to initiate config dirs"
    fi
}

# Function to get Cometa-related container names from docker-compose files
get_cometa_containers() {
    local containers=()

    # Check both docker-compose files for container names
    for compose_file in "docker-compose.yml" "docker-compose-dev.yml"; do
        if [[ -f "$compose_file" ]]; then
            # Extract container names from docker-compose files
            while IFS= read -r line; do
                if [[ "$line" =~ container_name:[[:space:]]*(.+) ]]; then
                    containers+=("${BASH_REMATCH[1]}")
                fi
            done < "$compose_file"
        fi
    done

    # Add common Cometa container patterns
    containers+=("cometa_"*)

    printf '%s\n' "${containers[@]}" | sort -u
}

# Function to get Cometa-related image names
get_cometa_images() {
    local images=()

    # Check both docker-compose files for image names
    for compose_file in "docker-compose.yml" "docker-compose-dev.yml"; do
        if [[ -f "$compose_file" ]]; then
            # Extract image names from docker-compose files
            while IFS= read -r line; do
                if [[ "$line" =~ image:[[:space:]]*(.+) ]]; then
                    images+=("${BASH_REMATCH[1]}")
                fi
            done < "$compose_file"
        fi
    done

    # Add common Cometa image patterns
    images+=("cometa/"*)

    printf '%s\n' "${images[@]}" | sort -u
}

# Function to get Cometa-related volumes
get_cometa_volumes() {
    local volumes=()

    # Check both docker-compose files for volume names
    for compose_file in "docker-compose.yml" "docker-compose-dev.yml"; do
        if [[ -f "$compose_file" ]]; then
            # Extract volume names from docker-compose files
            while IFS= read -r line; do
                if [[ "$line" =~ ^[[:space:]]*[a-zA-Z0-9_-]+:[[:space:]]*$ ]]; then
                    # This is a named volume definition
                    volume_name=$(echo "$line" | sed 's/^[[:space:]]*\([a-zA-Z0-9_-]*\):[[:space:]]*$/\1/')
                    if [[ -n "$volume_name" ]]; then
                        volumes+=("$volume_name")
                    fi
                fi
            done < "$compose_file"
        fi
    done

    # Add common Cometa volume patterns
    volumes+=("cometa_"*)
    volumes+=("redis_data")

    printf '%s\n' "${volumes[@]}" | sort -u
}

# Function to stop Cometa containers
stop_cometa_containers() {
    info "Stopping Cometa-related containers..."

    local stopped_count=0

    # Get all running containers and filter by image name containing "cometa"
    local cometa_containers=($(docker ps --format "{{.Names}}" | while read name; do
        local image=$(docker inspect --format='{{.Config.Image}}' "$name" 2>/dev/null)
        if [[ "$image" == *"cometa"* ]]; then
            echo "$name"
        fi
    done))

    # Also get containers by name patterns from docker-compose
    local compose_containers=($(get_cometa_containers))

    # Combine both lists
    local all_containers=("${cometa_containers[@]}" "${compose_containers[@]}")

    # Remove duplicates
    local unique_containers=($(printf '%s\n' "${all_containers[@]}" | sort -u))

    # Debug: show what containers we found
    if [[ ${#unique_containers[@]} -gt 0 ]]; then
        info "Found Cometa containers: ${unique_containers[*]}"
    else
        info "No Cometa containers found"
    fi

    for container in "${unique_containers[@]}"; do
        if docker ps -q --filter "name=$container" | grep -q .; then
            info "Stopping container: $container"
            if docker stop "$container" 2>/dev/null; then
                ((stopped_count++))
            else
                warning "Failed to stop container: $container"
            fi
        fi
    done

    info "Stopped $stopped_count Cometa containers"
}

# Function to remove Cometa containers
remove_cometa_containers() {
    info "Removing Cometa-related containers..."

    local containers=($(get_cometa_containers))
    local removed_count=0

    for container in "${containers[@]}"; do
        if docker ps -a -q --filter "name=$container" | grep -q .; then
            info "Removing container: $container"
            if docker rm "$container" 2>/dev/null; then
                ((removed_count++))
            else
                warning "Failed to remove container: $container"
            fi
        fi
    done

    info "Removed $removed_count Cometa containers"
}

# Function to remove Cometa images
remove_cometa_images() {
    info "Removing Cometa-related images..."

    local images=($(get_cometa_images))
    local removed_count=0

    for image in "${images[@]}"; do
        if docker images -q "$image" | grep -q .; then
            info "Removing image: $image"
            if docker rmi "$image" 2>/dev/null; then
                ((removed_count++))
            else
                warning "Failed to remove image: $image"
            fi
        fi
    done

    info "Removed $removed_count Cometa images"
}

# Function to remove Cometa volumes
remove_cometa_volumes() {
    info "Removing Cometa-related volumes..."

    local volumes=($(get_cometa_volumes))
    local removed_count=0

    for volume in "${volumes[@]}"; do
        if docker volume ls -q --filter "name=$volume" | grep -q .; then
            info "Removing volume: $volume"
            if docker volume rm "$volume" 2>/dev/null; then
                ((removed_count++))
            else
                warning "Failed to remove volume: $volume"
            fi
        fi
    done

    info "Removed $removed_count Cometa volumes"
}

# Function to prune Cometa networks
prune_cometa_networks() {
    info "Pruning Cometa-related networks..."

    # Get Cometa networks
    local networks=($(docker network ls --format "{{.Name}}" | grep -E "(cometa|testing)"))
    local pruned_count=0

    for network in "${networks[@]}"; do
        if [[ "$network" != "bridge" && "$network" != "host" && "$network" != "none" ]]; then
            info "Removing network: $network"
            if docker network rm "$network" 2>/dev/null; then
                ((pruned_count++))
            else
                warning "Failed to remove network: $network"
            fi
        fi
    done

    info "Pruned $pruned_count Cometa networks"
}

# Function to clean up Docker container logs for Cometa containers only
cleanup_cometa_container_logs() {
    info "Starting Docker container logs cleanup for Cometa containers..."
    
    local max_size_mb=${1:-100}  # Default to 100MB if not specified
    local max_size_bytes=$((max_size_mb * 1024 * 1024))
    
    # Get all Cometa container names
    local cometa_containers=($(get_cometa_containers))
    
    if [[ ${#cometa_containers[@]} -eq 0 ]]; then
        info "No Cometa containers found"
        return 0
    fi
    
    info "Found ${#cometa_containers[@]} Cometa container(s) to check: ${cometa_containers[*]}"
    
    local total_size_freed=0
    local files_processed=0
    local files_truncated=0
    local files_failed=0
    
    # Process each Cometa container
    for container_name in "${cometa_containers[@]}"; do
        # Get container ID (works for both running and stopped containers)
        local container_id=$(docker inspect --format='{{.Id}}' "$container_name" 2>/dev/null)
        
        if [[ -z "$container_id" ]]; then
            info "Container '$container_name' not found, skipping"
            continue
        fi
        
        # Get log file path directly from Docker (most reliable method)
        # This works regardless of where Docker stores its data
        local log_file_path=$(docker inspect --format='{{.LogPath}}' "$container_name" 2>/dev/null)
        
        # If LogPath is not available, try to construct it from common locations
        if [[ -z "$log_file_path" || ! -f "$log_file_path" ]]; then
            # Try to get Docker root directory
            local docker_root=$(docker info --format '{{.DockerRootDir}}' 2>/dev/null)
            
            if [[ -n "$docker_root" ]]; then
                log_file_path="${docker_root}/containers/${container_id}/${container_id}-json.log"
            else
                # Fall back to common paths
                local common_paths=(
                    "/var/lib/docker/containers/${container_id}/${container_id}-json.log"
                    "$HOME/Library/Containers/com.docker.docker/Data/vms/0/data/docker/containers/${container_id}/${container_id}-json.log"
                    "/var/snap/docker/common/var-lib-docker/containers/${container_id}/${container_id}-json.log"
                )
                
                for test_path in "${common_paths[@]}"; do
                    if [[ -f "$test_path" ]]; then
                        log_file_path="$test_path"
                        break
                    fi
                done
            fi
        fi
        
        if [[ -z "$log_file_path" || ! -f "$log_file_path" ]]; then
            info "Log file not found for container '$container_name' (ID: ${container_id:0:12}), skipping"
            continue
        fi
        
        files_processed=$((files_processed + 1))
        
        # Get file size (works on both Linux and macOS)
        local file_size=$(stat -f%z "$log_file_path" 2>/dev/null || stat -c%s "$log_file_path" 2>/dev/null)
        
        if [[ -z "$file_size" ]]; then
            warning "Could not get file size for $log_file_path"
            files_failed=$((files_failed + 1))
            continue
        fi
        
        local size_mb=$((file_size / 1024 / 1024))
        
        if [[ $file_size -gt $max_size_bytes ]]; then
            # Truncate the file (safer than deleting - Docker will continue writing)
            if truncate -s 0 "$log_file_path" 2>/dev/null || : > "$log_file_path" 2>/dev/null; then
                files_truncated=$((files_truncated + 1))
                total_size_freed=$((total_size_freed + file_size))
                info "Truncated log for '$container_name' (was ${size_mb} MB) at $log_file_path"
            else
                warning "Failed to truncate log for '$container_name' at $log_file_path"
                files_failed=$((files_failed + 1))
            fi
        else
            info "Log for '$container_name' is ${size_mb} MB (within ${max_size_mb} MB limit), skipping"
        fi
    done
    
    local total_size_freed_mb=$((total_size_freed / 1024 / 1024))
    
    info "============================================"
    info "Docker container logs cleanup completed:"
    info "- Files processed: $files_processed"
    info "- Files truncated: $files_truncated"
    info "- Files failed: $files_failed"
    info "- Total size freed: ${total_size_freed_mb} MB"
    info "============================================"
}

# Main cleanup function for Cometa-specific resources
cleanup_cometa() {
    info "Starting Cometa-specific cleanup..."

    # Stop Cometa containers first
    stop_cometa_containers

    # Remove Cometa containers
    remove_cometa_containers

    # Remove Cometa images
    remove_cometa_images

    # Remove Cometa volumes
    remove_cometa_volumes

    # Prune Cometa networks
    prune_cometa_networks

    info "Cometa cleanup completed successfully!"

    # Show remaining Docker resources
    info "Remaining Docker resources:"
    info "Containers:"
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" 2>/dev/null || true

    info "Images:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" 2>/dev/null || true

    info "Volumes:"
    docker volume ls --format "table {{.Name}}\t{{.Driver}}" 2>/dev/null || true

    info "Networks:"
    docker network ls --format "table {{.Name}}\t{{.Driver}}" 2>/dev/null || true
}

# Function to remove all containers
remove_all_containers() {
    info "Stopping all running containers..."
    docker stop $(docker ps -q) 2>/dev/null || true

    info "Removing all containers..."
    docker rm $(docker ps -a -q) 2>/dev/null || true
}

# Function to remove all images
remove_all_images() {
    info "Removing all images..."
    docker rmi $(docker images -q) 2>/dev/null || true
}

# Function to remove all volumes
remove_all_volumes() {
    info "Removing all volumes..."
    docker volume rm $(docker volume ls -q) 2>/dev/null || true
}

# Function to prune all networks
prune_all_networks() {
    info "Pruning unused networks..."
    docker network prune -f 2>/dev/null || true
}

# Main cleanup function for all Docker resources
cleanup_all() {
    info "Starting complete Docker cleanup..."

    remove_all_containers
    remove_all_images
    remove_all_volumes
    prune_all_networks

    info "Complete cleanup finished!"

    # Show remaining Docker resources
    info "Remaining Docker resources:"
    info "Containers:"
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}" 2>/dev/null || true

    info "Images:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" 2>/dev/null || true

    info "Volumes:"
    docker volume ls --format "table {{.Name}}\t{{.Driver}}" 2>/dev/null || true

    info "Networks:"
    docker network ls --format "table {{.Name}}\t{{.Driver}}" 2>/dev/null || true
}

function get_cometa_up_and_running() {

    #
    # Switch mount point based on MOUNTPOINT
    #
    switchDataMountPoint "${MOUNTPOINT:-local}"

    #
    # Create directory schedules
    #
    if [ ! -d backend/behave/schedules ]; then
        mkdir -p backend/behave/schedules && info "Created schedules directory"
    fi

    #
    # If crontab is a directory ... remove it
    #
    if [ -d backend/behave/schedules/crontab ]; then
        rm -rq backend/behave/schedules/crontab && info "Removed crontab directory"
    fi


    #
    # Touch crontab schedules
    #
    if [ ! -f backend/behave/schedules/crontab ]; then
        touch backend/behave/schedules/crontab && info "Created crontab file"
    fi

    #
    # Calls updateCrontab to update browsers and restart gunicorn
    #
    info "Updating crontab for housekeeping and gunicorn"
    updateCrontab "0 0 * * * cd $CURRENT_PATH/backend/scripts && ./housekeeping.sh" "housekeeping.sh"
    updateCrontab "0 0 * * * bash -c \"docker exec cometa_django fuser -k -HUP 8000/tcp\"" "gunicorn"


    #
    # Replace <server> in docker-compose-dev.yml with "local"
    #
    sed -i_template "s|<server>|local|g" ${DOCKER_COMPOSE_FILE} && info "Replaced <server> in ${DOCKER_COMPOSE_FILE} with local"

    #
    # Replace <outside_port> in docker-compose-dev.yml with "80"
    #
    sed -i_template "s|<outside_port>|80|g" ${DOCKER_COMPOSE_FILE} && info "Replaced <outside_port> in ${DOCKER_COMPOSE_FILE} with 80"

    #
    # Check if data/front/apache2/metadata/accounts.google.com.client or data/front/apache2/metadata/git.amvara.de.client exists
    #
    if [ ! -f "data/front/apache2/metadata/accounts.google.com.client" ] && [ ! -f "data/front/apache2/metadata/git.amvara.de.client" ]; then
        warning "data/front/apache2/metadata/accounts.google.com.client nor data/front/apache2/metadata/git.amvara.de.client file does not exist"
        warning "Please create it and add your oAuth client credentials"
        exit 5
    fi

    #
    # Check client id has been replaced
    #
    if grep -Rq "COMETA" "data/front/apache2/metadata/accounts.google.com.client"  ; then
        warning "Found default string in front/apache2/metadata/accounts.google.com.client file - you must replace this before going forward."
        read -n 1 -s -r -p "Press any key to continue"
        if grep -Rq "GITCLIENTID" "data/front/apache2/metadata/git.amvara.de.client"  ; then
            warning "Found default string in front/apache2/metadata/git.amvara.de.client file - you must replace this before going forward."
            warning "If neither Google nor Gitlab is configured, you will not be able to login."
            warning "Going forward with installation does not make sense, until SSO is configured. Exiting."
            warning "Goto git.amvara.de, create an account. Goto Settings, Applications, add new Application and retrieve your access token."
            exit
        else
            info "The default string in git.amvara.de.client was replaced with something else - hopefully your Gitlab oAuth client credentials";
        fi
    else
        info "The default string in accounts.google.com.client was replaced with something else - hopefully your google oAuth client credentials";
    fi

    #
    # Touch browsers.json
    #
    if [ ! -f backend/selenoid/browsers.json ] || [ $(cat backend/selenoid/browsers.json | grep . | wc -l) -eq 0 ]; then
        RUNSELENOIDSCRIPT=true
        echo "{}" > backend/selenoid/browsers.json && info "Created browsers.json file"
    fi

    #
    # Bring up the system
    #
    info "Starting containers"
    info "using ${DOCKER_COMPOSE_COMMAND} command"
    $DOCKER_COMPOSE_COMMAND -f ${DOCKER_COMPOSE_FILE} up -d && info "Started docker ... now waiting for container to come alive " || warning "docker compose command finished with error"

    #
    # How to wait for System ready?
    #


    #
    # Check selenoid browsers
    #
    if [ "${RUNSELENOIDSCRIPT:-false}" = "true" ]; then
        info "Downloading latest browser versions"
        ./backend/selenoid/deploy_selenoid.sh -n 1 || warning "Something went wrong getting the latests browsers for the system"
    fi

    #
    # parse browsers and actions
    #

    # check health status
    # Max retries
    MAX_RETRIES=60
    # wait between retries
    WAIT_RETRY=10
    # Total timeout
    TOTAL_TIMEOUT=$(($MAX_RETRIES*$WAIT_RETRY))

    # Disable docker hints
    export DOCKER_CLI_HINTS=false

    info "Waiting for containers to become healthy (timeout: ${TOTAL_TIMEOUT} seconds)..."

    # check if docker-compose contains django start command
    if ! grep -qE '^\s*command:\s*bash start\.sh' ${DOCKER_COMPOSE_FILE}; then
        info "Django service command is NOT 'bash start.sh -dev'"
        # your logic here
    fi


    # Check inside django container if gunicorn is running
    log_wfr "Waiting for gunicorn to start "
    docker exec -it cometa_django ps aux | grep gunicorn | grep -v grep > /dev/null 2>&1 && log_res "[done]" || { log_res "[failed]"; info "Re-Starting cometa_django container"; docker exec cometa_django ./start.sh > /dev/null 2>&1 & }

    # Wait for django to become healthy
    log_wfr "Waiting for parseBrowsers "
    retry "docker exec -it cometa_django curl --fail http://localhost:8000/parseBrowsers/ -o /dev/null -s " && log_res "[done]" || { log_res "[failed]"; warning "Waited for ${TOTAL_TIMEOUT} seconds, docker-container django is not running"; }

    log_wfr "Waiting for parseActions "
    retry "docker exec -it cometa_django curl --fail http://localhost:8000/parseActions/ -o /dev/null -s " && log_res "[done]" || { log_res "[failed]"; warning "Waited for ${TOTAL_TIMEOUT} seconds, docker-container django is not running"; }

    log_wfr "Waiting for frontend to compile angular typescript into executable code "
    retry "curl --fail --insecure https://localhost/ -o /dev/null  -s -L" && log_res "[done] Feeling happy " || { log_res "[failed]"; warning "Waited for ${TOTAL_TIMEOUT} seconds, docker-container front is not running"; }

    export DOCKER_CLI_HINTS=true

} # end of function get_cometa_up_and_running

#
# Start Cometa containers (simplified version for manual start)
#
function start_cometa() {
    info "Starting Cometa containers..."

    # Check if docker-compose file exists
    if [[ ! -f "${DOCKER_COMPOSE_FILE}" ]]; then
        error "Docker compose file ${DOCKER_COMPOSE_FILE} not found!"
        exit 1
    fi

    # Clean up any orphaned networks and containers first
    info "Cleaning up orphaned Docker resources..."
    
    # Stop any existing Cometa containers that might be in a bad state
    info "Stopping any existing Cometa containers..."
    docker-compose -f ${DOCKER_COMPOSE_FILE} down --remove-orphans > /dev/null 2>&1 || true
    
    # Clean up orphaned networks
    info "Cleaning up orphaned Docker networks..."
    docker network prune -f > /dev/null 2>&1 || true

    # Start containers
    info "Using ${DOCKER_COMPOSE_COMMAND} command with file ${DOCKER_COMPOSE_FILE}"
    if ${DOCKER_COMPOSE_COMMAND} -f ${DOCKER_COMPOSE_FILE} up -d; then
        info "Containers started successfully!"

        # Show container status
        info "Container status:"
        ${DOCKER_COMPOSE_COMMAND} -f ${DOCKER_COMPOSE_FILE} ps

        info "Cometa should be available at https://localhost/"
        info "Use './cometa.sh --logs' to view container logs"
    else
        error "Failed to start containers. Check the logs above for details."
        info "Try running: docker system prune -f && docker network prune -f"
        exit 1
    fi
}

#
# Clean up Docker networks (Cometa-specific version)
#
function cleanup_networks() {
    info "Cleaning up Cometa-specific Docker networks..."

    # Get Cometa networks from docker-compose files
    local cometa_networks=()

    # Check both docker-compose files for network names
    for compose_file in "docker-compose.yml" "docker-compose-dev.yml"; do
        if [[ -f "$compose_file" ]]; then
            # Extract network names from the networks section
            in_networks_section=false
            while IFS= read -r line; do
                if [[ "$line" =~ ^networks:[[:space:]]*$ ]]; then
                    in_networks_section=true
                    continue
                elif [[ "$line" =~ ^[a-zA-Z] ]] && [[ "$in_networks_section" == "true" ]]; then
                    # We've moved to a new top-level section, exit networks section
                    in_networks_section=false
                    continue
                elif [[ "$in_networks_section" == "true" ]] && [[ "$line" =~ ^[[:space:]]+([a-zA-Z0-9_-]+):[[:space:]]*$ ]]; then
                    # This is a network definition
                    network_name="${BASH_REMATCH[1]}"
                    cometa_networks+=("$network_name")
                fi
            done < "$compose_file"
        fi
    done

    # Add common Cometa network patterns
    cometa_networks+=("cometa_"*)
    cometa_networks+=("testing")

    # Remove duplicates
    local unique_networks=($(printf '%s\n' "${cometa_networks[@]}" | sort -u))

    # Debug: show what networks we found
    if [[ ${#unique_networks[@]} -gt 0 ]]; then
        info "Found Cometa networks: ${unique_networks[*]}"
    else
        info "No Cometa networks found"
    fi

    # Stop Cometa containers first to free up networks
    stop_cometa_containers

    # Remove only Cometa-specific networks
    local removed_count=0
    for network in "${unique_networks[@]}"; do
        if docker network ls --format "{{.Name}}" | grep -q "^${network}$"; then
            info "Removing network: $network"
            if docker network rm "$network" 2>/dev/null; then
                ((removed_count++))
            else
                warning "Failed to remove network: $network (may be in use by other containers)"
            fi
        fi
    done

    # Prune unused networks (this is safe as it only removes unused networks)
    info "Pruning unused networks..."
    docker network prune -f

    info "Removed $removed_count Cometa networks"
    info "Network cleanup completed!"
}

#
# Show logfiles of docker containers
#
function show_logfiles() {
    if [[ -z "$container_name" ]]; then
        # No container specified, show all running containers and their logs
        info "No container specified. Showing all running containers:"
        ${DOCKER_COMPOSE_COMMAND} -f ${DOCKER_COMPOSE_FILE} ps

        info "Showing logs from all containers (last 10 lines):"
        ${DOCKER_COMPOSE_COMMAND} -f ${DOCKER_COMPOSE_FILE} logs -f --tail=10
    else
        case $container_name in
            selenoid)
                docker logs -f --tail=100 cometa_selenoid
                ;;
            all)
                ${DOCKER_COMPOSE_COMMAND} -f ${DOCKER_COMPOSE_FILE} logs -f --tail=100
                ;;
            *)
                # Try to show logs for the specified container
                if ${DOCKER_COMPOSE_COMMAND} ps | grep -q "$container_name"; then
                    ${DOCKER_COMPOSE_COMMAND} -f ${DOCKER_COMPOSE_FILE} logs -f --tail=100 "$container_name"
                else
                    error "Container '$container_name' not found or not running"
                    info "Available containers:"
                    ${DOCKER_COMPOSE_COMMAND} -f ${DOCKER_COMPOSE_FILE} ps
                    exit 1
                fi
                ;;
        esac
    fi
}

#
# Switch case for grab information to save it
#
# * Reminder: first debug, then help and last the other options
while [[ $# -gt 0 ]]
do
    case "$1" in
        -d | --debug)
            set -x
            shift
            ;;
        -h | --help)
            SHOW_HELP
            exit 0
            ;;
        -v | --version)
            SHOW_VERSION
            exit 0
            ;;
        --start)
            start_cometa
            exit 0
            ;;
        -l|--logs)
            container_name=$2
            if [[ -n "$container_name" ]]; then
                shift 2  # Consume both the option and the container name
            else
                shift    # Only consume the option
            fi
            show_logfiles
            exit 0
            ;;
        --update-docker) # Work in progress
            # for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do sudo apt-get remove $pkg; done
            exit 0
            ;;
        -r | --restart)
            container_name=$2
            info "Recreating '$container_name'"
            # Get service name from container name automatically
            service_name=$(docker ps --format "table {{.Names}}\t{{.Labels}}" | grep "$container_name" | grep -o 'com.docker.compose.service=[^,]*' | cut -d= -f2)
            if [ -z "$service_name" ]; then
                # Fallback: try to find service by container name in compose file
                service_name=$(grep -B5 -A5 "container_name: $container_name" ${DOCKER_COMPOSE_FILE} | grep -E '^[[:space:]]*[a-zA-Z0-9_-]+:' | head -1 | cut -d: -f1 | tr -d ' ')
            fi
            ${DOCKER_COMPOSE_COMMAND} -f ${DOCKER_COMPOSE_FILE} up -d --force-recreate $service_name && info [ok] || warn "Restarting failed. look at the logs"
            exit 0
            ;;
        --root-mount-point)
            MOUNTPOINT="root"
            shift
            ;;
        --stop-cometa)
            stop_cometa_containers
            exit 0
            ;;
        --remove-cometa)
            info "Backup data directory"
            tar -czvf ../cometa_data.tgz data/
            info "Stopping Cometa"
            ${DOCKER_COMPOSE_COMMAND} -f ${DOCKER_COMPOSE_FILE} down
            info "Removing Cometa Redis volume"
            docker volume rm cometa_redis_data
            info "Cometa has been removed. You are save to delete this directory and start with a fresh clone."
            exit 0
            ;;
        --cleanup-cometa)
            cleanup_cometa
            exit 0
            ;;
        --cleanup-images)
            info "Cleaning up only Docker images..."
            remove_all_images
            info "Image cleanup completed!"
            exit 0
            ;;
        --cleanup-containers)
            info "Cleaning up only Docker containers..."
            remove_all_containers
            info "Container cleanup completed!"
            exit 0
            ;;
        --cleanup-volumes)
            info "Cleaning up only Docker volumes..."
            remove_all_volumes
            info "Volume cleanup completed!"
            exit 0
            ;;
        --cleanup-networks)
            cleanup_networks
            exit 0
            ;;
        --cleanup-logs)
            # Check if next argument is a number (size in MB)
            if [[ -n "$2" && "$2" =~ ^[0-9]+$ ]]; then
                max_size=$2
                shift  # Consume the size argument
            else
                max_size=100  # Default to 100MB
            fi
            cleanup_cometa_container_logs "$max_size"
            exit 0
            ;;
        --cleanup-all)
            cleanup_all
            exit 0
            ;;
        --check-docker)
            checkDocker
            exit 0
            ;;
        --check-docker-compose)
            checkDockerCompose
            exit 0
            ;;
        --check-disk-space)
            checkDiskSpace
            exit 0
            ;;
        --check-cpu-cores)
            checkCPUCores
            exit 0
            ;;
        --check-ram-space)
            checkRAMSpace
            exit 0
            ;;
        --check-requirements)
            checkRequirements
            exit 0
            ;;
        --check-rosetta)
            checkRosetta
            exit 0
            ;;
        -i | -install)
            # This will fall through to the default installation behavior
	    install=1
	    shift
            ;;
        *)
            SHOW_HELP
            exit 0
            ;;
    esac
done

# Only proceed with installation if -i or -install was specified
if [[ "$install" == "1" || "$1" == "-install" ]]; then
    checkRequirements
    initiate_config_dirs
    get_cometa_up_and_running

    info "The test automation platform is ready to rumble at https://localhost/"
    info "Thank you for using the easy peasy setup script."
else
    # Show help by default if no valid option was provided
    SHOW_HELP
    exit 0
fi

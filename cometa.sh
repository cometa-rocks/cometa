#!/bin/bash

# ##################################################
# First time Cometa Setup Script
# ##################################################
#
# Changelog:
# 2022-10-03 ASO changing data mount point based on the parameter.
# 2022-09-08 RRO first version
#
VERSION="2022-09-08"


#
# source our nice logger
#
HELPERS="helpers"
# source logger function if not sourced already
test `command -v log_wfr` || source "${HELPERS}/logger.sh" || exit

info "This is $0 version ${VERSION} running for your convinience"

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
# Switches /data to ./data depending on the parameters
#
function switchDataMountPoint() {
    # check if first parameter contains root
    if [[ "$1" == "root" ]]; then
        # change ./data => /data
        sed -i "s#- \./data#- /data#g" docker-compose.yml
    else
        # change /data => ./data
        sed -i "s#- /data#- \./data#g" docker-compose.yml
    fi
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
# Touch browsers.json
#
if [ ! -f backend/selenoid/browsers.json ] || [ $(cat backend/selenoid/browsers.json | grep . | wc -l) -eq 0 ]; then
    RUNSELENOIDSCRIPT=true
	echo "{}" > backend/selenoid/browsers.json && info "Created browsers.json file"
fi

#
# Replace <server> in docker-compose.yml with "local"
#
sed -i "s|<server>|local|g" docker-compose.yml && info "Replaced <server> in docker-compose.yml with local"

#
# Replace <outside_port> in docker-compose.yml with "80"
#
sed -i "s|<outside_port>|80|g" docker-compose.yml && info "Replaced <outside_port> in docker-compose.yml with 80"

#
# Check client id has been replaced
#
if grep -Rq "COMETA" "front/apache-conf/metadata/accounts.google.com.client"  ; then 
	warning "Found default string in accounts.google.com.client file - you must replace this before going forward";
	exit	
else 
	info "The default string in accounts.google.com.client was replaced with something else - hopefully your google oAuth client credentials";
fi

#
# Bring up the system
#
info "Starting containers"
docker-compose up -d && info "Started docker ... now waiting for container to come alive " || warn "docker-compose command finished with error"

#
# How to wait for System ready?
#


#
# Check selenoid browsers
#
if [ "${RUNSELENOIDSCRIPT:-false}" = "true" ]; then
	info "Downloading latest browser versions"
	./backend/selenoid/deploy_selenoid.sh -n 3 || warning "Something went wrong getting the latests browsers for the system"
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

log_wfr "Waiting for parseBrowsers"
retry "docker exec -it cometa_django curl --fail http://localhost:8000/parseBrowsers/ -o /dev/null -s " && log_res "[done]" || { log_res "[failed]"; warning "Waited for ${TOTAL_TIMEOUT} seconds, docker-container django is not running"; }

log_wfr "Waiting for parseActions"
retry "docker exec -it cometa_django curl --fail http://localhost:8000/parseActions/ -o /dev/null -s " && log_res "[done]" || { log_res "[failed]"; warning "Waited for ${TOTAL_TIMEOUT} seconds, docker-container django is not running"; }

log_wfr "Waiting for frontend to compile angular typescript into executable code "
retry "curl --fail --insecure https://localhost/ -o /dev/null  -s -L" && log_res "[done] Feeling happy " || { log_res "[failed]"; warning "Waited for ${TOTAL_TIMEOUT} seconds, docker-container front is not running"; }

} # end of function get_cometA_up_and_running

while [[ $# -gt 0 ]]
do
    case "$1" in
        --root-mount-point)
            MOUNTPOINT="root"
            shift
            ;;
    esac
done

get_cometa_up_and_running

info "The test automation platform is ready to rumble at https://localhost/"
info "Thank you for using the easy peasy setup script."
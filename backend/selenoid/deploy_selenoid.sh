#!/bin/bash
pushd $(dirname "$0") &> /dev/null

HELPERS="../../helpers"
# source logger function
source ${HELPERS}/logger.sh

info "Executing Deploy Selenoid Script"

install_jq() {
  info "Installing jq"
  if [ $(command -v apt-get) ]; then
    debug "Using apt-get to install jq"
    sudo apt-get install -y jq
  elif [ $(command -v zypper) ]; then
    debug "Using zypper to install jq"
    sudo zypper install -y jq
  else
    critical "Unable to find apt-get or zypper command, other commands are not implemented yet."
    exit 1
  fi
}

info "*********************** AMVARA ***********************"
info "This script automatically retrieves the latest browsers"
info "for Selenoid and recreates/updates the docker."
info "******************************************************"

# install jq
if [ $(command -v jq) ]; then
  info "jq: already installed."
else
  install_jq
fi
# run getLatestBrowser.sh script to update browsers file
./getLatestBrowsers.sh
# pull selenoid/video-recorder if not already pulled
docker image ls | grep selenoid/video-recorder | grep -q "latest-release" && info "selenoid/video-recorder: already pulled." || { info "pulling selenoid/video-recorder"; docker pull selenoid/video-recorder:latest-release; }

# Replacing Selenoid browser containers background with custom
customBg=/data/cometa/config/custom-desktop.png
# Check if custom image has been provided in /data/cometa/config/
if [ -f "$customBg" ]; then
    bgImage=$customBg
else
    pwd=`pwd`
    bgImage="${pwd}/amvara.png"
fi
debug "Using ${bgImage} as background for Selenium containers"

info "Replacing background image volume in Selenoid images ..."
# Replace bgPath with used image
sed -i "s|<bgPath>|$bgImage|g" browsers.json

# make sure downloads folder exists
mkdir -p ../behave/downloads

info "Replacing downloads folder in Selenoid Chrome Image ..."
pushd ../behave/downloads &> /dev/null
downloadsPath=`pwd`
popd &> /dev/null
sed -i "s|<downloadsPath>|$downloadsPath|g" browsers.json

# Run or update selenoid hub
if [ "$(docker ps -q -f name=cometa_selenoid)" ]; then
    log_wfr "Selenoid docker is running, sending signal to hot update configuration ..."
    # Selenoid is running
    # Send signal to update configuration
    docker kill -s HUP cometa_selenoid &> /dev/null && log_res "[done]" || log_res "[failed]"
else
    log_wfr "Selenoid docker was not found or exited, recreating docker ..."
    # Run Selenoid
    cd ..
    docker-compose up -d --force-recreate selenoid &> /dev/null && log_res "[done]" || log_res "[failed]"
fi

popd &> /dev/null || true # adding true else script fails with exit code 1 in client01

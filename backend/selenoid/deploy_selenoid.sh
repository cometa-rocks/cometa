#!/bin/bash
pushd $(dirname "$0") &> /dev/null

# Compares version with dot notation
# function version_compare () {
#   function sub_ver () {
#     local len=${#1}
#     temp=${1%%"."*} && indexOf=`echo ${1%%"."*} | echo ${#temp}`
#     echo -e "${1:0:indexOf}"
#   }
#   function cut_dot () {
#     local offset=${#1}
#     local length=${#2}
#     echo -e "${2:((++offset)):length}"
#   }
#   if [ -z "$1" ] || [ -z "$2" ]; then
#     echo "=" && exit 0
#   fi
#   local v1=`echo -e "${1}" | tr -d '[[:space:]]'`
#   local v2=`echo -e "${2}" | tr -d '[[:space:]]'`
#   local v1_sub=`sub_ver $v1`
#   local v2_sub=`sub_ver $v2`
#   if (( v1_sub > v2_sub )); then
#     echo ">"
#   elif (( v1_sub < v2_sub )); then
#     echo "<"
#   else
#     version_compare `cut_dot $v1_sub $v1` `cut_dot $v2_sub $v2`
#   fi
# }

install_jq() {
  if [ $(command -v apt-get) ]; then
    sudo apt-get install -y jq
  elif [ $(command -v zypper) ]; then
    sudo zypper install -y jq
  else
    echo "Unable to find apt-get or zypper command, other commands are not implemented yet."
    exit 1
  fi
}

log () {
  echo ""
  echo "=================================="
  echo " $1"
  echo "=================================="
  echo ""
}

echo "*********************** AMVARA ***********************"
echo "This script automatically retrieves the latest browsers"
echo "for Selenoid and recreates/updates the docker."
echo "******************************************************"

# Create browser.json file for Selenoid docker if not exists
# if [[ -f "browsers.json" ]]; then
#     log "Pulling browser images from browsers.json ..."
#     install_jq
#     # Update browser versions to latest
#     browsers=($(cat browsers.json | jq -r 'keys|.[]'))
#     for browser in "${browsers[@]}"
#     do
#         # Get current browser version
#         version=$(cat browsers.json | jq -r ".$browser.default")
#         # Get latest version from Docker Hub
#         if [ "$browser" == "MicrosoftEdge" ]; then
#             response=$(curl --silent https://hub.docker.com/v2/repositories/browsers/edge/tags?name=.0&ordering=last_updated&page_size=1)
#             latest_version=$(echo ${response} | jq .results[0].name --raw-output | cut -d- -f1)
#         else
#             response=$(curl --silent https://hub.docker.com/v2/repositories/selenoid/$browser/tags?name=.0&ordering=last_updated&page_size=1)
#             latest_version=$(echo ${response} | jq .results[0].name --raw-output | cut -d- -f1)
#         fi
#         greater=$(version_compare $latest_version $version)
#         # Compare and update version if mismatches, also checks if latest is valid
#         if [ "$greater" == ">" ] && [ ! -z "$latest_version" ]; then
#             echo "Browser $browser is outdated, updating to $latest_version..."
#             tmp=$(mktemp)
#             # Update default
#             jq ".$browser.default = \"$latest_version\"" browsers.json > "$tmp"
#             sudo mv "$tmp" browsers.json
#             # Update version
#             jq ".$browser.versions += {\"$latest_version\": .$browser.versions.\"$version\"}" browsers.json > "$tmp"
#             sudo mv "$tmp" browsers.json
#             # Update browser image
#             if [ "$browser" == "MicrosoftEdge" ]; then
#                 jq ".$browser.versions.\"$latest_version\".image = \"browsers/edge:$latest_version\"" browsers.json > "$tmp"
#             else
#                 jq ".$browser.versions.\"$latest_version\".image = \"selenoid/vnc_$browser:$latest_version\"" browsers.json > "$tmp"
#             fi
#             # Move temporal modifed browsers to final file
#             sudo mv "$tmp" browsers.json
#         fi
#     done
#     cat browsers.json | jq -r '..|.image?|strings' | xargs -I{} docker pull {}
#     docker pull selenoid/video-recorder:latest-release
# else
#     log "Browsers file not found, creating browsers.json ..."
#     ./cm_selenoid selenoid configure --vnc --config-dir ./ --last-versions 1 --force
# fi

# install jq
if [ $(command -v jq) ]; then
  echo "jq: already installed."
else
  install_jq
fi
# run getLatestBrowser.sh script to update browsers file
./getLatestBrowsers.sh
# pull selenoid/video-recorder if not already pulled
docker image ls | grep selenoid/video-recorder | grep -q "latest-release" && echo "selenoid/video-recorder: already pulled." || docker pull selenoid/video-recorder:latest-release

# Run migrations
runMigrations=true

if [ "$runMigrations" = true ] ; then
    # Migration #1 - Stop cometa_zalenium if running
    if [ "$(docker ps -q -f name=cometa_zalenium)" ]; then
        log "Migration #1 - Remove zalenium"
        docker stop cometa_zalenium
    fi
fi

# Replacing Selenoid browser containers background with custom
customBg=/data/cometa/config/custom-desktop.png
# Check if custom image has been provided in /data/cometa/config/
if [ -f "$customBg" ]; then
    bgImage=$customBg
else
    pwd=`pwd`
    bgImage="${pwd}/amvara.png"
fi
log "Using ${bgImage} as background for Selenium containers"

log "Replacing background image volume in Selenoid images ..."
# Replace bgPath with used image
sed -i "s|<bgPath>|$bgImage|g" browsers.json

# make sure downloads folder exists
mkdir -p ../behave/downloads

log "Replacing downloads folder in Selenoid Chrome Image ..."
pushd ../behave/downloads
downloadsPath=`pwd`
popd
sed -i "s|<downloadsPath>|$downloadsPath|g" browsers.json

# Run or update selenoid hub
if [ "$(docker ps -q -f name=cometa_selenoid)" ]; then
    log "Selenoid docker is running, sending signal to hot update configuration ..."
    # Selenoid is running
    # Send signal to update configuration
    docker kill -s HUP cometa_selenoid
else
    log "Selenoid docker was not found or exited, recreating docker ..."
    # Run Selenoid
    cd ..
    docker-compose up -d --force-recreate selenoid
fi

popd &> /dev/null || true # adding true else script fails with exit code 1 in client01

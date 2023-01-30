#!/bin/bash

# CHANGELOG
# 2022-05-11 - ASO - changed echo to eval and getLatestBrowsers to deploy_selenoid otherwise json would throw error.
# 2022-05-09 - RRO - adding get ./getLatestBrowsers.sh to automatically update 
# 2022-04-12 - RRO - Copied create_backup.sh to cometa repo, so it's not flying around.
# 2021.03.23 - ASO - Added /Cometa mountpoint to /etc/fstab so script does not have to.

# get some directory based on the script
SCRIPTDIR=$(dirname "$0")
BACKEND=${SCRIPTDIR}/../
BASEDIR=${BACKEND}/../
# import logger
test `command -v log_wfr` || source ${BASEDIR}/helpers/logger.sh


# Use existing create_backup.sh script
${SCRIPTDIR}/create_backup.sh

#
# get latests browsers
#
info "Checking latest browser information"
cd ${BACKEND}/selenoid; ./deploy_selenoid.sh -n 10
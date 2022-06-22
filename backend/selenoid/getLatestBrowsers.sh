#!/bin/bash

# ################################################################
# WHAT IS THIS SCRIPT FOR?                                       #
# ################################################################
# This script will recreate browsers.json file with latest x     #
# browser version specified. It will also pull missing images    #
# if needed and will also remove unused browser images.			 #
# ################################################################
# AUTHOR														 #
# ################################################################
# COMETA ROCKS S.L.	    										 #
# ################################################################

# CHANGELOG	VERSION	BY			COMMENT
# 22-06-17  0.4     RROEBER     Adding Volume with for Upload Dummy Files
# 22-04-06	0.3		ASOHAIL		Fixed jq issues with jq version 1.5
# 22-04-05	0.2		ASOHAIL		Added change log and added output to stdout.
# 22-04-04	0.1		ASOHAIL		Created this script.

# ################################################################
# ERROR CODES													 #
# ################################################################
#  0	SUCCESS													 #
# 10	HELP MSG ( UNKNOWN OPTION FOUND )                        #
# ################################################################

# ################################################################
# TODO LIST                                                      #
# ################################################################
# 1.- Add log ouput                                              #
# 2.- Show how much space has been saved.                        #
# ################################################################

# Initialize variables with default values
SCRIPT_LOCATION=`realpath $0` # Current script full path
HELPERS="`dirname ${SCRIPT_LOCATION}`/../../helpers"
TOTAL_BROWSER_VERSIONS=${COMETA_TOTAL_BROWSER_VERSION:-3} # Total amount of version per browser that will be pulled.
BROWSERS_CONTENT="{}" # Save the final output that will be saved in browsers.json.
IMAGES_TO_REMOVE=() # List of docker images that needs to be deleted at the end.
IMAGES_TO_PULL=() # List of docker images that needs to be pulled at the end.
# Browsers that we want to pull.
BROWSERS_INFORMATION=`cat<<-EOF
{
    "browsers/edge": {
        "browser_key": "MicrosoftEdge",
        "options": {
            "path": "/"
        }
    },
    "selenoid/vnc_firefox": {
        "browser_key": "firefox",
        "options": {
            "path": "/wd/hub"
        }
    },
    "selenoid/vnc_chrome": {
        "browser_key": "chrome",
        "options": {}
    },
    "selenoid/vnc_opera": {
        "browser_key": "opera",
        "options": {}
    }
}
EOF
`
BROWSERS=`echo ${BROWSERS_INFORMATION} | jq -r 'keys[]'` # Get all the browser keys.
# Basic options needed for each browser version inside browser.json file
# Variables in bgPath and downloadsPath are replace with deploy_selenoid.sh
BASE_OPTIONS=`cat<<-EOF
{
    "image": "<replaced_later_on>",
    "port": "4444",
    "volumes": [
        "<bgPath>:/usr/share/images/fluxbox/aerokube.png",
        "<downloadsPath>/../uploads:/home/selenium/uploads"
    ]
}
EOF
`

# SOURCE LOGGER FUNCTIONS
test `command -v log_wfr` || source ${HELPERS}/logger.sh

# ################################################################
# FUNCTIONS                                                      #
# ################################################################

# ################################################################
# VERSION INFORMATION FUNCTION									 #
# Returns version information.									 #
# ################################################################
function show_version_information() {
	# Get script version from changelog
	DATE=`cat $0 | grep -A1 CHANGELOG | head -n2 | tail -n1 | sed 's/# //g' | cut -f1`
	VERSION=`cat $0 | grep -A1 CHANGELOG | head -n2 | tail -n1 | sed 's/# //g' | cut -f2`
	AUTHOR=`cat $0 | grep -A1 CHANGELOG | head -n2 | tail -n1 | sed 's/# //g' | cut -f4`
	COMMIT=`cat $0 | grep -A1 CHANGELOG | head -n2 | tail -n1 | sed 's/# //g' | cut -f6`
	
	echo -ne "Here is version information about ${0}.
	
SCRIPT VERSION:			v${VERSION}
LAST MODIFICATION DATE:		${DATE}
LAST MODIFIED BY:		${AUTHOR}
LAST MODIFICATION MESSAGE:	${COMMIT}
"
	exit 0;
}

# ################################################################
# HELP FUNCTION													 #
# @param1	-	String that will be displayed to user on start	 #
# Returns usage information.									 #
# ################################################################
function help() {
	echo -ne "${1}

Usage:
${0} [--dry-run|-h|-n|-v]

OPTIONS:
	--dry-run       -		Do not update browsers.json show changes to stdout. Will not pull or remove docker images.
	-h              -		Shows this help message.
	-n              -		Number of version to use for each browser. Defaults to 10.
	-v              -		Shows version information about the script.

EXAMPLES:
	${0} -n 5
	${0} --dry-run -n 1
";
	exit 10; # showing usage error code
}

# ################################################################
# Main function that will populate all the necessary variables   #
# to generate browsers.json file, pull, remove images			 #
# ################################################################
function main() {
    # loop over browser
    for BROWSER in ${BROWSERS}
    do
        log_wfr "Working on ${BROWSER}"
        # get browser key
        BROWSER_KEY=`echo ${BROWSERS_INFORMATION} | jq -r .[\"${BROWSER}\"].browser_key`
        # make a request to docker's api and get latest TOTAL_BROWSER_VERSIONS browser versions
        REQUEST_URL="https://hub.docker.com/v2/repositories/${BROWSER}/tags?name=.0&ordering=last_updated&page_size=${TOTAL_BROWSER_VERSIONS}"
        RESPONSE=`curl --silent ${REQUEST_URL}`
        # get versions in array
        LATEST_VERSIONS=`echo ${RESPONSE} | jq -r '.results|.[]|.name'`
        # get default version which will always be the first one
        DEFAULT_VERSIONS=`echo ${RESPONSE} | jq -r '.results|.[0]|.name'`
        # generate the browser verisons
        VERSIONS_JSON="{\"${BROWSER_KEY}\": {\"default\": \"${DEFAULT_VERSIONS}\", \"versions\": {}}}"
        # loop over all version
        for VERSION in ${LATEST_VERSIONS}
        do
            # check if this version need image pulling
            IMAGES_TO_PULL+=`docker image ls | grep ${BROWSER} | grep -q "${VERSION}" || echo "${BROWSER}:${VERSION} "`
            # generate a version data
            VERSION_JSON=`echo ${BASE_OPTIONS} | jq --argjson browserOptions "$(echo ${BROWSERS_INFORMATION} | jq .[\"${BROWSER}\"].options)" '. + $browserOptions'`
            # replace image in VERSION_JSON
            VERSION_JSON=`echo ${VERSION_JSON} | sed "s#<replaced_later_on>#${BROWSER}:${VERSION}#"`
            VERSION_JSON="{\"${VERSION}\": ${VERSION_JSON}}"
            # append version to versions
            VERSIONS_JSON=`echo ${VERSIONS_JSON} | jq --argjson version "$(echo ${VERSION_JSON} | jq .)" '.[].versions |= . + $version'`
        done
        # append browser content to browsers
        BROWSERS_CONTENT=`echo ${BROWSERS_CONTENT} | jq --argjson browser "$(echo ${VERSIONS_JSON} | jq .)" '. |= . + $browser'`
        # get image that we want to remove since they won't be used anymore
        IMAGES_TO_REMOVE+=`docker image ls | grep ${BROWSER} | grep -Ev "${LATEST_VERSIONS// /\|}" | sed "s/ \{1,\}/ /g" | cut -d' ' -f3; echo -ne " "`
        log_res "[done]"
    done

    # add any other dangling browser image to images to remove
    IMAGES_TO_REMOVE+=`docker image ls | grep -E "(selenoid|browsers)/" | grep -Ev "${BROWSERS// /\|}|selenoid/video-recorder" | sed "s/ \{1,\}/ /g" | cut -d' ' -f3 | xargs`
    # remove last space from images to remove just in case there is any
    IMAGES_TO_REMOVE=`echo ${IMAGES_TO_REMOVE} | sed "s/ $//g"`

    if [[ "${DRYRUN:-FALSE}" == "TRUE" ]]
    then
        info "browsers.json:"
        echo ${BROWSERS_CONTENT} | jq .
        info "pull images: ${IMAGES_TO_PULL:-No new images to pull.}"
        info "remove images: ${IMAGES_TO_REMOVE:-No images to remove.}"
    else
        # set the browser.json content to BROWSERS_CONTENT
        echo ${BROWSERS_CONTENT} | jq . > `dirname "$0"`/browsers.json

        if [[ "${IMAGES_TO_PULL}" ]]
        then
            for IMAGE in ${IMAGES_TO_PULL}
            do
                log_wfr "pulling: ${IMAGE}"
                docker pull ${IMAGE} &> /dev/null && log_res "[done]" || log_res "[failed]"
            done
        fi

        if [[ "${IMAGES_TO_REMOVE}" ]]
        then
            log_wfr "removing unused images: ${IMAGES_TO_REMOVE}"
            docker image rm ${IMAGES_TO_REMOVE} &> /dev/null && log_res "[done]" || log_res "[failed]"
        fi
    fi
}

# Listen to incomming arguments

## Loop over all the arguments
while [[ $# -gt 0 ]]; do
	ARGUMENT="$1"
	case ${ARGUMENT} in 
	-n)
        # set TOTAL_BROWSER_VERSION variable
        info "Number of browser versions change to ${2}"
		TOTAL_BROWSER_VERSIONS="${2}"
        shift
        shift
		;;
	--dry-run)
        # set DRYRUN variable to true
        info "Dry run set to True."
		DRYRUN="TRUE"
        shift
		;;
	-v|--version|version)
		show_version_information
		;;
	-h|--help|-?|help)
		help "Here is how to use this script."
		;;
	*)
		help "Unknown option (${ARGUMENT}) found."
		;;
	esac
done

# run main function
main
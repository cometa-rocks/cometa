#!/bin/bash

# ###########################################################################
# A  test integration with gitlab CI to run cometa tests and receive results
# ###########################################################################
#
# @Author: Arslan Sohail
# @Since: 2021-06-21
#
# ###########################################################################
#
# Changelog:
# 2021-06-21 RRO added script for gitlab ci integration to cometa-backend-project
#
# ###########################################################################

# source logger
source <(curl -o - --silent https://raw.githubusercontent.com/cometa-rocks/cometa/master/helpers/logger.sh)
TMPFILE=$(mktemp)

# MAIN VARIABLES
GITLAB_HOST="https://git.amvara.de"
GITLAB_USER="<username>"
GITLAB_PASSWORD="<password>"
GITLAB_LOGIN_BODY=$(curl -c cookies.txt ${CURL_OPTIONS} -i "${GITLAB_HOST}/users/sign_in" -s)
CSRF_TOKEN=$(echo $GITLAB_LOGIN_BODY | grep -oE 'name="authenticity_token" value="([^"]*)"' | cut -d' ' -f2 | sed "s/value=//g;s/\"//g")
# Add --insecure if executing in localhost
CURL_OPTIONS="  "

function help() {
    echo -ne "${0} [OPTIONS]

OPTIONS:
  -f|--feature        Specify the feature id that you would like to execute.
  -e|--environment    Specify the url that you would like to test
  -d|--debug          Enables debugging

EXAMPLES:
  ${0} -f 272
  ${0} --feature 272
  ${0} -f 272,273,274
"
    exit 1;
}

function checkIfNumber() {
    # number regexp to check input variable
    number_REGEXP='^[0-9]+$'
    if ! [[ $1 =~ $number_REGEXP ]]; then
        critical "error: Specified non integer value for -f|--feature"
        exit 2;
    fi
}

if [[ $# -lt 4 ]]; then
    info "No options or not all required options specified..."
    help
fi

while [[ $# -gt 0 ]]
do
        key="$1"
        case $key in
                -f|--feature)
                        FEATURES=($(echo $2 | sed "s/,/ /g"))
                        shift
                        shift
                        ;;
                -e|--environment)
                        ENVIRONMENT=$2
                        COMETA_LOGIN_URL="https://${ENVIRONMENT}/callback?iss=https%3A%2F%2Fgit.amvara.de&target_link_uri=https%3A%2F%2F${ENVIRONMENT}%2F&method=get&oidc_callback=https%3A%2F%2F${ENVIRONMENT}%2Fcallback"
                        debug "COMETA LOGIN URL: ${COMETA_LOGIN_URL}"
                        CURL_URL="https://${ENVIRONMENT}/backend/exectest/"
                        debug "CURL URL: ${CURL_URL}"
                        shift
                        shift
                        ;;
                -d|--debug)
                        set -x
                        DEBUG=TRUE
                        PRINTLOGLVL=10
                        shift
                        ;;
                *)
                        info "Unknown option $key ... please check the options below..."
                        help
                        shift
                        ;;
        esac
done

log_wfr "Logging in to co.meta environment"

# add -vvv if debug flag is set
test ${DEBUG:-FALSE} == TRUE && CURL_OPTIONS="$CURL_OPTIONS -vvv "

# LOGIN to GITLAB
curl ${CURL_OPTIONS} -b cookies.txt -c cookies.txt -i "${GITLAB_HOST}/users/sign_in" \
    --data "user[login]=${GITLAB_USER}&user[password]=${GITLAB_PASSWORD}" \
    --data-urlencode "authenticity_token=${CSRF_TOKEN}" -s -o /dev/null
# LOGIN to CO.META
debug "------------COMETA LOGIN URL: ${COMETA_LOGIN_URL}"
LOGIN_TO_COMETA=$(curl ${CURL_OPTIONS} -b cookies.txt -c cookies.txt -Li "${COMETA_LOGIN_URL}" -s)

FIND_REDIRECT_URL=$(echo $LOGIN_TO_COMETA | grep -Eo 'redirectUri.?=.?".*?"' | grep -o "\".*\"" | xargs)

# Check if the find_redirect_url is empty, if it is empty, exit the script
if [[ -z ${FIND_REDIRECT_URL} ]]; then
    log_res "failed"
    error "Redirect URL is empty, continuing the test makes no sense"
    exit 3
fi

curl -b cookies.txt -c cookies.txt -Li ${CURL_OPTIONS} "$FIND_REDIRECT_URL" -s -o /dev/null
 
log_res "done"

for FEATURE in ${FEATURES[@]}; do
    checkIfNumber $FEATURE
    log_wfr "Running Feature: $FEATURE"
    # execute test
    curl -b cookies.txt ${CURL_OPTIONS} \
        -c cookies.txt -L -X POST \
        -d '{"feature_id": '${FEATURE}', "wait": true}' \
        $CURL_URL -s -o ${TMPFILE} && \
        log_res "done" || log_res "failed"

    sleep 2
    echo "https://${ENVIRONMENT}/backend/featureStatus/${FEATURE}/"
    printf "\033[s"
    while [ $(curl -b cookies.txt ${CURL_OPTIONS} https://${ENVIRONMENT}/backend/featureStatus/${FEATURE}/ \
        -c cookies.txt -L -s -o ${TMPFILE} -w "%{http_code}") == "206" ]; do
        printf "\033[u"
        cat ${TMPFILE}
        sleep 1
    done
    # print the end file
    printf "\033[u"
    cat ${TMPFILE}
done
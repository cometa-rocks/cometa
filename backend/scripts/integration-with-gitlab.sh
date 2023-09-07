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
# 2023-09-07 ASO batch execution based on folder_id or department_id
# 2021-06-21 RRO added script for gitlab ci integration to cometa-backend-project
#
# ###########################################################################

usage() {
    echo -ne "${0} -e <environment_url> [-f <feature_id>] [-u <username>] [-p <password>] [-pp] [-cf <cred_file>]

OPTIONS:
  --feature,     -f    Feature ID to execute, property can be repeated.
  --folder             Folder ID, where the features will be executed, property can be repeated. (Check --recursive)
  --department         Department ID, where the feature will be executed. (Check --recursive)
  --environment, -e    Co.meta URL where your features are.
  --username,    -u    Username to use for login.
  --password,    -p    Password to use for login.
  --prompt-pwd,  -pp   Prompts the password for login.
  --cred-file,   -cf   Creadential file. Please follow the format specified below.
  --recursive,   -r    Recursively run features in sub-folders (Only useful when running with --folder or --department).
  --wait,        -w    Wait for the feature to finish.

EXAMPLES:

Credential File:
  Credentials file should follow the following format:
  username=<your_username>
  password=<your_password>
"
    exit 1;
}

cleanup() {
    local exit_code=$?
    debug "Doing some cleanup ..."
    if [[ ${exit_code} -gt 0 ]]; then
        if [[ `cat ${TMPFILE} | wc -l` -gt 0 ]]; then
            info "error file:"
            cat ${TMPFILE}
        fi
    fi
    rm ${TMPFILE} ${COOKIES_FILE}
}

check_int() {
    # number regexp to check input variable
    local number_pattern='^[0-9]+$'
    if ! [[ ${1} =~ ${number_pattern} ]]; then
        critical "error: expected number but recieved: ${1}."
        exit 2;
    fi
}

parse_credential_file() {
    local cred_file=${1}
    if [[ ! -r ${cred_file} ]]; then
        critical "error: unable to read credential file."
        exit 3;
    fi

    local username=`cat ${cred_file} | grep -i "username" | cut -d= -f2`
    local password=`cat ${cred_file} | grep -i "password" | cut -d= -f2`

    if [[ -z ${username} && -z ${password} ]]; then
        critical "error: unable to find username or password in credential file."
        exit 4
    fi

    if [[ ! -z ${username} ]]; then
        USERNAME=${username}
    fi
    
    if [[ ! -z ${password} ]]; then
        PASSWORD=${password}
    fi
}

load_logger() {
    local logger_file=/tmp/.cometa_logger
    if [[ ! -r ${logger_file} ]]; then
        curl -o ${logger_file} -s https://raw.githubusercontent.com/cometa-rocks/cometa/master/helpers/logger.sh

        if [[ $? -gt 0 ]]; then
            echo "Unable to download logger file ... please try again."
            exit 6
        fi
    fi
    source ${logger_file}
}

login_gitlab() {
    local gitlab_host="https://git.amvara.de"
    local gitlab_body=`curl -c ${COOKIES_FILE} ${CURL_OPTIONS} -i "${gitlab_host}/users/sign_in" -s`
    local csrf_token=`echo ${gitlab_body} | grep -oE 'name="authenticity_token" value="([^"]*)"' | cut -d' ' -f2 | sed "s/value=//g;s/\"//g"`
    local cometa_login_url="https://${ENVIRONMENT}/callback?iss=https%3A%2F%2Fgit.amvara.de&target_link_uri=https%3A%2F%2F${ENVIRONMENT}%2F&method=get&oidc_callback=https%3A%2F%2F${ENVIRONMENT}%2Fcallback"

    log_wfr "Logging in to co.meta environment (${ENVIRONMENT})"
    
    curl ${CURL_OPTIONS} -b ${COOKIES_FILE} -c ${COOKIES_FILE} -i "${gitlab_host}/users/sign_in" \
        --data "user[login]=${USERNAME}&user[password]=${PASSWORD}" \
        --data-urlencode "authenticity_token=${csrf_token}" -s -o ${TMPFILE}
    
    local cometa_login=$(curl ${CURL_OPTIONS} -b ${COOKIES_FILE} -c ${COOKIES_FILE} -Li "${cometa_login_url}" -s)
    local redirect_url=$(echo $cometa_login | grep -Eo 'redirectUri.?=.?".*?"' | grep -o "\".*\"" | xargs)

    # Check if the find_redirect_url is empty, if it is empty, exit the script
    if [[ -z ${redirect_url} ]]; then
        log_res "[failed]"
        critical "error: redirect URL is empty, continuing the test makes no sense."
        exit 4
    fi

    curl -b ${COOKIES_FILE} -c ${COOKIES_FILE} -Li ${CURL_OPTIONS} "$redirect_url" -s -o ${TMPFILE}
    log_res "[done]"
}

loader() {
    spin=("-" "\\" "|" "/")
    for i in "${spin[@]}"; do
        echo -ne "\b$i"
        sleep $(awk "BEGIN { print ( ${1:-1}/4 ) }")
    done
}

wait_for_feature() {
    local feature=${1}
    local status_url="https://${ENVIRONMENT}/backend/featureStatus/${feature}/?onlyProgress=true"

    # save the cursor position just in case.
    printf "\033[s"
    loader 2
    while [ $(curl -b ${COOKIES_FILE} ${CURL_OPTIONS} ${status_url} \
        -c ${COOKIES_FILE} -L -s -o ${TMPFILE} -w "%{http_code}") == "206" ]; do
        printf "\033[u"
        cat ${TMPFILE}
        loader
    done
    # print the end file
    printf "\033[u"
    cat ${TMPFILE}
    cat ${TMPFILE} | grep "Overall Status" | grep -q "Failed"
    if [[ $? -eq 0 ]]; then
        error "Feature overall status is failed, will exit with non-zero code."
        return 1
    fi

    return 0
}

run_features() {
    local execute_url="https://${ENVIRONMENT}/backend/exectest/"

    for feature in ${FEATURES[@]}; do
        log_wfr "Running Feature: $feature"
        curl -b ${COOKIES_FILE} ${CURL_OPTIONS} -c ${COOKIES_FILE} -L -X POST \
            -d '{"feature_id": '${feature}', "wait": true}' $execute_url -s -o ${TMPFILE} && \
            log_res "done" || log_res "failed"
        
        if [[ ! -z ${WAIT_FOR_FEATURE} ]]; then
            wait_for_feature ${feature}
        fi
    done
}

run_batch() {
    local execute_url="https://${ENVIRONMENT}/backend/exec_batch/"

    # check
    if [[ ${#FOLDERS[@]} -gt 0 && ! -z ${DEPARTMENT} ]]; then
        critical "error: --folder and --department can not be used at the same time, as of now."
        exit 7;
    fi

    if [[ ${#FOLDERS[@]} -gt 0 ]]; then
        for folder in ${FOLDERS[@]}; do
            log_wfr "Running Folder: $folder"
            curl -b ${COOKIES_FILE} ${CURL_OPTIONS} -c ${COOKIES_FILE} -L -X POST \
                -d '{"folder_id": '${folder}', "recursive": '${RECURSIVE:-false}'}' $execute_url -s -o ${TMPFILE} && \
                log_res "done" || log_res "failed"
        done
    else # department
        log_wfr "Running Department: $DEPARTMENT"
        curl -b ${COOKIES_FILE} ${CURL_OPTIONS} -c ${COOKIES_FILE} -L -X POST \
            -d '{"department_id": '${DEPARTMENT}', "recursive": '${RECURSIVE:-false}'}' $execute_url -s -o ${TMPFILE} && \
            log_res "done" || log_res "failed"
    fi
}

main() {
    # login to gitlab
    login_gitlab

    # if there is atleast one feature run it.
    if [[ ${#FEATURES[@]} -gt 0 ]]; then
        run_features
        exit 0;
    fi

    # if there is atleast one folder run it.
    if [[ ${#FOLDERS[@]} -gt 0 ]] || [[ ! -z ${DEPARTMENT} ]]; then
        run_batch
        exit 0;
    fi
}

# trap exit
trap "cleanup" EXIT

# check if there is at least 1 cli parameter
if [[ $# -eq 0 ]]; then
    info "No options passed."
    usage
fi

# load logger
load_logger

# GLOBAL Variables
FEATURES=( )
FOLDERS=( )
ENVIRONMENT=localhost
USERNAME="<username>"
PASSWORD="<password>"
TMPFILE=$(mktemp)
COOKIES_FILE=$(mktemp)
CURL_OPTIONS=" --insecure "

# parse cli parameters
while [[ $# -gt 0 ]]
do
    case ${1} in
        --feature|-f)
            if check_int ${2}; then
                FEATURES=( ${FEATURES[@]} ${2} )
            fi
            shift
            shift
            ;;
        --environment|-e)
            ENVIRONMENT=${2}
            shift
            shift
            ;;
        --username|-u)
            USERNAME=${2}
            shift
            shift
            ;;
        --password|-p)
            PASSWORD=${2}
            shift
            shift
            ;;
        --prompt-pwd|-pp)
            read -esp 'Password: ' PASSWORD
            shift
            ;;
        --cred-file|-cf)
            parse_credential_file ${2}
            shift
            shift
            ;;
        --wait|-w)
            WAIT_FOR_FEATURE=1
            shift
            ;;
        --folder)
            if check_int ${2}; then
                FOLDERS=( ${FOLDERS[@]} ${2} )
            fi
            shift
            shift
            ;;
        --department)
            if check_int ${2}; then
                DEPARTMENT=${2}
            fi
            shift
            shift
            ;;
        --recursive|-r)
            RECURSIVE=true
            shift
            ;;
        *)
            usage
            shift
            ;;
    esac
done

main
#!/usr/bin/env bash

# download logger and source
if [[ ! -f /tmp/.logger.sh ]]; then
    curl -s -o /tmp/.logger.sh https://gist.githubusercontent.com/ArslanSB/92663e81e5128d1fc3b9ef053f08852e/raw/4d911d8e2ccdddf75e0397b4cd7bdb2d09e08acb/logger.sh
fi
source /tmp/.logger.sh || { echo "Unable to source logger script, please contact your administrator."; exit 10; }

# set default variables
GIT_HOOKS_FOLDER=".hooks"

info "Preparing the environment"
debug "Since we are running in a docker environment under a root user, we need to give root user access to the repo"
git config --global --unset-all safe.directory
git config --global --add safe.directory /code

info "Setting up Git hooks folder"
log_wfr "Checking if core.hooksPath is already set"
if git config --get core.hooksPath 2>&1 >/dev/null; then
    hooksPath=`git config --get core.hooksPath`
    if [[ "${hooksPath}" != "${GIT_HOOKS_FOLDER}" ]]; then
        configure_hook_path=1
        log_res "[differ from expected]"
        warning "core.hooksPath is different (${hooksPath}) than expected (${GIT_HOOKS_FOLDER}). Will change it, but do keep in mind this change."
    else
        log_res "[correctly configured]"
    fi
else
    configure_hook_path=1
    log_res "[not set]"
fi

if [[ ${configure_hook_path:-0} -eq 1 ]]; then
    log_wfr "Setting up core.hooksPath"
    git config --unset-all core.hooksPath
    git config --add core.hooksPath ${GIT_HOOKS_FOLDER} && log_res "[done]" || log_res "[failed]"
fi
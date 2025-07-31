#!/bin/bash
# Enable debug mode
# set -x

# first parameter is json_path, the relative route to a json containing all the necessary information
# check if is at least one argument in the cmd-line
if (( $# < 1 ))
    then
        echo "ERROR: No arguments provided"
        exit 1
fi

echo "Executing"
# export variables that will be used in environment and actions
export SCREENSHOTS=$(cat "$1" | jq -r ".screenshot")
export COMPARES=$(cat "$1" | jq -r ".compare")
export COMETA_FEATURE_ID=$(cat "$1" | jq -r ".feature_id") # ID of the Feature
export FEATURE_DATA="$(cat "$1")" # Content of the JSON_FILE

cd $FOLDERPATH # needed later when doing image comparison

# Create steps directory if it doesn't exist
mkdir -p ${FOLDERPATH}/steps
# Create symbolic links

ln -sf /opt/code/cometa_itself/steps/actions.py ${FOLDERPATH}/steps/actions.py
ln -sf /opt/code/cometa_itself/environment.py ${FOLDERPATH}/environment.py

# execute the testcase
echo "1 - /usr/local/bin/behave $FEATURE_FILE --summary --junit --junit-directory ${FOLDERPATH}/junit_reports/"
/usr/local/bin/behave "$FEATURE_FILE" \
    --summary --junit --junit-directory \
    ${FOLDERPATH}/junit_reports/ --no-skipped \
    --quiet --no-multiline --format=null

# Check behave exit code
behave_exit_code=$?

if [ $behave_exit_code -ne 0 ]; then
    echo "ERROR: execution failed with exit code: $behave_exit_code"
    exit $behave_exit_code
fi

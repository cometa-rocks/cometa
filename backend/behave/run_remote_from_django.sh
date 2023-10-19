#!/bin/bash

# first parameter is json_path, the relative route to a json containing all the necessary information
# check if is at least one argument in the cmd-line
if (( $# < 1 ))
    then
        exit 1
fi

echo "Executing"
# export variables that will be used in environment and actions
export SCREENSHOTS=$(cat "$1" | jq -r ".screenshot")
export COMPARES=$(cat "$1" | jq -r ".compare")
export COMETA_FEATURE_ID=$(cat "$1" | jq -r ".feature_id") # ID of the Feature
export JSON_FILE="$1" # Path to JSON File with Feature properties
export FEATURE_DATA="$(cat "$1")" # Content of the JSON_FILE

# get the folder path where all the features for the executed departments are
FOLDERPATH=`echo $1 | sed "s#/features/#@#g" | cut -d@ -f1`
# get the feature name from the json_path
FEATURE_NAME=`echo $1 | sed "s#/features/#@#g;s#_meta#@#g" | cut -d@ -f2`
# export the feature file absolute path
export FEATURE_FILE="${FOLDERPATH}/features/${FEATURE_NAME}.feature"

cd $FOLDERPATH # needed later when doing image comparison

# XXX TODO ... check if exists
ln -sf /opt/code/cometa_itself/steps/actions.py ${FOLDERPATH}/steps/actions.py
ln -sf /opt/code/cometa_itself/environment.py ${FOLDERPATH}/environment.py

# execute the testcase
echo "1 - /usr/local/bin/behave $FEATURE_FILE --summary --junit --junit-directory ${FOLDERPATH}/junit_reports/"
/usr/local/bin/behave "$FEATURE_FILE" \
    --summary --junit --junit-directory \
    ${FOLDERPATH}/junit_reports/ --no-skipped \
    --quiet --no-multiline --format=null
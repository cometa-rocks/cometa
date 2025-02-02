#!/bin/bash
# Function to get the session ID where "is_test": true and "record_video": true
# and remove hyphens (-) from the session ID
function get_test_session_id() {
    # Use sed to remove the hyphens from the session ID
    curl -s http://localhost:4723/sessions | jq -r '.value[] | select(.capabilities.is_test == true and .capabilities.record_video == true) | .id' | sed 's/-//g'
}

# Start video recording using the session ID as the video name
function start() {
    mkdir -p $VIDEO_PATH
    # Get the session ID that satisfies the test and record_video condition
    session_id=$(get_test_session_id)
    FULL_VIDEO_PATH="$VIDEO_PATH/${session_id}.mp4"
    
    # Fallback to timestamp if session ID is empty or "null"
    if [ -z "$session_id" ] || [ "$session_id" = "null" ]; then
        session_id="$(date '+%d_%m_%Y_%H_%M_%S')"  # Fallback to timestamp if session ID is not found
    fi

    echo "Start video recording with name: $FULL_VIDEO_PATH"
    # Start recording video using ffmpeg
    ffmpeg -video_size 1280x800 -framerate 15 -f x11grab -i $DISPLAY $FULL_VIDEO_PATH -y &
    echo "Video started"
}

# Stop video recording
function stop() {
    echo "Stop video recording"
    kill $(ps -ef | grep [f]fmpeg | awk '{print $2}')
}

# Automatically start and stop recording based on the test session status
function auto_record() {
    echo "Auto record: $AUTO_RECORD"
    sleep 6

    while [ "$AUTO_RECORD" = true ]; do
        # Check if there is a test running that matches the conditions
        no_test=true
        while $no_test; do
            task=$(curl -s localhost:4723/sessions | jq -r '.value[] | select(.capabilities.is_test == true and .capabilities.record_video == true) | .id')
            if [ -z "$task" ]; then
                sleep .5
                echo "Waiting for the test to start"
            else
                start
                no_test=false
                echo "Set no_test to false"
            fi
        done

        # Check if the test is finished
        while [ $no_test = false ]; do
            
            task=$(curl -s localhost:4723/sessions | jq -r '.value[] | select(.capabilities.is_test == true and .capabilities.record_video == true) | .id')
            if [ -z "$task" ]; then
                stop
                no_test=true
                echo "Recording stopped, Setting no_test to true"
            else
                sleep .5
                echo "Waiting for the test to complete"
            fi
        done
    done

    echo "Auto recording is disabled!"
}

$@

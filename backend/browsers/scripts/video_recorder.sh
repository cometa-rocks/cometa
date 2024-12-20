#!/bin/bash

# Function to get the session ID where "is_test": true and "record_video": true
# and remove hyphens (-) from the session ID
function get_test_session_id() {
    # Retry logic to fetch a valid session ID
    local session_id="reserved"
    while [ "$session_id" = "reserved" ] || [ -z "$session_id" ]; do
        session_id=$(curl -s http://localhost:4444/status | jq -r '.value.nodes[].slots[] | select(.session != null) | .session.sessionId' | sed 's/-//g')
        if [ "$session_id" = "reserved" ] || [ -z "$session_id" ]; then
            echo "Session ID is 'reserved' or empty, retrying..."
            sleep 1
        fi
    done
    echo "$session_id"
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
    ffmpeg -video_size ${SE_SCREEN_WIDTH}x${SE_SCREEN_HEIGHT} -framerate 15 -f x11grab -i $DISPLAY -preset ultrafast -crf 28 -movflags +faststart $FULL_VIDEO_PATH -y &
    FFMPEG_PID=$!
    echo "Video started with PID $FFMPEG_PID"
}

# Stop video recording
function stop() {
    echo "Stop video recording"
    if [ -n "$FFMPEG_PID" ] && kill -0 $FFMPEG_PID 2>/dev/null; then
        kill -QUIT $FFMPEG_PID
        wait $FFMPEG_PID
        echo "Recording stopped gracefully."
    else
        echo "No ffmpeg process found."
    fi
}

# Trap signals to ensure graceful termination
trap "stop; exit 0" SIGTERM SIGINT

# Automatically start and stop recording based on the test session status
function auto_record() {
    echo "Auto record: $AUTO_RECORD"
    sleep 6

    while [ "$AUTO_RECORD" = true ]; do
        # Check if there is a test running that matches the conditions
        no_test=true
        while $no_test; do
            task=$(curl -s http://localhost:4444/status | jq -r '.value.nodes[].slots[] | select(.session != null) | .session.sessionId' | sed 's/-//g')
            if [ -z "$task" ]; then
                sleep 2
                echo "Waiting for the test to start"
            else
                start
                no_test=false
                echo "Set no_test to false"
            fi
        done

        # Check if the test is finished
        while [ $no_test = false ]; do
            task=$(curl -s http://localhost:4444/status | jq -r '.value.nodes[].slots[] | select(.session != null) | .session.sessionId' | sed 's/-//g')
            if [ -z "$task" ]; then
                stop
                no_test=true
                echo "Recording stopped, Setting no_test to true"
            else
                sleep 2
                echo "Waiting for the test to complete"
            fi
        done
    done

    echo "Auto recording is disabled!"
}

$@
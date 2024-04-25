#!/bin/bash

sudo apt update
sudo apt-get install software-properties-common
sudo apt-get update
sudo apt-get install ffmpeg
ffmpeg -y -f x11grab -video_size ${VIDEOSIZE} -r 15 -i ${host}:${DISPLAY_NUM}.0 -codec:v libx264 -preset ultrafast -pix_fmt yuv420p ${VIDEO_NAME}


#!/bin/bash

# The URL to check
URL="http://localhost:4444/status"

# # ffmpeg command with variables
# VIDEOSIZE="1360x1020"
# host="localhost"
# DISPLAY_NUM=":0"
# VIDEO_NAME="chrome_video.mp4"
OUTPUT_PATH="/video/${VIDEO_NAME}"

sleep 10
ffmpeg -y -f x11grab -video_size ${VIDEOSIZE} -r 15 -i ${host}:${DISPLAY_NUM}.0 -codec:v libx264 -preset ultrafast -pix_fmt yuv420p ${OUTPUT_PATH}


FFMPEG_COMMAND="ffmpeg -y -f x11grab -video_size ${VIDEOSIZE} -r 15 -i ${host}:${DISPLAY_NUM}.0 -codec:v libx264 -preset ultrafast -pix_fmt yuv420p ${OUTPUT_PATH}"

# Infinite loop to continuously check the URL status
while true; do
    # Check the HTTP status code of the URL
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")
    
    # If the status code is 200, run the ffmpeg command
    if [ "$HTTP_STATUS" -eq 200 ]; then
        echo "Status code is 200. Running the ffmpeg command..."
        eval "$FFMPEG_COMMAND"
        break  # Exit the loop after running the command
    else
        # Print a message indicating the current status code
        echo "Status code is $HTTP_STATUS. Retrying..."
    fi
    
    # Wait for a few seconds before checking the status again (adjust as needed)
    sleep 1
done

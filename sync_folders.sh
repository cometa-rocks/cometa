#!/bin/bash

# Source and destination directories
SOURCE_DIR1="/home/ubuntu/kubernetes_setups/cometa/backend"
DEST_DIR1="/home/ubuntu/kubernetes_setups/nfs_cometa_share/data/data"

SOURCE_DIR2="/home/ubuntu/kubernetes_setups/cometa/front/src"
DEST_DIR2="/home/ubuntu/kubernetes_setups/nfs_cometa_share/data/data/front"

# Function to monitor and sync changes for a single source-destination pair
monitor_and_sync() {
    local SOURCE_DIR="$1"
    local DEST_DIR="$2"

    echo "Monitoring $SOURCE_DIR for changes..."

    inotifywait -m -r -e modify,create,delete,move "$SOURCE_DIR" --format '%w%f' |
    while read FILE
    do
        echo "Change detected in: $FILE"
        rsync -avh --delete "$SOURCE_DIR" "$DEST_DIR"
        echo "Synced changes to $DEST_DIR"
    done
}

# Start monitoring both folders in parallel
monitor_and_sync "$SOURCE_DIR1" "$DEST_DIR1" &
monitor_and_sync "$SOURCE_DIR2" "$DEST_DIR2" &

# Wait for background processes to complete (keeps the script running)
wait

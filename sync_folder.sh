#!/bin/bash

SOURCE_DIR="/home/ubuntu/kubernetes_setups/cometa/backend"
DEST_DIR="/home/ubuntu/kubernetes_setups/nfs_cometa_share/data/data"

inotifywait -m -r -e modify,create,delete,move "$SOURCE_DIR" --format '%w%f' |
while read FILE
do
    echo "Change detected in: $FILE"
    rsync -avh --delete "$SOURCE_DIR" "$DEST_DIR"
    echo "Synced changes to $DEST_DIR"
done

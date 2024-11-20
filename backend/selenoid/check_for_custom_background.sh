#!/bin/sh

# Check if the file exists at the source location
SOURCE_FILE="/code/config/images/fluxbox/background.png"
DESTINATION_PATH="/etc/selenoid/"

mkdir -p $DESTINATION_PATH

DESTINATION_FILE="/etc/selenoid/background.png"

if [ -f "$SOURCE_FILE" ]; then
    echo "File exists at $SOURCE_FILE. Copying to $DESTINATION_FILE..."
    cp -rf "$SOURCE_FILE" "$DESTINATION_FILE"
else
    echo "Custom background file does not exist at $SOURCE_FILE, Skipping copy. If custom browser background needed can be set using cometa backend"
fi

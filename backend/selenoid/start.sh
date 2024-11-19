#!/bin/bash

# Check if the file exists at the source location
SOURCE_FILE="/code/config/images/fluxbox/aerokube.png"
DESTINATION_FILE="/usr/share/images/fluxbox/aerokube.png"

if [ -f "$SOURCE_FILE" ]; then
    echo "File exists at $SOURCE_FILE. Copying to $DESTINATION_FILE..."
    cp "$SOURCE_FILE" "$DESTINATION_FILE"
else
    echo "File does not exist at $SOURCE_FILE. Skipping copy."
fi

# Calculate the limit based on the number of available processors
LIMIT=$(( $(nproc) - 2 ))
LIMIT=$(( LIMIT > 2 ? LIMIT : 2 ))

# Start Selenoid with the calculated limit and provided configurations
/usr/bin/selenoid \
    -listen :4444 \
    -conf /etc/selenoid/browsers.json \
    -video-output-dir /opt/selenoid/video \
    -log-output-dir /opt/selenoid/logs \
    -container-network cometa_testing \
    -limit $LIMIT

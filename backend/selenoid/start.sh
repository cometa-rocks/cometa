#!/bin/sh

# Debugging: Check if the file exists

/etc/selenoid/check_for_custom_background.sh

# entrypoint with limit on browser executions to CPU-2 or Defaulting to 2 if number is less then 2
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

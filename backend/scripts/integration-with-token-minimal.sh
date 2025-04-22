#!/bin/bash

# Default values
FQDN='https://prod.cometa.rocks'
FOLDER=227

# Check if .secrets file exists
if [ -f ".secrets" ]; then
    source .secrets
else
    echo "Error: .secrets file not found. Please create a .secrets file with SECRET and KEY values."
    echo "Example .secrets file content:"
    echo 'SECRET="XXXXXXDQ2nYKkewE"'
    echo 'KEY="NOKM3GgdqXXXXXXXXXXXXXXXXXXXXX"'
    exit 1
fi

# Validate that SECRET and KEY are set
if [ -z "$SECRET" ] || [ -z "$KEY" ]; then
    echo "Error: SECRET and KEY must be defined in the .secrets file."
    exit 1
fi

curl --location ${FQDN}'/backend/integrations/v2/execute' \
--header 'Content-Type: application/json' \
--header 'Cookie: x_csrf=whatever' \
--data '{
    "secret": {
        "secret_id":"'${SECRET}'", 
        "secret_key":"'${KEY}'"
    },
    "test_info": {
        "execution_type":"folder",
        "id":'${FOLDER}',
        
        "recursive":false
    }
}'
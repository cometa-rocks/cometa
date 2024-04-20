#!/bin/bash

# Define an array of image IDs to keep
keep_ids=("115053965e86" "07655ddf2eeb")

# Get all dangling image IDs
dangling_ids=$(docker images -f "dangling=true" --format "{{.ID}}")

# Loop through each dangling ID and remove if not in keep_ids
for id in $dangling_ids; do
    if [[ ! " ${keep_ids[@]} " =~ " ${id} " ]]; then
        docker rmi $id
    fi
done


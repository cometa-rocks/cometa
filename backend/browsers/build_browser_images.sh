#!/bin/bash

# JSON file containing browser configurations
JSON_FILE="browsers.json"

# Docker registry where images will be pushed
DOCKER_REGISTRY="cometa"

# Read browsers from JSON file
browsers=$(jq -c '.browsers[]' $JSON_FILE)

# Loop through each browser in the JSON file
for browser in $browsers; do
  # Extract browser name and image
  name=$(echo $browser | jq -r '.name')
  image=$(echo $browser | jq -r '.image')

  # Build a Docker image for the browser
  tag="$name"
  echo "Building Docker image for $name using base image $image..."
  # docker build --build-arg BASE_IMAGE=$image -t $tag .

  if [ $? -eq 0 ]; then
    echo "SIMULATION: Successfully built $tag"
  else
    echo "SIMULATION: Failed to build $tag"
    exit 1
  fi

  # Push the Docker image to the registry
  echo "Pushing $tag to Docker registry..."
  # docker push $tag

  if [ $? -eq 0 ]; then
    echo "SIMULATION: Successfully pushed $tag"
  else
    echo "SIMULATION: Failed to push $tag"
    exit 1
  fi
done

echo "SIMULATION: All images built and pushed successfully."

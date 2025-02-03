#!/bin/bash

# Check for dangling images
dangling_images=$(docker images -f "dangling=true" -q)

if [ -z "$dangling_images" ]; then
  echo "No dangling images found."
else
  echo "Removing dangling images..."
  docker rmi $dangling_images
  echo "Dangling images removed successfully."
fi

cd ..
IMAGE_PATHS=("front" "backend/behave" "backend/src" "backend/scheduler" "backend/ws-server")
IMAGE_NAMES=("cometa/front" "cometa/behave" "cometa/django" "cometa/scheduler" "cometa/socket")
VERSION_PATHS=("front/src/assets/config.json" "backend/behave/version.json" "backend/src/version.json" "backend/scheduler/version.json" "backend/ws-server/version.json")
for i in "${!IMAGE_PATHS[@]}"; do
  IMAGE_DIR="${IMAGE_PATHS[$i]}"
  IMAGE_NAME="${IMAGE_NAMES[$i]}"
  VERSION_PATH="${VERSION_PATHS[$i]}" 
  BUILD_VERSION=$(jq -r '.version' "$VERSION_PATH")
  echo "Processing image: $IMAGE_NAME"
  # Fetch the JSON response from Docker Hub
  RESPONSE=$(curl -s "https://hub.docker.com/v2/repositories/$IMAGE_NAME/tags/?page_size=2&ordering=last_updated")
  # Extract the latest tag using jq
  LATEST_TAG=$(echo "$RESPONSE" | jq -r '.results[1].name')
  echo "Latest tag for $IMAGE_NAME from Docker Hub is: $LATEST_TAG"
  # Compare the latest tag with the build version
  if [ "$LATEST_TAG" == "$BUILD_VERSION" ]; then
    echo "The latest version is already $BUILD_VERSION for $IMAGE_NAME. Skipping build and push."
  else
    cd $IMAGE_DIR
    
    # Build the Docker image
    echo "Building Docker image: $IMAGE_NAME:$BUILD_VERSION..."
    if docker build . -f Dockerfile -t "$IMAGE_NAME:$BUILD_VERSION" --no-cache; then
        echo "$IMAGE_NAME:$BUILD_VERSION built successfully"
    else
        echo "Docker build failed. Exiting..."
        exit 1
    fi

    # Push the built image to the Docker registry
    echo "Pushing $IMAGE_NAME:$BUILD_VERSION to Docker registry: $DOCKER_REGISTRY..."
    if docker push "$IMAGE_NAME:$BUILD_VERSION"; then
        echo "$IMAGE_NAME:$BUILD_VERSION pushed successfully"
    else
        echo "Docker push failed. Exiting..."
        exit 1
    fi


    # Tag the image as 'latest'
    echo "Tagging $IMAGE_NAME:$BUILD_VERSION as $IMAGE_NAME:latest..."
    if docker tag "$IMAGE_NAME:$BUILD_VERSION" "$IMAGE_NAME:latest"; then
        echo "Tagging successful"
    else
        echo "Docker tag failed. Exiting..."
        exit 1
    fi

    # Push the 'latest' tag to the registry
    echo "Pushing $IMAGE_NAME:latest to Docker registry: $DOCKER_REGISTRY..."
    if docker push "$IMAGE_NAME:latest"; then
        echo "$IMAGE_NAME:latest pushed successfully"
    else
        echo "Docker push failed. Exiting..."
        exit 1
    fi

    # Cleanup Docker images (Remove unused images to free space)
#    echo "Cleaning up local Docker images $IMAGE_NAME:$BUILD_VERSION and $IMAGE_NAME:latest"
#    docker rmi "$IMAGE_NAME:$BUILD_VERSION" "$IMAGE_NAME:latest" --force

    # Return to the previous directory
    cd - 
  fi
done

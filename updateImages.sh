IMAGE_PATHS=("front" "backend/behave" "backend/src")
IMAGE_NAMES=("cometa/front" "cometa/behave" "cometa/django")
VERSION_PATHS=("front/src/assets/config.json" "backend/behave/version.json" "backend/src/version.json")
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
    docker build . -f Dockerfile -t $IMAGE_NAME:$BUILD_VERSION
    echo "$IMAGE_NAME:$BUILD_VERSION build successfully"
    echo "Pushing $IMAGE_NAME:$BUILD_VERSION image to Docker $DOCKER_REGISTRY"
    docker push $IMAGE_NAME:$BUILD_VERSION
    echo "$IMAGE_NAME:$BUILD_VERSION image pushed"
    echo "Converting $IMAGE_NAME:$BUILD_VERSION tag $IMAGE_NAME:latest"
    docker tag $IMAGE_NAME:$BUILD_VERSION $IMAGE_NAME:latest
    echo "Pushing $IMAGE_NAME:latest image to Docker $DOCKER_REGISTRY"
    docker push $IMAGE_NAME:latest
    echo "$IMAGE_NAME:latest image pushed"
    cd -
  fi
done

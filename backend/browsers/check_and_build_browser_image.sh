#!/bin/bash
# This script is used to build the brower images with cometa customizations

IMAGE_PATH="${1:-.}"
# IMAGE_PATH="backend/browsers"
IMAGE_NAMES_SELENIUM=("selenium/standalone-chrome" "selenium/standalone-firefox" "selenium/standalone-edge")
IMAGE_NAMES_COMETA=("cometa/chrome" "cometa/firefox" "cometa/edge")

for i in "${!IMAGE_NAMES_SELENIUM[@]}"; do
  IMAGE_NAME_SELENIUM="${IMAGE_NAMES_SELENIUM[$i]}"
  IMAGE_NAME_COMETA="${IMAGE_NAMES_COMETA[$i]}"

  echo "📦 Processing image: $IMAGE_NAME_SELENIUM"

  # Get latest version from Cometa image
  RESPONSE_COMETA=$(curl -s "https://hub.docker.com/v2/repositories/${IMAGE_NAME_COMETA}/tags/?page_size=1&ordering=last_updated")
  LATEST_TAG_COMETA=$(echo "$RESPONSE_COMETA" | jq -r '.results[0].name')
  echo "Received latest version from Cometa docker hub $IMAGE_NAME_COMETA:$LATEST_TAG_COMETA"
  # Extract numeric part from tag (e.g., from "130.0" get "130")
  BASE_VERSION=$(echo "$LATEST_TAG_COMETA" | grep -oE '^[0-9]+')

  if [ -z "$BASE_VERSION" ]; then
    echo "❌ Could not parse numeric version from $LATEST_TAG_COMETA. Skipping $IMAGE_NAME_COMETA."
    continue
  fi

  # Increment the version
  NEW_VERSION=$((BASE_VERSION + 1))
  echo "Checking for new version from Selenium docker hub $IMAGE_NAME_SELENIUM:$NEW_VERSION"
  # Check if new version exists in selenium image repo
  URL="https://hub.docker.com/v2/repositories/${IMAGE_NAME_SELENIUM}/tags/${NEW_VERSION}.0"
  RESPONSE_SELENIUM=$(curl -s -o /dev/null -w "%{http_code}" "$URL")

  if [ "$RESPONSE_SELENIUM" -ge 200 ] && [ "$RESPONSE_SELENIUM" -lt 300 ]; then
    echo "✅ New version ${NEW_VERSION}.0 available in $IMAGE_NAME_SELENIUM."

    echo "🛠️  Building Cometa image $IMAGE_NAME_COMETA:${NEW_VERSION}.0 using $IMAGE_NAME_SELENIUM:${NEW_VERSION}.0"

    docker build \
      --build-arg BASE_IMAGE="$IMAGE_NAME_SELENIUM:${NEW_VERSION}.0" \
      -t "$IMAGE_NAME_COMETA:${NEW_VERSION}.0" \
      "$IMAGE_PATH"

    if [ $? -eq 0 ]; then
      echo "✅ Successfully built $IMAGE_NAME_COMETA:${NEW_VERSION}.0"
    else
      echo "❌ Failed to build $IMAGE_NAME_COMETA:${NEW_VERSION}.0"
      exit 1
    fi

    echo "🚀 Pushing $IMAGE_NAME_COMETA:${NEW_VERSION}.0 to Docker Hub..."
    docker push "$IMAGE_NAME_COMETA:${NEW_VERSION}.0"

    if [ $? -eq 0 ]; then
      echo "✅ Successfully pushed $IMAGE_NAME_COMETA:${NEW_VERSION}.0"
    else
      echo "❌ Failed to push $IMAGE_NAME_COMETA:${NEW_VERSION}.0"
      exit 1
    fi

    # Cleanup Docker images (Remove unused images to free space)
    echo "Cleaning up local Docker images $IMAGE_NAME:$BUILD_VERSION and $IMAGE_NAME:latest"
    docker rmi "$IMAGE_NAME:$BUILD_VERSION" "$IMAGE_NAME:latest" --force

  else
    echo "ℹ️  $IMAGE_NAME_SELENIUM is up to date. No newer version than $LATEST_TAG_COMETA found."
  fi

  echo "----------------------------------------"
done

echo "🎉 All checks and builds completed."
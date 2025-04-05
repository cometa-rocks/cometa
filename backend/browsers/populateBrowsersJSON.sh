#/bin/bash
# Deprecated 

IMAGE_PATH="backend/browsers"
IMAGE_NAMES_SELENIUM=("selenium/standalone-chrome" "selenium/standalone-firefox" "selenium/standalone-edge")
IMAGE_NAMES_COMETA=("cometa/chrome" "cometa/firefox" "cometa/edge")

# Empty browsers JSON array
BROWSERS_JSON='{"browsers": []}'

for i in "${!IMAGE_NAMES_SELENIUM[@]}"; do
  #Gets the lastest versions from each selenium browser and cometa browser
  IMAGE_NAME_SELENIUM="${IMAGE_NAMES_SELENIUM[$i]}"
  IMAGE_NAME_COMETA="${IMAGE_NAMES_COMETA[$i]}"

  echo "Processing image: $IMAGE_NAME_SELENIUM"

  #Get latest versions from cometa
  RESPONSE_COMETA=$(curl -s "https://hub.docker.com/v2/repositories/$IMAGE_NAME_COMETA/tags/?page_size=4&ordering=last_updated")
  LATEST_TAG_COMETA=$(echo "$RESPONSE_COMETA" | jq -r '.results[0].name')

  #Add 1 to the current cometa version, to check it a newer version exists
  VERSION_TEST=$(echo "$LATEST_TAG_COMETA" | jq -r 'tonumber')
  VERSION_TEST=$(echo "$VERSION_TEST + 1" | bc)
  VERSION_TEST=$(echo "$VERSION_TEST" | jq -r 'tostring')

  # Check if the browser version is available in the selenium hub docker repo by checking http response code (200-299 OK)
  URL="https://hub.docker.com/v2/repositories/$IMAGE_NAME_SELENIUM/tags/$VERSION_TEST"
  RESPONSE_SELENIUM=$(curl -s -w "%{http_code}" -o /dev/null "$URL")

  if [ "$RESPONSE_SELENIUM" -ge 200 ] && [ "$RESPONSE_SELENIUM" -lt 300 ]; then
    echo "Current $IMAGE_NAME_COMETA version is $LATEST_TAG_COMETA"
    echo "❗Found newer version for $IMAGE_NAME_SELENIUM: $VERSION_TEST"
        
      # Extract browser name and image
      name=$(echo $browser | jq -r '.name')
      image=$(echo $browser | jq -r '.image')

      # Build a Docker image for the browser
      tag="$name"
      echo "Building Docker image for $name using base image $image..."
      docker build --build-arg BASE_IMAGE=$image -t $tag .

      if [ $? -eq 0 ]; then
        echo "Successfully built $tag"
      else
        echo "Failed to build $tag"
        exit 1
      fi

      # Push the Docker image to the registry
      echo "Pushing $tag to Docker registry..."
      docker push $tag

      if [ $? -eq 0 ]; then
        echo "Successfully pushed $tag"
      else
        echo "Failed to push $tag"
        exit 1
      fi
    done

    echo "All images built and pushed successfully."

  else
    echo "$IMAGE_NAME_SELENIUM is up to date in version $LATEST_TAG_COMETA"
  fi
done

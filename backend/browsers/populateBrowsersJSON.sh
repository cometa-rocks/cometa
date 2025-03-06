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
  #Check if the version is valid by checking http response code (200-299 OK)
  URL="https://hub.docker.com/v2/repositories/$IMAGE_NAME_SELENIUM/tags/$VERSION_TEST"
  RESPONSE_SELENIUM=$(curl -s -w "%{http_code}" -o /dev/null "$URL")
  if [ "$RESPONSE_SELENIUM" -ge 200 ] && [ "$RESPONSE_SELENIUM" -lt 300 ]; then
    echo "Current $IMAGE_NAME_COMETA version is $LATEST_TAG_COMETA"
    echo "❗Found newer version for $IMAGE_NAME_SELENIUM: $VERSION_TEST"
    #write version in browsers.json and call backend/browsers/build_browser_images.sh
    # replaces the version section of name and images keys of the json. 
    BROWSERS_JSON=$(echo "$BROWSERS_JSON" | jq --argjson index "$i" --arg version "$VERSION_TEST" --arg name "$IMAGE_NAME_COMETA" --arg image "$IMAGE_NAME_SELENIUM" '
    .browsers += [{"name": "\($name):\($version)", "image": "\($image):\($version)"}]')
  else
    echo "$IMAGE_NAME_SELENIUM is up to date in version $LATEST_TAG_COMETA"
  fi
done
# Write the final JSON array to browsers.json
echo "$BROWSERS_JSON" | jq . > browsers.json
# Check if there are any browsers to update
if [ "$(echo "$BROWSERS_JSON" | jq '.browsers | length')" -gt 0 ]; then
echo "browsers.json updated"
echo "---------------CALLING BUILDING AND PUSHING SCRIPT---------------"
./build_browser_images.sh
else
echo "Not calling image building script, all browsers are up to date"
fi
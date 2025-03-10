update_cometa_browsers() {
  cd ../src/defaults
  local browsers_json="$1"

  # Read the current cometa_browsers.json
  local cometa_browsers=$(cat cometa_browsers.json)

  # Iterate over each browser in browsers.json
  while read -r browser; do
    # Get full browser image name
    local name=$(echo "$browser" | jq -r '.name')
    # Extract the last version number
    local original_version=$(echo "$name" | grep -o '[0-9]\+\.[0-9]\+$')
    # Ensure version is an integer by removing any decimals (e.g., 134.0 → 134)
    original_version=$(echo "$original_version" | cut -d'.' -f1 | tr -d '\n' | tr -d '\r')
    # Get the browser tipe (eg "chrome", "edge", "firefox")
    local browser_type=$(echo "$name" | cut -d'/' -f2 | cut -d':' -f1)

    echo "Updating $browser_type to version $original_version..."
    # Reset version for every browser type
    local version=$original_version  

    # Update JSON with the latest versions
    for i in $(echo "$cometa_browsers" | jq 'keys | .[]'); do
      if [[ $(echo "$cometa_browsers" | jq -r --argjson i "$i" '.[$i].fields.browser_json.browser') == "$browser_type" ]]; then
        echo "Setting $browser_type to version ${version}.0"
        
        # Properly format version
        clean_version=$(echo "${version}.0" | tr -d '\n')

        # Set the version
        cometa_browsers=$(echo "$cometa_browsers" | jq --argjson i "$i" --arg version "$clean_version" '
          .[$i].fields.browser_json.browser_version = $version')

        # Decrement version
        version=$((version - 1))
      fi
    done
  done <<< "$(echo "$browsers_json" | jq -c '.browsers[]')"

  # Write the updated JSON back to the file
  echo "$cometa_browsers" | jq . > cometa_browsers.json
  cd -
}

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
    # replaces the version section of name and images keys of the json. 
    BROWSERS_JSON=$(echo "$BROWSERS_JSON" | jq --argjson index "$i" --arg version "$VERSION_TEST" --arg name "$IMAGE_NAME_COMETA" --arg image "$IMAGE_NAME_SELENIUM" '
    .browsers += [{"name": "\($name):\($version)", "image": "\($image):\($version)"}]')
  else
    echo "$IMAGE_NAME_SELENIUM is up to date in version $LATEST_TAG_COMETA"
  fi
done
cd $IMAGE_PATH
# Write the final JSON array to browsers.json
echo "$BROWSERS_JSON" | jq . > browsers.json

# Check if there are any browsers to update
if [ "$(echo "$BROWSERS_JSON" | jq '.browsers | length')" -gt 0 ]; then
echo "browsers.json updated"
echo "---------------CALLING BUILDING AND PUSHING SCRIPT---------------"
./build_browser_images.sh
# update file in backend/src/defaults/cometa_browsers.json with new versions
echo "---------------Updating cometa_browsers.json---------------"
update_cometa_browsers "$BROWSERS_JSON"
else
echo "Not calling image building script, all browsers are up to date"
fi
cd -
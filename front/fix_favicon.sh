#!/bin/bash

# Define the files where favicon replacements are needed
export COMETA_REPLACE_FAVICON_IN="/usr/local/apache2/htdocs/index.html /usr/local/apache2/htdocs/manifest.json /usr/local/apache2/htdocs/welcome.html"

# Loop through each file and replace @@BRANCH@@ with 'master'
for FILE in ${COMETA_REPLACE_FAVICON_IN}; do
    docker exec cometa_front sed -i 's/@@BRANCH@@/master/g' $FILE
    echo "Updated: $FILE"
done

# Restart the cometa_front container
docker restart cometa_front

echo "Favicon update completed. Container restarted."

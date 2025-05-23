#!/bin/bash

HTTPD_FILE_SOURCE="/code/front/apache2/conf/httpd.conf"
HTTPD_FILE_DESTINATION="/usr/local/apache2/cometa_conf/httpd.conf"

cp "$HTTPD_FILE_SOURCE" "$HTTPD_FILE_DESTINATION"
if [ $? -ne 0 ]; then
#   echo "ERROR: Failed to copy $HTTPD_FILE_SOURCE to $HTTPD_FILE_DESTINATION"
  echo -e "\e[31mERROR: Failed to copy $HTTPD_FILE_SOURCE to $HTTPD_FILE_DESTINATION\e[0m"
  exit 1
else
  echo "Successfully copied $HTTPD_FILE_SOURCE to $HTTPD_FILE_DESTINATION"
fi


PATH_FILE_SOURCE="/code/front/apache2/conf/paths.conf"
PATH_FILE_DESTINATION="/usr/local/apache2/cometa_conf/paths.conf"

cp "$PATH_FILE_SOURCE" "$PATH_FILE_DESTINATION"
if [ $? -ne 0 ]; then
  echo -e "\e[31mERROR: Failed to copy $PATH_FILE_SOURCE to $PATH_FILE_DESTINATION\e[0m"
  exit 1
else
  echo "Successfully copied $PATH_FILE_SOURCE to $PATH_FILE_DESTINATION"
fi


OPENIDC_TARGET="/usr/local/apache2/cometa_conf/openidc.conf"
OPENIDC_SOURCE="/code/front/apache2/conf/openidc.conf"

if [ ! -f "$OPENIDC_TARGET" ]; then
  echo "\e[1;33m$OPENIDC_TARGET not found. Attempting to copy from $OPENIDC_SOURCE...\e[0m"

  cp "$OPENIDC_SOURCE" "$OPENIDC_TARGET"
  if [ $? -ne 0 ]; then
    echo -e "\e[31mERROR: Failed to copy $OPENIDC_SOURCE to $OPENIDC_TARGET\e[0m"
    exit 1
  else
    echo "Successfully copied $OPENIDC_SOURCE to $OPENIDC_TARGET"
  fi
else
  echo "$OPENIDC_TARGET already exists."
fi



MODULES_SOURCE="/code/front/apache2/modules"
MODULES_DESTINATION="/usr/local/apache2/modules/"

cp -r "$MODULES_SOURCE"/* "$MODULES_DESTINATION/"
if [ $? -ne 0 ]; then
    echo -e "\e[31mERROR: Failed to copy apache modules from $MODULES_SOURCE to $MODULES_DESTINATION\e[0m"
    exit 1
else
    echo "Successfully copied $MODULES_SOURCE to $MODULES_DESTINATION"
fi


METADATA_SOURCE="/code/front/apache2/metadata"
METADATA_DESTINATION="/usr/local/apache2/conf/metadata"

echo "Checking contents of $METADATA_DESTINATION"

# Check if there are *no* files in the destination
if [ -z "$(find "$METADATA_DESTINATION" -type f 2>/dev/null)" ]; then
  echo "No metadata files found in $METADATA_DESTINATION. Copying from source..."

  cp -r "$METADATA_SOURCE"/* "$METADATA_DESTINATION/"
  if [ $? -ne 0 ]; then
    echo -e "\e[31mERROR: Failed to copy metadata files from $METADATA_SOURCE to $METADATA_DESTINATION\e[0m"
    exit 1
  else
    echo "Successfully copied $METADATA_SOURCE to $METADATA_DESTINATION"
  fi
else
  echo "Apache metadata files already exist in $METADATA_DESTINATION"
fi



METADATA_DIR="/usr/local/apache2/conf/metadata"

for file in "$METADATA_DIR"/*.client; do
  if grep -q "CLIENTID@@" "$file"; then
    echo -e "\e[1;33mWARNING: Client secrets are not updated in $(basename "$file"), you might not be able to login\e[0m"
  fi
done

#!/bin/bash
# #########################################
# AMVARA CONSULTING S.L. - 2025
# #########################################
# Motivation: 
# This file contains common script and imported in to start_server.sh and start.sh
# There are configuration folder level validations 
# Which needs to be performed while doing development setup and production deployment
# It used to maintain common validation code for both environment


HTTPD_FILE_SOURCE="/code/front/apache2/conf/httpd.conf"
HTTPD_FILE_DESTINATION="/usr/local/apache2/cometa_conf/httpd.conf"

# Check if destination is a directory and remove it if it is
if [ -d "$HTTPD_FILE_DESTINATION" ]; then
    rm -rf "$HTTPD_FILE_DESTINATION"
    echo "Removed directory $HTTPD_FILE_DESTINATION"
fi

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

# Check if destination is a directory and remove it if it is
if [ -d "$PATH_FILE_DESTINATION" ]; then
    rm -rf "$PATH_FILE_DESTINATION"
    echo "Removed directory $PATH_FILE_DESTINATION"
fi


cp "$PATH_FILE_SOURCE" "$PATH_FILE_DESTINATION"
if [ $? -ne 0 ]; then
  echo -e "\e[31mERROR: Failed to copy $PATH_FILE_SOURCE to $PATH_FILE_DESTINATION\e[0m"
  exit 1
else
  echo "Successfully copied $PATH_FILE_SOURCE to $PATH_FILE_DESTINATION"
fi


OPENIDC_SOURCE="/code/front/apache2/conf/openidc.conf"
OPENIDC_DESTINATION="/usr/local/apache2/cometa_conf/openidc.conf"

# Check if destination is a directory and remove it if it is
if [ -d "$OPENIDC_DESTINATION" ]; then
    rm -rf "$OPENIDC_DESTINATION"
    echo "Removed directory $OPENIDC_DESTINATION"
fi


if [ ! -f "$OPENIDC_DESTINATION" ]; then
  echo "\e[1;33m$OPENIDC_DESTINATION not found. Attempting to copy from $OPENIDC_SOURCE...\e[0m"

  cp "$OPENIDC_SOURCE" "$OPENIDC_DESTINATION"
  if [ $? -ne 0 ]; then
    echo -e "\e[31mERROR: Failed to copy $OPENIDC_SOURCE to $OPENIDC_DESTINATION\e[0m"
    exit 1
  else
    echo "Successfully copied $OPENIDC_SOURCE to $OPENIDC_DESTINATION"
  fi
else
  echo "$OPENIDC_DESTINATION already exists."
fi

#!/bin/bash

MODULES_SOURCE="/code/front/apache2/modules/mod_auth_openidc.so"
MODULES_DESTINATION="/usr/local/apache2/modules/mod_auth_openidc.so"

if [ ! -f "$MODULES_DESTINATION" ]; then
    echo -e "\e[1;33m$MODULES_DESTINATION not found. Attempting to copy from $MODULES_SOURCE...\e[0m"

    # Ensure source file exists and is not empty
    if [ ! -s "$MODULES_SOURCE" ]; then
        echo -e "\e[31mERROR: Source module $MODULES_SOURCE does not exist or is empty.\e[0m"
        exit 1
    fi

    # Copy the single .so file
    cp "$MODULES_SOURCE" "$MODULES_DESTINATION"
    if [ $? -ne 0 ]; then
        echo -e "\e[31mERROR: Failed to copy Apache module from $MODULES_SOURCE to $MODULES_DESTINATION\e[0m"
        exit 1
    else
        echo -e "\e[32mSuccessfully copied $MODULES_SOURCE to $MODULES_DESTINATION\e[0m"
    fi
else
    echo -e "\e[32m$MODULES_DESTINATION already exists. Skipping copy.\e[0m"
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

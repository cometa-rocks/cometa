#!/bin/bash
# #########################################
# AMVARA CONSULTING S.L. - 2025
# #########################################
# Motivation: 
# This file is used in production environments to start the apache server 
# This is kept separate to avoid the building angular code in the server



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


if [ $? -ne 0 ]; then
  echo "ERROR: Failed to execute apache configurations check"
  exit 1
fi

touch /usr/local/apache2/logs/error_log
touch /usr/local/apache2/logs/access.log

mkdir -p /usr/local/apache2/htdocs/infra

touch /usr/local/apache2/htdocs/infra/lbtest1.html
# Create the HTML file with the content
cat <<EOF > "/usr/local/apache2/htdocs/infra/lbtest1.html"
<html>
  <head>
    <title>LB Test #1</title>
  </head>
  <body>
    <p>Status: OK</p>
  </body>
</html>
EOF

# #########
# This function checks if self signed SSL certificate exists
# and it is not expired if so or missing it will create one
# @params:
# #########
function check_ssl_certificate() {

    echo -e "\e[37mChecking SSL certificate...\e[0m"

    # set cert file
    CERTFILE="/share/apache2/certs/apache-self-signed.crt"
    # set privkey file
    PRIVKEY="/share/apache2/certs/apache-self-signed.key"
    # get directory path
    CERTDIR=$(dirname "$CERTFILE")

    # check if certificate directory is writable
    if [ ! -w "$CERTDIR" ]; then
        echo -e "\e[31mError: Directory '$CERTDIR' is not writable. Cannot proceed.\e[0m"
        exit 1
    fi

    # check if cert/key files exist
    CREATE_NEW=FALSE
    [ ! -f "$CERTFILE" ] && CREATE_NEW=TRUE
    [ ! -f "$PRIVKEY" ] && CREATE_NEW=TRUE

    if [[ "$CREATE_NEW" == "FALSE" ]]; then
        echo "SSL certificate exists ... checking expiration date"

        EXPIRATION_DATE_CERT=$(date --date="$(openssl x509 -enddate -noout -in "$CERTFILE" | cut -d= -f2)" +"%s")
        CURRENT_DATE=$(date +"%s")
        DIFFERENCE_BETWEEN=$((EXPIRATION_DATE_CERT - CURRENT_DATE))

        echo "SSL certificate expires on:" $(date -d @"$EXPIRATION_DATE_CERT" +"%Y-%m-%d")

        DAYS_DIFFERENCE=10
        DAYS_DIFFERENCE_SECONDS=$((DAYS_DIFFERENCE * 24 * 60 * 60))

        if [[ $DIFFERENCE_BETWEEN -gt $DAYS_DIFFERENCE_SECONDS ]]; then
            echo "SSL Certificate is valid ... meaning it's not expiring in $DAYS_DIFFERENCE days."
            return
        fi
    fi

    echo "Generating a new certificate..."
    openssl req -days 365 -nodes -x509 -newkey rsa:4096 \
        -keyout "$PRIVKEY" -out "$CERTFILE" -sha256 \
        -subj "/CN=localhost"

    if [[ $? -eq 0 ]]; then
        echo -e "\e[32mCertificate generation successful.\e[0m"
    else
        echo -e "\e[31mFailed to generate certificate.\e[0m"
        exit 1
    fi
}



check_ssl_certificate

echo -e "\e[32mSuccessful\e[0m"

# #########################################
# Restart apache server
# #########################################
httpd -k start

find /proc -mindepth 2 -maxdepth 2 -name exe -exec ls -lh {} \; 2>/dev/null  | grep -q "/usr/bin/tail" || tail -f /usr/local/apache2/logs/error_log /usr/local/apache2/logs/access.log

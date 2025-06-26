#!/bin/bash
# #########################################
# AMVARA CONSULTING S.L. - 2025
# #########################################
# Motivation: 
# This file is used in production environments to start the apache server 
# This is kept separate to avoid the building angular code in the server

source ./s_apache_conf.sh

if [ $? -ne 0 ]; then
  echo "ERROR: Failed to execute apache configurations check"
  exit 1
fi


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
httpd -f /usr/local/apache2/cometa_conf/httpd.conf -k start

find /proc -mindepth 2 -maxdepth 2 -name exe -exec ls -lh {} \; 2>/dev/null  | grep -q "/usr/bin/tail" || tail -f /usr/local/apache2/logs/error_log /usr/local/apache2/logs/access.log

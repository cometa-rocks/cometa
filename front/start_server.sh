#!/bin/bash
# #########################################
# AMVARA CONSULTING S.L. - 2024
# #########################################


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


function update_favicon_icon() {
  # Define the mapping of DEPLOYMENT_TYPE to branch names
  declare -A BRANCH_MAP=( ["production"]="master" ["stage"]="stage" )

  # Get the branch name from the DEPLOYMENT_TYPE variable (default to "master")
  BRANCH_NAME=${BRANCH_MAP[${DEPLOYMENT_TYPE}]:-master}

  echo "DEPLOYMENT_TYPE: '${DEPLOYMENT_TYPE:-unset}'"
  echo "Resolved branch name: '${BRANCH_NAME}'"

  # Define files where replacement should happen
  export COMETA_REPLACE_FAVICON_IN="/usr/local/apache2/htdocs/index.html /usr/local/apache2/htdocs/manifest.json /usr/local/apache2/htdocs/welcome.html"

  # Perform replacement in each file inside the Docker container
  for FILE in ${COMETA_REPLACE_FAVICON_IN}; do
    sed -i "s/@@BRANCH@@/${BRANCH_NAME}/g" "$FILE"
    echo "Successfully updated $FILE"
  done
  
  echo "Favicon update process completed."

}

function update_apache_conf() {
  echo "Updating Apache httpd.conf and paths.conf"
  cp /code/front/apache2/conf/httpd.conf /usr/local/apache2/conf/httpd.conf && echo "httpd.conf updated." || echo "Failed to update httpd.conf!" >&2
  cp /code/front/apache2/conf/paths.conf /usr/local/apache2/conf/paths.conf && echo "paths.conf updated." || echo "Failed to update paths.conf!" >&2
}


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

        # check if all three files exist
        test ! -f ${CERTFILE} && CREATE_NEW=TRUE
        test ! -f ${PRIVKEY} && CREATE_NEW=TRUE

        # check if we need to create a new SSL certificate
        if [[ "${CREATE_NEW:-FALSE}" == "FALSE" ]]; then
                echo "SSL certificate exists ... checking expiration date"

                # check the expiration date for the cert file
                EXPIRATION_DATE_CERT=`date --date="$(openssl x509 -enddate -noout -in $CERTFILE |cut -d= -f 2)" +"%s"`
                # get current date
                CURRENT_DATE=`date +"%s"`
                # date difference between two dates
                DIFFERENCE_BETWEEN=$(($EXPIRATION_DATE_CERT-$CURRENT_DATE))

                echo "SSL certificate expires on:" $(date -d @${EXPIRATION_DATE_CERT} +"%Y-%m-%d")

                # number of days difference before considering it exipired
                DAYS_DIFFERENCE="10"
                # days difference in seconds
                DAYS_DIFFERENCE_SECONDS=$(($DAYS_DIFFERENCE*24*60*60))
                # check if certificate is valid
                if [[ $DIFFERENCE_BETWEEN -gt $DAYS_DIFFERENCE_SECONDS ]]; then
                        echo "SSL Certificate is valid ... meaning it's not expiring in ${DAYS_DIFFERENCE} days."
                        # do nothing certificate is valid
                        return
                fi
        fi

        echo "Generating a new certificate..."
        # generate a new certificate
        openssl req -days 365 -nodes -x509 -newkey rsa:4096 -keyout ${PRIVKEY} -out ${CERTFILE} -sha256 -days 365 -subj '/CN=localhost'

        echo -e "\e[32mOK\e[0m"
}

# Update favicon icon
update_favicon_icon

# Update paths and httpd.conf
update_apache_conf

# check_ssl_certificate

echo -e "\e[32mSuccessful\e[0m"

# #########################################
# Restart apache server
# #########################################
httpd -k start

find /proc -mindepth 2 -maxdepth 2 -name exe -exec ls -lh {} \; 2>/dev/null  | grep -q "/usr/bin/tail" || tail -f /usr/local/apache2/logs/error_log /usr/local/apache2/logs/access.log

#!/bin/bash
# #########################################
# AMVARA CONSULTING S.L. - 2024
# #########################################

# #########
# This function checks if self signed SSL certificate exists
# and it is not expired if so or missing it will create one
# @params:
# #########
function check_ssl_certificate() {

	echo -e "\e[37mChecking SSL certificate...\e[0m"

	# set cert file
	CERTFILE="/etc/ssl/certs/apache-self-signed.crt"
	# set privkey file
	PRIVKEY="/etc/ssl/certs/apache-self-signed.key"

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


check_ssl_certificate

echo -e "\e[32mSuccessful\e[0m"

# #########################################
# Restart apache server
# #########################################
httpd -k start

find /proc -mindepth 2 -maxdepth 2 -name exe -exec ls -lh {} \; 2>/dev/null  | grep -q "/usr/bin/tail" || tail -f /usr/local/apache2/logs/error_log /usr/local/apache2/logs/access.log

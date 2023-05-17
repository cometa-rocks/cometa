#!/bin/bash
# #########################################
# AMVARA CONSULTING S.L. - 2020
# #########################################
# Changelog:
# 2020-07-24 RRO cat output.log to viewshow possible compile errors
# 2020-02-06 ASO Modified script into seperate functions for easy execution
# 2018-11-12 ABA First version
# #########################################

# #########################################
# Variable to help track what is needed
# #########################################


# #########################################
# Functions to do things depending on what
# is request from the command line
# #########################################

# #########
# This function installs essentials needed to run.
# Only needed in fresh install
# @params:
# #########
function install_essentials(){
	echo -e "\e[37mStartup cleanup...\e[0m"
	echo "" > output.log 2>&1
	rm -rf /code/node_modules/ >> output.log 2>&1
	echo -e "\e[32mDone\e[0m"
	echo -e "\e[37mUpdating packages...\e[0m"
	apt-get update >> output.log 2>&1
	echo -e "\e[32mOK\e[0m"
	echo -e "\e[37mInstalling some useful packages...\e[0m"
	apt-get install -y vim nano git curl gnupg2 >> output.log 2>&1
	echo -e "\e[32mOK\e[0m"

	echo -e "\e[37mInstalling NodeJS & NPM...\e[0m"
	curl -sL https://deb.nodesource.com/setup_14.x | bash - >> output.log 2>&1
	apt-get install -y nodejs >> output.log 2>&1
	echo -e "\e[32mOK\e[0m"

	# create lbtest1.html just in case we are running behind a LB
	# This is normally done with the gitlab.yml file. In case recreateing the container we
	# would need this file to be created here
	mkdir -p /usr/local/apache2/htdocs/infra/
	cat <<EOF > /usr/local/apache2/htdocs/infra/lbtest1.html
<html>
<head>
  <title>LB Test #1</title>

</head>
<body>
 <p>Status: OK</p>
</body>
</html>
EOF


}

# #########
# This function installs angular and npm packages.
# @params:
# #########
function install_angular(){
	# echo -e "\e[37mInstalling @angular/cli...\e[0m"
	# npm install -g @angular/cli >> output.log 2>&1
	# echo -e "\e[32mOK\e[0m"
	echo -e "\e[37mInstalling npm packages...\e[0m"
	npm ci >> output.log 2>&1
	# sed -i "s/CanvasPathMethods/CanvasPath/g" /code/node_modules/\@types/d3-shape/index.d.ts
	echo -e "\e[32mOK\e[0m"
}

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

# #########
# This function builds angular project
# and copies the content to the apache
# folder.
# needed on hot deployment
# @params:
# #########
function build_project(){
	# replace baseHref inside index.html before serving
	sed -i 's#<base href="/debug/">#<base href="/">#' /code/src/index.html
	# get uid and gid of user that owns content outside
	UIDGID=$(stat -c "%u:%g" /code)
	echo -e "\e[37mCompiling...\e[0m"
	npx ng build -c production >> output.log 2>&1
	# If building the App went wrong throw error on purpose
	if [ $? -ne 0 ]; then
		echo -e "\e[1;31mSomething went wrong while compiling the App, check output.log for more details...\e[0m"
		exit 1
	fi
	echo -e "\e[32mDone\e[0m"
	cat output.log

	echo -e "\e[37mCopying files to public folder...\e[0m"
	cp -a /code/dist/. /usr/local/apache2/htdocs/ >> output.log 2>&1

	# FIX me does not work in localhost
	echo "Fixing user permissions, setting uid and gid to: ${UIDGID}"
	chown -R ${UIDGID} /code
}

# #########
# This function will serve the angular project
# on port 4200 but will be accessible from /debug/
# if the configuration in apache is activated.
# @params:
# #########
function serve_project() {
	# replace baseHref inside index.html before serving
	sed -i 's#<base href="/">#<base href="/debug/">#' /code/src/index.html
	# serve the project
	npx ng serve
}

# #########
# This function installs openidc module
# to apache server.
# Only needed in fresh install
# @params:
# #########
function install_openidc(){
	# install some oidc feature before starting httpd service
	cd /tmp
	apt-get update
	apt-get install -y pkg-config make gcc gdb lcov valgrind vim curl iputils-ping wget
	apt-get install -y autoconf automake libtool
	apt-get install -y libssl-dev libjansson-dev libcurl4-openssl-dev check
	apt-get install -y libpcre3-dev zlib1g-dev libcjose0 libcjose-dev
	cd -
}

# #########
# Outputs help on how to use the script.
# @params:
# #########
function help(){
	echo -ne "
${0} [OPTIONS]

OPTIONS:
	openidc						installs openidc and loads the configuration file
	basic						installs basic packages to start angular like node.
	angular						installs angular and all the node_modules packages.
	compile						compiles the angular project and copies the content to the apache's htdocs
	serve						serves the app on port 4200 and reverse proxies it to /debug/

EXAMPLES:
	* Fresh install / Complete Deployment
	${0} openidc basic angular compile

	* Just update / Hot deployment
	${0} angular compile
"
	exit 10
}

# #########################################
# Read command line arguments and decide
# what to do.
# #########################################


# #########
# If no arguments are passed, show help
# #########
if [[ $# -eq 0 ]]; then
    echo "No arguments set ... nothing to do here."
	echo "Just starting apache server ..."
fi

# #########
# User arguments
# #########
while [[ $# -gt 0 ]]
do
    key="$1"
    case $key in
    basic)
        BASIC=TRUE
        shift
        ;;
    angular)
        ANGULAR=TRUE
        shift
        ;;
    openidc)
        OPENIDC=TRUE
        shift
        ;;
    compile)
        COMPILE=TRUE
        shift
        ;;
	serve)
		SERVE=TRUE
		shift
		;;
	no-restart)
		NORESTART=TRUE
		shift
		;;
    *)    # unknown option
        echo "Unknown option ${key}, try again...";
        help
        shift # past argument
        ;;
    esac
done

# #########
# Execute function depending on what is found on cmd
# #########
test "${OPENIDC:-FALSE}" == "TRUE" && install_openidc

# #########
# FIX SSL Certificate
# #########
check_ssl_certificate

test "${BASIC:-FALSE}" == "TRUE" && install_essentials
test "${ANGULAR:-FALSE}" == "TRUE" && install_angular
test "${COMPILE:-FALSE}" == "TRUE" && build_project
test "${SERVE:-FALSE}" == "TRUE" && serve_project

echo -e "\e[32mSuccessful\e[0m"


if [[ "${NORESTART:-FALSE}" == "FALSE" ]]; then
	# #########################################
	# Restart apache server
	# #########################################
	httpd -k restart

	find /proc -mindepth 2 -maxdepth 2 -name exe -exec ls -lh {} \; 2>/dev/null  | grep -q "/usr/bin/tail" || tail -f /usr/local/apache2/logs/error_log /usr/local/apache2/logs/access.log
fi
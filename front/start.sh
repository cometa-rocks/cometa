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
	if [[ "$USEPROXY" == "TRUE" ]]; then
		echo "proxy = 192.168.200.200:53128" > ~/.curlrc
	fi
	curl -sL https://deb.nodesource.com/setup_14.x | bash - >> output.log 2>&1
	apt-get install -y nodejs >> output.log 2>&1
	if [[ "$USEPROXY" == "TRUE" ]]; then
		npm config set strict-ssl false
		npm config set registry "http://registry.npmjs.org/"
		npm config set proxy http://192.168.200.200:53128
		npm config set https-proxy http://192.168.200.200:53128
	fi
	echo -e "\e[32mOK\e[0m"
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
# This function builds angular project
# and copies the content to the apache
# folder.
# needed on hot deployment
# @params:
# #########
function build_project(){
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
function serve_project(){
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
	apt-get install -y libpcre3-dev zlib1g-dev
	wget https://mod-auth-openidc.org/download/libcjose0_0.6.1.5-1~bionic+1_amd64.deb
	wget https://mod-auth-openidc.org/download/libcjose-dev_0.6.1.5-1~bionic+1_amd64.deb
	dpkg -i libcjose0_0.6.1.5-1~bionic+1_amd64.deb
	dpkg -i libcjose-dev_0.6.1.5-1~bionic+1_amd64.deb
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
test "${BASIC:-FALSE}" == "TRUE" && install_essentials
test "${ANGULAR:-FALSE}" == "TRUE" && install_angular
test "${COMPILE:-FALSE}" == "TRUE" && build_project
test "${SERVE:-FALSE}" == "TRUE" && serve_project

echo -e "\e[32mSuccessful\e[0m"


if [[ "${NORESTART:-FALSE}" == "FALSE" ]]; then
	# #########################################
	# Start apache server
	# #########################################
	httpd -k restart

	find /proc -mindepth 2 -maxdepth 2 -name exe -exec ls -lh {} \; 2>/dev/null  | grep -q "/usr/bin/tail" || tail -f /usr/local/apache2/logs/error_log
fi
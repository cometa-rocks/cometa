#!/bin/bash
# #########################################
# AMVARA CONSULTING S.L. - 2020
# #########################################

# #########
function install_essentials(){
	echo -e "\e[37mStartup cleanup...\e[0m"
	echo "" > output.log 2>&1
	rm -rf /code/front/node_modules/ >> output.log 2>&1
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
	npm config set unsafe-perm true
	echo -e "\e[37mInstalling npm packages...\e[0m"
	npm ci >> output.log 2>&1
	# sed -i "s/CanvasPathMethods/CanvasPath/g" /code/front/node_modules/\@types/d3-shape/index.d.ts
	echo -e "\e[32mOK\e[0m"
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
	apt-get install -y libapache2-mod-security2
	cd -
}

install_openidc
install_essentials
install_angular 
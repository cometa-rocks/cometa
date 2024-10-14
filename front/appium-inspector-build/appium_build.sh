#!/bin/bash
# #########################################
# AMVARA CONSULTING S.L. - 2024
# #########################################
# Author : Anand Kushwaha
# Date : 14-10-2024

# #########
# This function installs appium inspector
# to apache server.
# Only needed in fresh install
# @params:
# #########
function install_appium_inspector(){
	# install some oidc feature before starting httpd service
    echo -e "\e[37mInstalling git...\e[0m"
	apt-get install git
    echo -e "\e[37mCloning the appium-inspector repo...\e[0m"
	git clone https://github.com/AMVARA-CONSULTING/appium-inspector.git
    echo -e "\e[37mchanged directory to /app/appium-inspector...\e[0m"
	cd /app/appium-inspector
	echo -e "\e[37mInstalling dependencies...\e[0m"
    npm i
	echo -e "\e[37mbuiling the appium inspector...\e[0m"
    npm run build:browser
    echo -e "\e[32mOK\e[0m"
}

install_appium_inspector
#!/bin/bash
# #########################################
# AMVARA CONSULTING S.L. - 2024
# #########################################
# Author : Anand Kushwaha
# Date : 14-10-2024


function scan_for_vulnerabilities(){	
	# Scan the front and appium-inspector/node_modules directories for vulnerabilities
	git clone --depth 1 https://github.com/gensecaihq/Shai-Hulud-2.0-Detector.git /tmp/detector
    cd /tmp/detector && npm ci --ignore-scripts
	export INPUT_FAIL_ON_CRITICAL=true
	echo "=== Scanning /app/appium-inspector ==="
	export INPUT_WORKING_DIRECTORY=/app/appium-inspector
	export INPUT_FAIL_ON_CRITICAL=true
	export INPUT_FAIL_ON_HIGH=true
	export INPUT_FAIL_ON_ANY=true
	export INPUT_SCAN_LOCKFILES=true
	export INPUT_SCAN_NODE_MODULES=true
    echo "=== Scanning package.json and package-lock.json and /app/appium-inspector/node_modules/*/package.json and /app/appium-inspector/node_modules/*/package-lock.json for security vulnerabilities ==="
    node /tmp/detector/dist/index.js
	echo "=== Scanning complete ==="
	cd -
	######### scanning complete #########	
}

# #########
# This function installed appium inspector
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
	rm .git -R
	echo -e "\e[37mInstalling dependencies...\e[0m"
    npm ci --ignore-scripts
	echo -e "\e[37mScanning for vulnerabilities...\e[0m"
	scan_for_vulnerabilities
	echo -e "\e[37mScanning complete ==="
	echo -e "\e[37mbuiling the appium inspector...\e[0m"
    npm run build:browser
    echo -e "\e[32mOK\e[0m"
}

install_appium_inspector
#!/bin/bash

git pull origin master
apt-get update
apt-get install -y nodejs
npm install
npm install -g @angular/cli
ng build --prod --aot
docker start cometa_nginx
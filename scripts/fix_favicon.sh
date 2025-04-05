export COMETA_REPLACE_FAVICON_IN="/usr/local/apache2/htdocs/index.html /usr/local/apache2/htdocs/manifest.json /usr/local/apache2/htdocs/welcome.html" 
for FILE in ${COMETA_REPLACE_FAVICON_IN}; do docker exec cometa_front sed -i 's/@@BRANCH@@/'master'/g' $FILE; done
docker restart cometa_front
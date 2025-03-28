#/bin/bash

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

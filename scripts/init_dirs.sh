#!/bin/bash
cd ..
# Check if a directory path is provided
if [ -n "$1" ]; then
    BASE_DIR="$1"
else
    BASE_DIR="./data"
fi

# Define the list of directories
dirs=(
    "$BASE_DIR/front/apache2/metadata"
    "$BASE_DIR/front/apache2/certs"
    "$BASE_DIR/front/apache2/conf"
    "$BASE_DIR/front/apache2/modules"
    "$BASE_DIR/cometa/screenshots"
    "$BASE_DIR/cometa/videos"
    "$BASE_DIR/cometa"
    "$BASE_DIR/cometa/pdf"
    "$BASE_DIR/cometa/downloads"
    "$BASE_DIR/cometa/uploads"
    "$BASE_DIR/department_data"
    "$BASE_DIR/cometa/config"
    "$BASE_DIR/django/migrations"
    "$BASE_DIR/django/logs"
    "$BASE_DIR/django/clamav"
    "$BASE_DIR/redis/certs"
)

# Loop through each directory and create if it does not exist
for dir in "${dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo "Created: $dir"
    else
        echo "Already exists: $dir"
    fi
done

# Copy files to their respective locations
# Copy httpd.conf
if [ -f "./front/apache2/conf/httpd.conf" ]; then
    cp "./front/apache2/conf/httpd.conf" "$BASE_DIR/front/apache2/conf/httpd.conf"
    echo "Copied: ./front/apache2/conf/httpd.conf -> $BASE_DIR/front/apache2/conf/httpd.conf"
else
    echo "Warning: Source file not found - ./front/apache2/conf/httpd.conf"
fi

# Copy openidc.conf
if [ -f "./front/apache2/conf/openidc.conf" ]; then
    cp "./front/apache2/conf/openidc.conf" "$BASE_DIR/front/apache2/conf/openidc.conf"
    echo "Copied: ./front/apache2/conf/openidc.conf -> $BASE_DIR/front/apache2/conf/openidc.conf"
else
    echo "Warning: Source file not found - ./front/apache2/conf/openidc.conf"
fi

# Copy paths.conf
if [ -f "./front/apache2/conf/paths.conf" ]; then
    cp "./front/apache2/conf/paths.conf" "$BASE_DIR/front/apache2/conf/paths.conf"
    echo "Copied: ./front/apache2/conf/paths.conf -> $BASE_DIR/front/apache2/conf/paths.conf"
else
    echo "Warning: Source file not found - ./front/apache2/conf/paths.conf"
fi

# Copy mod_auth_openidc.so
if [ -f "./front/apache2/modules/mod_auth_openidc.so" ]; then
    cp "./front/apache2/modules/mod_auth_openidc.so" "$BASE_DIR/front/apache2/modules/mod_auth_openidc.so"
    echo "Copied: ./front/apache2/modules/mod_auth_openidc.so -> $BASE_DIR/front/apache2/modules/mod_auth_openidc.so"
else
    echo "Warning: Source file not found - ./front/apache2/modules/mod_auth_openidc.so"
fi

# Copy front/apache2/metadata
if [ -d "./front/apache2/metadata" ]; then
    cp -r "./front/apache2/metadata" "$BASE_DIR/front/apache2/"
    echo "Copied: ./front/apache2/metadata -> $BASE_DIR/front/apache2/metadata"
else
    echo "Warning: Source file not found - ./front/metadata"
fi
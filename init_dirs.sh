#!/bin/bash

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

# Define the list of files to copy
declare -A files=(
    ["./front/apache2/conf/httpd.conf"]="$BASE_DIR/front/apache2/conf/httpd.conf"
    ["./front/apache2/conf/openidc.conf"]="$BASE_DIR/front/apache2/conf/openidc.conf"
    ["./front/apache2/conf/paths.conf"]="$BASE_DIR/front/apache2/conf/paths.conf"
    ["./front/apache2/modules/mod_auth_openidc.so"]="$BASE_DIR/front/apache2/modules/mod_auth_openidc.so"
)

# Copy files to their respective locations
for src in "${!files[@]}"; do
    dest="${files[$src]}"
    if [ -f "$src" ]; then
        cp "$src" "$dest"
        echo "Copied: $src -> $dest"
    else
        echo "Warning: Source file not found - $src"
    fi
done

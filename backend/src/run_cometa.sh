#!/bin/bash
echo "Running cometa..."
docker-compose up -d
echo "Migrating postgres database..."
./django_migrate.sh
echo "Restarting Django"
docker stop cometa_django
sleep 2s
docker start cometa_django

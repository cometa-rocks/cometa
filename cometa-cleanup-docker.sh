#!/bin/bash

# Stop all running containers
echo "Stopping all running containers..."
docker stop $(docker ps -q) 2>/dev/null || true

# Remove all containers
echo "Removing all containers..."
docker rm $(docker ps -a -q) 2>/dev/null || true

# Remove all images
echo "Removing all images..."
docker rmi $(docker images -q) 2>/dev/null || true

# Remove all volumes
echo "Removing all volumes..."
docker volume rm $(docker volume ls -q) 2>/dev/null || true

# Prune unused networks
echo "Pruning unused networks..."
docker network prune -f 2>/dev/null || true

echo "Cleanup completed."

docker ps -a
docker images -q
docker volume ls -q
docker network ls



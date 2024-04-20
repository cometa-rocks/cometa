# Use the official Redis image from Docker Hub
FROM redis:7.2.0

# Set user root for installing packages and configuration
USER root

# Create a non-root user 'cometa' with UID and GID 472
RUN groupadd -g 472 cometa && \
    useradd -r -u 472 -g 472 -m cometa

# Create the directory for Redis data and set the owner to 'cometa'
RUN mkdir -p /data && \
    chown cometa:cometa /data

# Switch to user 'cometa' before running the server
USER cometa

# Set the working directory
WORKDIR /data

# Start Redis server with the configuration to use the 'dumy.rdb' file in the /data directory
CMD ["redis-server", "--dir", "/data", "--dbfilename", "dumy.rdb"]

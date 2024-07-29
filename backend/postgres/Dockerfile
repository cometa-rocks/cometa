# Use the official PostgreSQL 12.1 image from Docker Hub
FROM postgres:12.1

# Create a non-root user 'cometa' with UID and GID 472
# PostgreSQL image automatically creates a user `postgres`, here we add user `cometa`
RUN groupadd -g 472 cometa && \
    useradd -u 472 -g 472 -m cometa

# Change ownership of the PostgreSQL data directory
# This directory and its permissions are managed by the base PostgreSQL image,
# but we need to ensure it's owned by our custom user if we're changing from the default
RUN chown -R cometa:cometa /var/run/postgresql
RUN chown -R cometa:cometa /var/lib/postgresql/data

# Make sure all other necessary directories are accessible by the 'cometa' user
RUN chmod -R 755 /var/lib/postgresql/data
RUN chmod -R 755 /var/run/postgresql

# Run the server as the non-root user 'cometa'
USER cometa

# Set the default command to run when starting the container
CMD ["postgres"]

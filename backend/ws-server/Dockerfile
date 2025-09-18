# Use Node.js version 22 LTS as the base image
FROM node:22

# Create cometa user/group (uid/gid 1472) and set working directory
RUN groupadd -g 1472 cometa \
    && useradd -u 1472 -g cometa -m cometa -s /bin/bash
    
RUN npm install -g pm2

# Set the working directory inside the container
WORKDIR /home/cometa/app

# Ensure app directory owned by cometa
RUN chown -R cometa:cometa /home/cometa/app

# npm settings (project-local dir)
RUN mkdir -p npm \
    && touch ./npm/test \
    && chown -R cometa:cometa ./npm \
    && chmod -R 755 ./npm

# pm2 settings (keep same path but owned by cometa for compatibility)
RUN mkdir -p /.pm2/logs \
    && touch /.pm2/test \
    && chown -R cometa:cometa /.pm2 \
    && chmod -R 777 /.pm2

# Switch to non-root user
USER cometa

# Copy application files and package.json with proper ownership
COPY --chown=cometa:cometa ./app/ /home/cometa/app/app/
COPY --chown=cometa:cometa ./package.json /home/cometa/app/package.json

# Install dependencies
RUN npm install

# Permissions for dependencies directory
RUN chmod -R 755 /home/cometa/app/node_modules

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
CMD ["npm", "run", "server-start"]


# build image for arm and amd processors 
# docker buildx build --platform linux/amd64,linux/arm64 -t cometa/socket:latest --push .
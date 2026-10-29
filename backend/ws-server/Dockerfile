# Node.js 22.23.4 LTS — patched for the 21 Oct 2026 security release
# (CVE-2026-111497 Brotli RCE, CVE-2026-106069 TLS hostname bypass,
# CVE-2026-105482 dns.resolve NUL truncation). Floating `node:22` had
# resolved to 22.18.0 in cometa/socket:1.8.
# Slim image. The full node:22.23.4 image is about 1.6 GB before the app
# is added. The published cometa/socket tags are about 400 MB.
FROM node:22.23.4-slim

# The compose health check runs `curl`. The slim base does not include it.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# Create cometa user/group (uid/gid 1472) and set working directory
RUN groupadd -g 1472 cometa \
    && useradd -u 1472 -g cometa -m cometa -s /bin/bash
    
RUN npm install -g pm2 \
    && npm cache clean --force

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

# Install production dependencies in one layer so chmod does not
# copy node_modules a second time.
RUN npm install --omit=dev \
    && npm cache clean --force \
    && chmod -R 755 /home/cometa/app/node_modules

COPY --chown=cometa:cometa ./version.json /home/cometa/app/version.json

# Expose the port the app runs on
EXPOSE 3001

# Command to run the application
CMD ["npm", "run", "server-start"]


# build image for arm and amd processors 
# docker buildx build --platform linux/amd64,linux/arm64 -t cometa/socket:latest --push .
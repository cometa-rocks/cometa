# Stage 1: Build the Angular application
FROM node:14 AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . ./
RUN npx ng build -c production 

# Stage 2: Serve the application with Apache
FROM httpd:2.4.48

LABEL AUTHOR="COMETA ROCKS S.L."

SHELL ["/bin/bash", "-c"]

# Create a non-root user 'cometa'
RUN groupadd -g 472 cometa \
    && useradd -u 472 -g cometa -d /home/cometa -s /bin/bash cometa

# Create necessary directories and set ownership/permissions
RUN mkdir -p /code /screenshots /code/front /usr/local/apache2/conf \
    /usr/local/apache2/htdocs/infra /share/apache2/conf \
    && chown -R cometa:cometa /code /screenshots /usr/local/apache2 /share/apache2/conf \
    && chmod -R 755 /code /screenshots /usr/local/apache2 /share/apache2/conf

# Copy build artifacts and configuration files
COPY --from=build /app/dist/ /usr/local/apache2/htdocs
COPY --chown=cometa:cometa apache-conf/ /usr/local/apache2/conf/
COPY --chown=cometa:cometa apache-conf/mod_auth_openidc.so /usr/local/apache2/modules/
COPY --chown=cometa:cometa start_server.sh /code/front/start_server.sh

# Install dependencies for Apache modules and clean up
RUN apt-get update && apt-get install -y \
    pkg-config make gcc libssl-dev libjansson-dev libcurl4-openssl-dev \
    libpcre3-dev zlib1g-dev libcjose-dev libapache2-mod-security2 \
    && rm -rf /var/lib/apt/lists/*

# Set permissions and ownership for Apache logs
RUN touch /usr/local/apache2/logs/error_log /usr/local/apache2/logs/access.log \
    && chown -R www-data:www-data /usr/local/apache2/logs \
    && chmod -R 755 /usr/local/apache2/logs

# Ensure the start script is executable
RUN chmod +x /code/front/start_server.sh

USER cometa

EXPOSE 80 443

ENTRYPOINT ["/code/front/start_server.sh"]

# Command for multi-architecture build:
# docker buildx build --platform linux/amd64,linux/arm64 -t cometa/front:0.1.1 --push .

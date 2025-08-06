# Stage 1: Build the Angular application
FROM node:18 AS build

WORKDIR /app
RUN apt-get update 
COPY package*.json ./
# copy everything from the current directory to the app directory except the .git, node_modules,  folder
COPY . ./ 
RUN npm ci --legacy-peer-deps 
RUN npx ng build -c production 

# Stage 1: This stage to download the appium inspector and build the code to get html files
FROM node:20 AS appium_inspector_build

RUN apt-get install git
# Set the working directory inside the container
WORKDIR /app

# Clone git repository
RUN git clone https://github.com/AMVARA-CONSULTING/appium-inspector.git

WORKDIR /app/appium-inspector

# Install dependencies
RUN npm ci

# Build the Angular application
RUN npm run build:browser
RUN ls -la /app/appium-inspector
RUN ls -la /app/appium-inspector/dist-browser/
RUN ls -la /app/appium-inspector/dist-browser/locales/
RUN ls

# Stage 2: Serve the application with Apache
FROM httpd:2.4.64

LABEL AUTHOR="COMETA ROCKS S.L."

SHELL ["/bin/bash", "-c"]


# Create a non-root user 'cometa'
RUN groupadd -g 1472 cometa \
&& useradd -u 1472 -g cometa -d /home/cometa -s /bin/bash cometa

# Create necessary directories and set ownership/permissions
RUN mkdir -p /code /screenshots /code/front /usr/local/apache2/conf \
    /usr/local/apache2/htdocs/infra /share/apache2/conf \
    && chown -R cometa:cometa /code /screenshots /usr/local/apache2 /share/apache2/conf \
    && chmod -R 755 /code /screenshots /usr/local/apache2 /share/apache2/conf

# # Copy build artifacts and configuration files
# COPY --chown=cometa:cometa --from=build /app/dist/ /usr/local/apache2/htdocs 
# # COPY --chown=cometa:cometa apache-conf/ /usr/local/apache2/conf/
# COPY --chown=cometa:cometa apache-conf/mod_auth_openidc.so /usr/local/apache2/modules/
COPY --chown=cometa:cometa start_server.sh /code/front/start_server.sh

WORKDIR /code/front

# Copy the Angular build output to the Nginx HTML directory
COPY --chown=cometa:cometa --from=build /app/dist/ /usr/local/apache2/htdocs
# COPY --from=build --chown=cometa:cometa /app/dist/ /usr/local/apache2/htdocs 
COPY --chown=cometa:cometa ./apache2/conf/*.conf /usr/local/apache2/conf
COPY --chown=cometa:cometa ./apache2/metadata/* /code/front/apache2/metadata
COPY --chown=cometa:cometa ./apache2/modules /usr/local/apache2/modules

RUN mkdir -p /usr/local/apache2/htdocs/mobile/inspector
# Copy appium Inspector code from inspector build
COPY --chown=cometa:cometa --from=appium_inspector_build /app/appium-inspector/dist-browser/assets/* /usr/local/apache2/htdocs/assets
COPY --chown=cometa:cometa --from=appium_inspector_build /app/appium-inspector/dist-browser/locales/* /usr/local/apache2/htdocs/locales
COPY --chown=cometa:cometa --from=appium_inspector_build /app/appium-inspector/dist-browser/index.html /usr/local/apache2/htdocs/mobile/inspector/index.html

RUN apt-get update
# Install Apache and most dependencies
RUN apt-get install -y apache2 libapache2-mod-auth-openidc libcjose0 libjansson4 libcurl4 zlib1g
# Install libssl1.1 from Debian 11 for mod_auth_openidc compatibility
RUN apt-get install -y wget && \
    wget -q http://deb.debian.org/debian/pool/main/o/openssl/libssl1.1_1.1.1w-0+deb11u1_amd64.deb && \
    dpkg -i libssl1.1_1.1.1w-0+deb11u1_amd64.deb && \
    rm -f libssl1.1_1.1.1w-0+deb11u1_amd64.deb
RUN apt-get install -y libapache2-mod-security2 curl vim iputils-ping telnet

# Set permissions and ownership for Apache logs
RUN touch /usr/local/apache2/logs/error_log /usr/local/apache2/logs/access.log \
    && chown -R www-data:www-data /usr/local/apache2/logs \
    && chmod -R 755 /usr/local/apache2/logs

COPY --chown=cometa:cometa start_server.sh start_server.sh

RUN chown -R www-data:www-data /usr/local/apache2/logs
RUN chmod -R 777 /usr/local/apache2/logs

RUN touch /usr/local/apache2/logs/error_log
RUN touch /usr/local/apache2/logs/access.log

# # Ensure start.sh has execution permissions and run it
RUN chmod +x ./start_server.sh

USER cometa

EXPOSE 80 443

# Start Nginx server
ENTRYPOINT ["bash", "/code/front/start_server.sh"]


# Command for multi-architecture build:
# docker buildx build --platform linux/amd64,linux/arm64 -t cometa/front:0.1.1 --push .
# docker build -t cometa/front:3.0.6 --push .

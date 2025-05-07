# Stage 1: Build the Angular application
FROM node:14 AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci
COPY . ./
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

# Stage 2: Serve the application with Nginx
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
COPY --chown=cometa:cometa --from=build /app/dist/ /usr/local/apache2/htdocs
COPY --chown=cometa:cometa apache-conf/ /usr/local/apache2/conf/
COPY --chown=cometa:cometa apache-conf/mod_auth_openidc.so /usr/local/apache2/modules/
COPY --chown=cometa:cometa start_server.sh /code/front/start_server.sh

WORKDIR /code/front

# Copy the Angular build output to the Nginx HTML directory
COPY --from=build /app/dist/ /usr/local/apache2/htdocs

RUN mkdir -p /usr/local/apache2/htdocs/mobile/inspector
# Copy appium Inspector code from inspector build
COPY --chown=cometa:cometa --from=appium_inspector_build /app/appium-inspector/dist-browser/assets/* /usr/local/apache2/htdocs/assets
COPY --chown=cometa:cometa --from=appium_inspector_build /app/appium-inspector/dist-browser/locales/* /usr/local/apache2/htdocs/locales
COPY --chown=cometa:cometa --from=appium_inspector_build /app/appium-inspector/dist-browser/index.html /usr/local/apache2/htdocs/mobile/inspector/index.html

RUN apt-get update
RUN apt-get install -y pkg-config make gcc gdb lcov valgrind vim curl iputils-ping wget telnet
RUN apt-get install -y autoconf automake libtool
RUN apt-get install -y libssl-dev libjansson-dev libcurl4-openssl-dev check
RUN apt-get install -y libpcre3-dev zlib1g-dev libcjose0 libcjose-dev
RUN apt-get install -y libapache2-mod-security2

# Set permissions and ownership for Apache logs
RUN touch /usr/local/apache2/logs/error_log /usr/local/apache2/logs/access.log \
    && chown -R www-data:www-data /usr/local/apache2/logs \
    && chmod -R 755 /usr/local/apache2/logs


COPY start_server.sh start_server.sh

RUN chown -R www-data:www-data /usr/local/apache2/logs
RUN chmod -R 777 /usr/local/apache2/logs

RUN touch /usr/local/apache2/logs/error_log
RUN touch /usr/local/apache2/logs/access.log

# # Ensure start.sh has execution permissions and run it
RUN chmod +x ./start_server.sh
# Expose port 80
EXPOSE 80

USER cometa

EXPOSE 80 443

# Start Nginx server
ENTRYPOINT ["start_server.sh"]




# Command for multi-architecture build:
# docker buildx build --platform linux/amd64,linux/arm64 -t cometa/front:0.1.1 --push .
# docker build -t cometa/front:3.0.6 --push .

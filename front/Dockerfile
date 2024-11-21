# Stage 1: Build the Angular application
FROM node:14 AS build

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json to the working directory
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the Angular application
RUN npx ng build -c production 



# Stage 1: This stage to download the appium inspector and build the code to get html files
FROM node:20 AS appium_inspector_build

RUN apt install git
# Set the working directory inside the container
WORKDIR /app

# Clone git repository
RUN git clone https://github.com/AMVARA-CONSULTING/appium-inspector.git

WORKDIR /app/appium-inspector

# Install dependencies
RUN npm i

# Build the Angular application
RUN npm run build:browser
RUN ls -la /app/appium-inspector
RUN ls -la /app/appium-inspector/dist-browser/
RUN ls -la /app/appium-inspector/dist-browser/locales/
RUN ls

# Stage 2: Serve the application with Nginx
FROM httpd:2.4.48

WORKDIR /code/front
# Copy the Angular build output to the Nginx HTML directory
COPY --from=build /app/dist/ /usr/local/apache2/htdocs

RUN mkdir -p /usr/local/apache2/htdocs/mobile/inspector
# Copy appium Inspector code from inspector build
COPY --from=appium_inspector_build /app/appium-inspector/dist-browser/assets/* /usr/local/apache2/htdocs/assets
COPY --from=appium_inspector_build /app/appium-inspector/dist-browser/locales/* /usr/local/apache2/htdocs/locales
COPY --from=appium_inspector_build /app/appium-inspector/dist-browser/index.html /usr/local/apache2/htdocs/mobile/inspector/index.html

RUN apt-get update
RUN apt-get install -y pkg-config make gcc gdb lcov valgrind vim curl iputils-ping wget
RUN apt-get install -y autoconf automake libtool
RUN apt-get install -y libssl-dev libjansson-dev libcurl4-openssl-dev check
RUN apt-get install -y libpcre3-dev zlib1g-dev libcjose0 libcjose-dev
RUN apt-get install -y libapache2-mod-security2

COPY start_server.sh start_server.sh

RUN chown -R www-data:www-data /usr/local/apache2/logs
RUN chmod -R 755 /usr/local/apache2/logs

RUN touch /usr/local/apache2/logs/error_log
RUN touch /usr/local/apache2/logs/access.log

# # Ensure start.sh has execution permissions and run it
RUN chmod +x ./start_server.sh
# Expose port 80
EXPOSE 80
# Start Nginx server
ENTRYPOINT ["start_server.sh"]
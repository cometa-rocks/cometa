FROM node:20.10.0-slim as cometa_front_compiler

# set maintainers
LABEL org.opencontainers.image.author1="Arslan Sohail <hello.arslan@amvara.de>"
LABEL org.opencontainers.image.author2="AMVARA CONSULTING S.L. <tec_dev@amvara.de>"

WORKDIR /home/cometa/front
COPY . /home/cometa/front

# install all the packages
RUN npm ci

# compile the front
RUN npx ng build -c production

# initialize base httpd image
FROM httpd:2.4.48 as production

# set maintainers
LABEL org.opencontainers.image.author1="Arslan Sohail <hello.arslan@amvara.de>"
LABEL org.opencontainers.image.author2="AMVARA CONSULTING S.L. <tec_dev@amvara.de>"

# install libraries for mod_auth_openidc
RUN apt update
RUN apt install -y libcjose0 \
    libcjose-dev \
    libssl-dev \
    libjansson-dev \
    libcurl4-openssl-dev \
    openssl \
    wget

# copy the dist folder from the compiler stage
COPY --from=cometa_front_compiler /home/cometa/front/dist /usr/local/apache2/htdocs

# copy the compiled mod_auth_openidc module
# FIXME:
# Create another stage to compile the mod_auth_openidc
# so we have the latest version with security updates
COPY --from=cometa_front_compiler \
    /home/cometa/front/apache-conf/mod_auth_openidc.so \
    /usr/local/apache2/modules/mod_auth_openidc.so

# generate self-signed certificate
RUN openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 -keyout /etc/ssl/certs/apache-self-signed.key \
    -out /etc/ssl/certs/apache-self-signed.crt \
    -subj "/C=/ST=/L=/O=/OU=/CN="

# configure Health Check for the container
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD wget --no-verbose --tries=1 --spider --no-check-certificate \
    https://localhost/welcome.html || exit 1

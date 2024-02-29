# initialize base httpd image
FROM httpd:2.4.48

# author of the image
LABEL AUTHOR="COMETA ROCKS S.L."

# set a default shell
SHELL ["/bin/bash", "-c"]

# make a /code directory that will save all the git repo data
RUN mkdir /code

# COPY repository code to /code
COPY . /code

# set workdir to /code for compiling purposes
WORKDIR /code

# copy apache configuration files
COPY apache-conf/httpd.conf /usr/local/apache2/conf/httpd.conf
COPY apache-conf/openidc.conf_basic /usr/local/apache2/conf/openidc.conf
COPY apache-conf/paths.conf /usr/local/apache2/conf/paths.conf
COPY apache-conf/mod_auth_openidc.so /usr/local/apache2/modules/mod_auth_openidc.so

# make sure start.sh has execution permissions
RUN chmod +x /code/front/start.sh

# run /code/front/start.sh script to install everything we need
RUN /code/front/start.sh openidc basic angular compile no-restart

# finally set workdir to httpd htdocs
WORKDIR /usr/local/apache2

# remove /code directory
RUN rm -r /code

# expose necessary ports
EXPOSE 80
EXPOSE 443

# generate self-signed certificate
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/apache-selfsigned.key -out /etc/ssl/certs/apache-selfsigned.crt -subj "/C=/ST=/L=/O=/OU=/CN="

# tail a logfile as ENTRYPOINT
CMD ["httpd-foreground"]

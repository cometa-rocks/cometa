# Use the specified Apache HTTPD image
FROM httpd:2.4.48

# Label the image
LABEL AUTHOR="COMETA ROCKS S.L."

# Set a default shell
SHELL ["/bin/bash", "-c"]

# Create a non-root user 'cometa' with specified UID and GID
RUN groupadd -g 472 cometa 
RUN useradd -u 472 -g cometa -d /home/cometa -s /bin/bash cometa  

# Create necessary directories with appropriate ownership and permissions
RUN mkdir /code 
RUN mkdir -p /code/front
RUN mkdir -p /screenshots
RUN mkdir -p /usr/local/apache2/conf 
RUN mkdir -p /usr/local/apache2/htdocs
RUN mkdir -p /usr/local/apache2/htdocs/infra 

RUN chown -R cometa:cometa /code
RUN chmod -R 755 /code
RUN chown -R cometa:cometa /screenshots
RUN chmod -R 755 /screenshots
RUN chown -R cometa:cometa /code/front
RUN chmod -R 755 /code/front
RUN chown -R cometa:cometa /usr/local/apache2 
RUN chmod -R 755 /usr/local/apache2

# Set correct permissions for other directories used by the script
RUN chown -R cometa:cometa /usr/local/apache2/htdocs
RUN chmod -R 755 /usr/local/apache2/htdocs 
RUN chown -R cometa:cometa /usr/local/apache2/conf
RUN chmod -R 755 /usr/local/apache2/conf

# Copy repository code and configuration files
COPY --chown=cometa:cometa . /code/front

# Set working directory to /code for compiling purposes
WORKDIR /code/front

USER root
# # Ensure start.sh has execution permissions and run it
RUN chmod +x ./start_pod.sh
RUN ./start_pod.sh openidc basic angular no-restart

COPY --chown=cometa:cometa . /code/front
COPY --chown=cometa:cometa apache-conf/httpd.conf /usr/local/apache2/conf/httpd.conf
COPY --chown=cometa:cometa apache-conf/openidc.conf_local /usr/local/apache2/conf/openidc.conf
COPY --chown=cometa:cometa apache-conf/paths.conf /usr/local/apache2/conf/paths.conf
COPY --chown=cometa:cometa apache-conf/mod_auth_openidc.so /usr/local/apache2/modules/mod_auth_openidc.so


RUN ./start_pod.sh compile no-restart
# Set working directory to Apache's default htdocs directory
WORKDIR /usr/local/apache2/htdocs

# Clean up the /code directory
RUN chown -R cometa:cometa /etc/ssl
RUN chmod -R 755 /usr/local/apache2/conf

# Delete everything from /code dir
RUN rm -r /code

# Copy few required file
COPY --chown=cometa:cometa ./apache-conf/metadata /code/front/apache-conf/metadata
COPY --chown=cometa:cometa ./start_pod.sh /code/front/start_pod.sh
RUN chmod +x /code/front/start_pod.sh 

USER cometa

# Expose necessary ports
EXPOSE 80
EXPOSE 443

# Generate self-signed certificate
RUN openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /etc/ssl/private/apache-selfsigned.key -out /etc/ssl/certs/apache-selfsigned.crt -subj "/C=US/ST=CA/L=SF/O=CometaRocks/OU=IT/CN=example.com"

# Run Apache in the foreground
CMD ["/code/front/start_pod.sh"]

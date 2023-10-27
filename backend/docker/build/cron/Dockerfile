# start from a base image of BusyBox
FROM alpine:3.15.0

# install basic packages needed
RUN apk add curl jq

# make /code folder
RUN mkdir /code/

# copy basic configuration files inside the container
COPY ./persistent_crontab_configuration /code/.
COPY ./update_crontab.sh /code/.
COPY ./entrypoint.sh /code/.

# create a starting root user crontab
RUN cp /code/persistent_crontab_configuration /var/spool/cron/crontabs/root

# start crond
ENTRYPOINT ["/code/entrypoint.sh"]
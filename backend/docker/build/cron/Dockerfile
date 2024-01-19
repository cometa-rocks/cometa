# start from a base image of BusyBox
FROM alpine:3.15.0

# install basic packages needed
RUN apk update && apk add curl jq

# set the workdir for the project
WORKDIR /home/amvara/crontab/

# copy basic configuration files inside the container
COPY ./persistent_crontab_configuration .
COPY ./update_crontab.sh .
COPY ./entrypoint.sh .

# create a starting root user crontab
RUN cp persistent_crontab_configuration /var/spool/cron/crontabs/root

# start crond
ENTRYPOINT ["/home/amvara/crontab/entrypoint.sh"]

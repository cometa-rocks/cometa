#!/bin/bash

# CHANGELOG
# 2023-01-30 - RRO - adding vacuum full before backup to reclaim tablespace
# 2022-04-12 - RRO - Copied create_backup.sh to cometa repo, so it's not flying around.
# 2021.03.23 - ASO - Added /Cometa mountpoint to /etc/fstab so script does not have to.

# Save date and time
DATE=$(date '+%Y%m%d%H%M%S')
TIMESTAMP=$(date '+%s')
BACKUPDIR=/backups
TMPFILE=$(mktemp)
# final file name
BKPFILENAME=cometa_backup_${DATE}_${TIMESTAMP}.gz
# database container name
CONTAINERNAME=cometa_postgres
# command to execute on the container
COMMAND="pg_dump postgres -U postgres | gzip > /code/${BKPFILENAME}"

# cometa backend folder depending on hostname
HOSTNAME=$(hostname)
BACKEND=/var/www/cometa/backend
NO_OF_FILES_TO_KEEP_IN_BACKUP=30
case $HOSTNAME in
        amvara3)
                BACKEND=/home/amvara/projects/cometa/backend
                BACKUPDIR=/data/backups
                NO_OF_FILES_TO_KEEP_IN_BACKUP=60
                ;;
        amvara2)
                BACKEND=/home/amvara/projects/cometa/cometa/backend
                BACKUPDIR=/data/backups
                NO_OF_FILES_TO_KEEP_IN_BACKUP=60
                ;;
        sgdem0005126)
                BACKEND=/var/www/cometa/backend
                ;;
        sgdem0005125)
                BACKEND=/var/www/cometa/backend
                ;;
        development)
                BACKEND=/home/amvara/projects/public/cometa/backend
                BACKUPDIR=/home/amvara/projects/public/cometa_bkps
                ;;
esac

# automate a bit failed behaviour
function failed() {
        log_res "[failed]"
        error "More details about the error:"
        cat ${TMPFILE}
        exit ${1:-255}
}

# do some cleanup like remove the tmp file
function cleanup() {
        log_wfr "Removing tmp file "
        rm ${TMPFILE} && log_res "[done]" || log_res "[failed]"
}

# create a trap to execute cleanup whenever script exists.
trap cleanup EXIT

# import logger
test `command -v log_wfr` || source ${BACKEND}/../helpers/logger.sh

# print some valuable information
debug "Here are the variables used:"
debug "BACKEND                       => ${BACKEND}"
debug "BACKUPDIR                     => ${BACKUPDIR}"
debug "BKPFILENAME                   => ${BKPFILENAME}"
debug "COMMAND                       => ${COMMAND}"
debug "CONTAINERNAME                 => ${CONTAINERNAME}"
debug "DATE                          => ${DATE}"
debug "HOSTNAME                      => ${HOSTNAME}"
debug "NO OF FILES TO KEEP IN BACKUP => ${NO_OF_FILES_TO_KEEP_IN_BACKUP}"
debug "TMPFILE                       => ${TMPFILE}"
debug "TIMESTAMP                     => ${TIMESTAMP}"

# create the backup file not already exists
log_wfr "Making sure ${BACKUPDIR} exists "
mkdir -p $BACKUPDIR 2>&1 >${TMPFILE} && log_res "[done]" || failed 5

# make sure that the db_data folder has correct permissions
log_wfr "Making sure that the db_data folder has correct permissions "
chown -R 999:root ${BACKEND}/db_data 2>&1 >${TMPFILE} && log_res "[done]" || failed 10

# clear django sessions table
log_wfr "Clearing Django Sessions "
docker exec -it cometa_django bash -c "python manage.py clearsessions" 2>&1 >${TMPFILE} && log_res "[done]" || failed 15

# Vacuum the database ... carefull this creates tables locks
log_wfr "Recovering space after clearing django sessions "
docker exec -it cometa_postgres bash -c "psql -U postgres postgres --command \"vacuum full\"" 2>&1 >${TMPFILE} && log_res "[done]" || failed 20

# check if postgres container is running and create the backup
log_wfr "Creating the backup file "
# create the zip file named cometa_backup_ and the date for easy knowing of the recent file as well as timestamp in case we need to do some cleaning.
docker exec ${CONTAINERNAME} bash -c "${COMMAND}" 2>&1 >${TMPFILE} && log_res "[done]" || failed 25
log_wfr "Move the backup file to the backups dir "
mv ${BACKEND}/${BKPFILENAME} $BACKUPDIR 2>&1 >${TMPFILE} && log_res "[done]" || failed 30

# for more information checkout https://www.postgresql.org/docs/9.1/backup-dump.html on how to create a backup and how to restore.

# remove older backups
log_wfr "Cleaning up old backups "
/usr/bin/find $BACKUPDIR/ -type f -mtime +$NO_OF_FILES_TO_KEEP_IN_BACKUP -name '*.gz' -print -delete 2>&1 >${TMPFILE} && log_res "[done]" || failed 35
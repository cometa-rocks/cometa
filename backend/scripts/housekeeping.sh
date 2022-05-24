#!/bin/bash

# CHANGELOG
# 2022-05-11 - ASO - changed echo to eval and getLatestBrowsers to deploy_selenoid otherwise json would throw error.
# 2022-05-09 - RRO - adding get ./getLatestBrowsers.sh to automatically update 
# 2022-04-12 - RRO - Copied create_backup.sh to cometa repo, so it's not flying around.
# 2021.03.23 - ASO - Added /Cometa mountpoint to /etc/fstab so script does not have to.

# Save date and time
DATE=$(date '+%Y%m%d%H%M%S')
TIMESTAMP=$(date '+%s')
DIFFERENCE=2628000 # 1 month in seconds
BACKUPDIR=/data/backups

# move to the Cometa/database folder
mkdir -p $BACKUPDIR && echo Created $BACKUPDIR Directory || echo $BACKUPDIR dir is there already ... good
cd $BACKUPDIR
# cometa backend folder depending on hostname
HOSTNAME=$(hostname)
BACKEND=/var/www/cometa/backend
NO_OF_FILES_TO_KEEP_IN_BACKUP=30
case $HOSTNAME in
        amvara3)
                BACKEND=/home/amvara/projects/cometa/backend
                NO_OF_FILES_TO_KEEP_IN_BACKUP=60
                ;;
        amvara2)
                BACKEND=/home/amvara/projects/cometa/cometa/backend
                NO_OF_FILES_TO_KEEP_IN_BACKUP=60
                ;;
        sgdem0005126)
                BACKEND=/var/www/cometa/backend
                ;;
        sgdem0005125)
                BACKEND=/var/www/cometa/backend
                ;;
esac
echo Backend lives here: $BACKEND

# make sure that the db_data folder has correct permissions
echo -ne "Making sure that the db_data folder has correct permissions... "
chown -R 999:root ${BACKEND}/db_data && echo "done" || echo "failed"

# final file name
FILENAME=cometa_backup_${DATE}_${TIMESTAMP}.gz
# database container name
CONTAINERNAME=cometa_postgres
# command to execute on the container
COMMAND="pg_dump postgres -U postgres | gzip > /code/${FILENAME}"
# check if postgres container is running and create the backup
echo -ne "Creating the zip file... "
# create the zip file named cometa_backup_ and the date for easy knowing of the recent file as well as timestamp in case we need to do some cleaning.
docker ps --format "{{.Names}}" | grep -q ${CONTAINERNAME} && ( docker exec ${CONTAINERNAME} bash -c "${COMMAND}" && mv ${BACKEND}/${FILENAME} $BACKUPDIR ) || { echo -ne "failed\n${CONTAINERNAME} is not running maybe... unable to find it using docker ps\n" && exit 2; }
echo "done"

# for more information checkout https://www.postgresql.org/docs/9.1/backup-dump.html on how to create a backup and how to restore.

function cleanup {
        for backup in $(ls $BACKUPDIR); do # loop over files in /Cometa/database
                BACKUPTIMESTAMP=${backup//.zip/} # remove .zip from the filename
                BACKUPTIMESTAMP=(${BACKUPTIMESTAMP//_/ }) # create a array spliting the filename from _
                BACKUPTIMESTAMP=${BACKUPTIMESTAMP[2]} # get the timestamp variable from the filename
                DIFF=$(($TIMESTAMP-$BACKUPTIMESTAMP)) # get the difference between the file backup timestamp and current timestamp
                if [[ "$DIFF" -gt "$DIFFERENCE"  ]]; # if its greater than the DIFFERENCE variable do
                then
                        echo "Removing $backup backup file since it's more than $DIFFERENCE seconds old..."
                        rm $backup # remove backup file
                fi
        done
}

# Worked with older timestamps need fixing with new ones.
# cleanup
echo "Cleaning Backup directory"
CMD="/usr/bin/find $BACKUPDIR/ -type f -mtime +$NO_OF_FILES_TO_KEEP_IN_BACKUP -name '*.gz' -print -delete"
echo $CMD
$($CMD) && echo done || echo failed

#/usr/bin/find $BACKUPDIR/ -type f -mtime +$NO_OF_FILES_TO_KEEP_IN_BACKUP -name "*.gz" -print

#
# get latests browsers
#
echo "Checking latest browser information"
CMD="cd ${BACKEND}/selenoid; ./deploy_selenoid.sh -n 10"
echo ${CMD}
eval ${CMD} && echo "-- done --" || echo "-- failed --"
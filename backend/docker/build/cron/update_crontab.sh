#!/bin/sh

function getSchedules() {
    SERVER_URL=${DJANGO_SERVER_URL:-django}
    SERVER_PORT=${DJANGO_SERVER_PORT:-8000}
    TMPFILE=$(mktemp)
    STATUS_CODE=$(curl  --silent --output ${TMPFILE} --write-out "%{http_code}" http://${SERVER_URL}:${SERVER_PORT}/api/schedule/)
    if [[ ${STATUS_CODE} != 200 ]]; then
        >&2 cat ${TMPFILE}
        return 10
    fi

    ( cat /home/amvara/crontab/persistent_crontab_configuration; cat ${TMPFILE} | jq -r ".schedules|.[]" ) | crontab -

    rm ${TMPFILE}
}

getSchedules

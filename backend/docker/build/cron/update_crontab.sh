#!/bin/sh

function getSchedules() {
    DJANGO_SERVER_URL=${SERVER_URL:-django}
    DJANGO_SERVER_PORT=${SERVER_URL:-8000}
    TMPFILE=$(mktemp)
    STATUS_CODE=$(curl  --silent --output ${TMPFILE} --write-out "%{http_code}" http://${DJANGO_SERVER_URL}:${DJANGO_SERVER_PORT}/api/schedule/)
    if [[ ${STATUS_CODE} != 200 ]]; then
        >&2 cat ${TMPFILE}
        return 10
    fi

    ( cat /home/amvara/crontab/persistent_crontab_configuration; cat ${TMPFILE} | jq -r ".schedules|.[]" ) | crontab -

    rm ${TMPFILE}
}

getSchedules

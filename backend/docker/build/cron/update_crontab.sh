#!/bin/sh

function getSchedules() {
    SERVER_URL=${DJANGO_SERVER_URL:-django}
    SERVER_PORT=${DJANGO_SERVER_PORT:-8000}
    TMPFILE=$(mktemp)
    # STATUS_CODE=$(curl -x ""  --silent --output ${TMPFILE} --write-out "%{http_code}" http://${SERVER_URL}:${SERVER_PORT}/api/schedule/)
    STATUS_CODE=$(curl -x "" --output ${TMPFILE} --write-out "%{http_code}" http://${SERVER_URL}:${SERVER_PORT}/api/schedule/)
    if [[ ${STATUS_CODE} != 200 ]]; then
        >&2 cat ${TMPFILE}
        return 10
    fi

    ( cat /home/cometa/crontab/persistent_crontab_configuration; cat ${TMPFILE} | jq -r ".schedules|.[]" ) | crontab -

    rm ${TMPFILE}
}

getSchedules

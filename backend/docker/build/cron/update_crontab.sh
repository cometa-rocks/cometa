#!/bin/sh

function getSchedules() {
    TMPFILE=$(mktemp)
    STATUS_CODE=$(curl  --silent --output ${TMPFILE} --write-out "%{http_code}" http://django:8000/api/schedule/)
    if [[ ${STATUS_CODE} != 200 ]]; then
        >&2 cat ${TMPFILE}
        return 10
    fi

    ( cat /code/persistent_crontab_configuration; cat ${TMPFILE} | jq -r ".schedules|.[]" ) | crontab -

    rm ${TMPFILE}
}

getSchedules
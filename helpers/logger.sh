# LOGLVL
# 10 = DEBUG
# 20 = INFO
# 30 = WARNING
# 40 = ERROR
# 50 = CRITICAL

# get loglvl number to string
function getLogLvlString() {
    # return result
    LOGLVL="INFO"
    # create a switch case
    case ${1} in
        10)
            LOGLVL="DEBUG"
            ;;
        20)
            LOGLVL="INFO"
            ;;
        30)
            LOGLVL="WARNING"
            ;;
        40)
            LOGLVL="ERROR"
            ;;
        50)
            LOGLVL="CRITICAL"
            ;;
        *)
            LOGLVL="INFO"
            ;;
    esac
    
    echo ${LOGLVL}            
}

# Log function
function logger() {
    # generate date
    DATE=`date +"%Y-%m-%dT%H:%M:%S"`
    # get log lvl or default to info
    LOGLVL=${2:-20}

    # use `export PRINTLOGLVL=<LOGLVL>` to print more or less.
    # check if LOGLVL is in PRINTLOGLVL
    if [ "${LOGLVL}" -ge "${PRINTLOGLVL:-20}" ]; then
        # get log lvl string
        LOGLVLSTR=`getLogLvlString ${LOGLVL}`
        # get filename
        FILENAME=`basename ${0}`
        # generate output string
        OUTPUT="[${DATE}][${LOGLVLSTR}][${FILENAME}:${BASH_LINENO[1]}] - ${1}"

        # print out output
        set -f # turn off glob expansion
        echo -ne ${OUTPUT}
        test "${3}" != "wfr" && echo -ne "\n"
        set +f # turn on glob expansion
    fi
}

# debug log
function debug() {
    # send arguments
    logger "${1}" 10
}
# info log
function info() {
    # send arguments
    logger "${1}" 20
}
# warning log
function warning() {
    # send arguments
    logger "${1}" 30
}
# error log
function error() {
    # send arguments
    logger "${1}" 40
}
# critical log
function critical() {
    # send arguments
    logger "${1}" 50
}

# log out result
function log_res() {
    echo " -> ${1}"
}

# log wait for result
function log_wfr() {
    logger "${1}" 20 "wfr"
}
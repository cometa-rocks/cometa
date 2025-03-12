#!/bin/bash

# #######
# This is the backend entrypoint, which starts the DJANGO Server
# #######
# 
# As deault it will start gunicorn service compiling django, which is the fastest way and saves a lot of resources.
# Only using gunicorn, you will be able to serve hundreds of users and executions on a small server setup.
#
# For development it is recommended to use the python django compiling on each change, so that you can change, see, tests and debug.
# The Django server will be invoked using the parameter "-dev" on this script
#
# #######

# set default to prod ... can be overwritten here or with commandline setting or environment variable ENVIRONMENT
# prod executes gunicorn
# dev executes ptyhon manage.py runserver
ENVIRONMENT=${ENVIRONMENT:-prod}

while [[ $# -gt 0 ]]
do
        key="$1"
        case $key in
                -d|--debug)
                        set -x
                        DEBUG=TRUE
                        shift
                        ;;
                -dev|--development)
                        echo "###################################################"
                        echo "==> Setting development option requested from cli  "
                        echo "###################################################"
                        ENVIRONMENT="dev"
                        shift
                        ;;
        esac
done

# Make sure log folder exists
mkdir -p /opt/code/logs || true

crontab /etc/cron.d/crontab
cron
service rsyslog start
# freshclam
# FIXME clmave service
# service clamav-daemon start 

# Source the common script
source "$(dirname "$0")/start_common.sh"

echo "Initialization complete!"



echo "clamav started."

# update clamav database and start clamav in daemon mode
echo "0" > /tmp/clam_started && freshclam && service clamav-daemon start && echo "1" > /tmp/clam_started

#
# in DEVMODE Start Django server
#
echo "ENVIRONMENT: $ENVIRONMENT"
if [ "$ENVIRONMENT" = "dev" ]; then
    echo "###################################################"
    echo "# Running in DEV mode                             #"
    echo "###################################################"
    echo "Devmode was requested ... starting python manage.py runserver"
    python manage.py runserver 0.0.0.0:8000
fi

#
# In Production mode start gunicorn
#
if [ "$ENVIRONMENT" != "dev" ]; then
    # get processor cores
    CPUCORES=`getconf _NPROCESSORS_ONLN`
    # calculate workers
    # GUNI_WORKERS=$((($CPUCORES*2+1)))
    GUNI_WORKERS=$((($CPUCORES+1)))

    # spin up gunicorn
    echo "########################################################"
    echo "# Running in production mode - starting gunicorn       #"
    echo "# to enable dev mode, use parameter '-dev' on start.sh #"
    echo "########################################################"
    gunicorn \
        cometa_pj.wsgi:application \
        --workers=${WORKERS:-$GUNI_WORKERS} \
        --threads=${THREADS:-2} \
        --worker-class=gthread \
        --bind 0.0.0.0:8000 \
        --access-logfile=- \
        --access-logformat='%(t)s %({proxy-user}i)s %({x-forwarded-for}i)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s"'
fi

echo "###################################################"
echo "# Parsing Actions.....                            #"
echo "###################################################"

curl --fail http://localhost:8000/parseActions/
echo "Devmode was requested ... starting python manage.py runserver"

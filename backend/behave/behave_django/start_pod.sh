#!/bin/bash
ENVIRONMENT=${ENVIRONMENT:-prod}

while [[ $# -gt 0 ]]
do
        key="$1"
        case $key in
                -d|--debug)
                        set -x
                        DEBUG=TRUE
                        ENVIRONMENT="debug"
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
# service rsyslog start
# Run Django migrations
# python manage.py makemigrations
# python manage.py migrate

echo "Migration done"

# get processor cores
CPUCORES=`getconf _NPROCESSORS_ONLN`
# calculate workers
# GUNI_WORKERS=$((($CPUCORES*2+1)))

GUNI_WORKERS=$((($CPUCORES+1)))

# prevents $CPUCORES to be set to <=0, which causes failure during test execution on Cometa due to non existant CPU cores.
if [ $CPUCORES -le 2 ]; then
    REDIS_WORKERS=$((($CPUCORES)))
else
    REDIS_WORKERS=$((($CPUCORES-2)))
fi

# configure django-rq service in supervisor / redis - number of workers equals number of CPUs - #4236
# limit number of procs to Cores - 2
cat <<EOF > /etc/supervisor/conf.d/django-rq.conf
[program:django-rq]
environment=PYTHONUNBUFFERED=1
process_name=%(program_name)s-%(process_num)s
command=python manage.py rqworker default
numprocs=$REDIS_WORKERS
directory=/opt/code/behave_django
stopsignal=TERM
autostart=true
autorestart=true
stdout_logfile=/proc/1/fd/1
stdout_logfile_maxbytes=0
stderr_logfile=/proc/1/fd/1
stderr_logfile_maxbytes=0
EOF

echo "Starting supervisord"
# start supervisord to spin django-rq workers.
supervisord -c /etc/supervisor/supervisord.conf

echo "Started supervisord"
#
# in DEVMODE Start Django server
#
echo "ENVIRONMENT: $ENVIRONMENT"
if [ "$ENVIRONMENT" = "dev" ]; then
    echo "###################################################"
    echo "# Running in DEV mode                             #"
    echo "###################################################"
    echo "Devmode was requested ... starting python manage.py runserver"
    python manage.py runserver 0.0.0.0:8001
fi
#cd
#  Run in VSCode IDE debug mode 
#
if [ "$ENVIRONMENT" = "debug" ]; then
    echo "###################################################"
    echo "# Running in Debug mode                             #"
    echo "###################################################"
    echo "debug mode was requested, you need to start django using \"python manage.py runserver\""
    echo "Refer backend/src/README.md run django debug mode in VSCODE IDE"
    sleep infinity
fi

#
# In Production mode start gunicorn
#
if [ "$ENVIRONMENT" != "dev" ]; then    
    # spin up gunicorn
    gunicorn behave_django.wsgi:application --workers=2 --threads=${THREADS:-2} --worker-class=gthread --bind 0.0.0.0:8001 --preload
fi

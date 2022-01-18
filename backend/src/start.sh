#!/bin/bash

install_cron() {
    apt install -y cron
    touch /etc/cron.d/crontab
    chmod 0744 /etc/cron.d/crontab
    crontab /etc/cron.d/crontab
    cron
}

create_secret_variables() {
    # make sure secret_variables.py file exists
    if [ ! -f "/code/secret_variables.py" ]; then
        echo "Unable to find secret_variables.py will make one..."
        # make a random encryption passphrase
        RANDOM_ENCRYPTION_PASSPHRASE=$(openssl rand -base64 46)
        # make a random secret key for django
        RANDOM_DJANGO_SECRETKEY=$(openssl rand -base64 31)
        # generate a bare minimum secret_variables file to work with
        cat <<EOF > /code/secret_variables.py
COMETA_STRIPE_CHARGE_AUTOMATICALLY='False'
COMETA_BROWSERSTACK_PASSWORD=''
COMETA_SENTRY_BEHAVE=''
COMETA_DOMAIN=''
COMETA_ENCRYPTION_START='U2FsdGVkX1'
COMETA_BROWSERSTACK_USERNAME=''
COMETA_STRIPE_TEST_KEY=''
COMETA_DEBUG='True'
COMETA_FEEDBACK_MAIL='cometa@amvara.de'
COMETA_SENTRY_DJANGO=''
COMETA_STRIPE_LIVE_KEY=''
COMETA_PROD_ENABLE_PAYMENT='False'
COMETA_ENCRYPTION_PASSPHRASE='$RANDOM_ENCRYPTION_PASSPHRASE'
COMETA_STRIPE_TEST_WEBHOOK_SECRET=''
COMETA_STAGE_ENABLE_PAYMENT='False'
COMETA_DJANGO_SECRETKEY='$RANDOM_DJANGO_SECRETKEY'
COMETA_STRIPE_LIVE_WEBHOOK_SECRET=''
COMETA_SCREENSHOT_PREFIX='AMVARA_'
COMETA_EMAIL_ENABLED='False'
COMETA_EMAIL_HOST=''
COMETA_EMAIL_USER=''
COMETA_EMAIL_PASSWORD=''
COMETA_PROXY_ENABLED='False'
COMETA_PROXY=''
COMETA_S3_ENABLED=False
COMETA_S3_ENDPOINT=''
COMETA_S3_BUCKETNAME=''
EOF
    else
        echo "secret_variables.py file exists."
    fi
}

# Make sure log folder exists
mkdir -p /opt/code/logs || true
# Install requirements
apt update && apt install -y rsyslog jq nano vim
service rsyslog start
# Install cron
install_cron
# check and create secret_variables.py
create_secret_variables
# Install poetry package manager
curl -sSL https://raw.githubusercontent.com/python-poetry/poetry/master/get-poetry.py | python -
# Create symbolic link to Poetry so it's available as command everywhere
if [ ! -L "/usr/local/bin/poetry" ]; then
    ln -s /root/.poetry/bin/poetry /usr/local/bin/poetry
fi
# Disable creation of virtual env
poetry config virtualenvs.create false
# Install project dependencies
poetry install --no-interaction --no-ansi
# Upgrade PIP
pip install -U pip
# Run Django migrations
python manage.py makemigrations backend
python manage.py migrate

# if this is the first time initializing co.meta
# import basic data
if [ ! -f "/code/.initiated" ]; then
    find defaults -name "*.json" | sort | xargs -I{} python manage.py loaddata {}
    touch /code/.initiated
fi

# Start Django server
# python manage.py runserver 0.0.0.0:8000

# get processor cores
CPUCORES=`getconf _NPROCESSORS_ONLN`
# calculate workers
GUNI_WORKERS=$((($CPUCORES*2+1)))

# spin up gunicorn
gunicorn cometa_pj.wsgi:application --workers=${WORKERS:-$GUNI_WORKERS} --threads=${THREADS:-2} --worker-class=gthread --bind 0.0.0.0:8000

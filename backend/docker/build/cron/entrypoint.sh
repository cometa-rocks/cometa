#!/usr/bin/env sh

# run the crontab in background
crond -f -d 7 &

# listen and update the crontab
while : ; do echo -e "HTTP/1.1 200 OK\n\n$(sh /home/cometa/crontab/update_crontab.sh)" | nc -l -p 8080; done

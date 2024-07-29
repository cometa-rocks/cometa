FROM selenium/video:latest


USER root

# Create a non-root user 'cometa' with UID 472 and GID 472
RUN groupadd -g 472 cometa && \
    useradd -u 472 -g cometa -m cometa -s /bin/bash


COPY ./video.sh /opt/bin/video.sh

# RUN chown -R cometa:cometa /etc
RUN chown -R cometa:cometa /videos
RUN chown -R cometa:cometa /opt/bin/

RUN chmod ug+x /opt/bin/video.sh
RUN chmod ug+x /opt/bin/entry_point.sh
RUN chmod -R 777 /videos

USER cometa

ENTRYPOINT ["/opt/bin/entry_point.sh"]
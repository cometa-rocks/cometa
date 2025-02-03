FROM selenium/video:latest

USER root
COPY ./video.sh /opt/bin/video.sh
RUN chmod ugo+x /opt/bin/video.sh

USER seluser

ENTRYPOINT ["/opt/bin/entry_point.sh"]
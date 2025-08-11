# Use the Selenium Standalone Chrome as the base image
ARG BASE_IMAGE=selenium/standalone-chrome:latest
FROM ${BASE_IMAGE}

USER root
# Install video recording dependencies
RUN apt-get update && \
    apt-get install -y \
    xvfb \
    ffmpeg \
    xterm && \
    apt-get clean 
# Create a directory for recordings
RUN mkdir -p /opt/recordings

COPY ./supervisor/supervisord.conf /etc/supervisord.conf

RUN groupadd -g 1472 cometa \
&& useradd -u 1472 -g cometa -d /home/cometa -s /bin/bash cometa

RUN chown 1200:1201 /opt/selenium/ -R

COPY --chown=1472:1472 ./scripts/video_recorder.sh /opt/scripts/video_recorder.sh
RUN chmod ugo+x /opt/scripts/video_recorder.sh

COPY ./background.png /usr/share/images/fluxbox/ubuntu-light.png
COPY ./background.png /usr/share/images/fluxbox/fluxbox.png
COPY ./background.png /usr/share/images/fluxbox/ubuntu-dark.png

USER 1200

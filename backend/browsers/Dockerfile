# Use the Selenium Standalone Chrome as the base image
ARG BASE_IMAGE=selenium/standalone-chrome:latest
FROM ${BASE_IMAGE}

USER root
# Install video recording dependencies
RUN apt-get update && \
    apt-get install -y \
    xvfb \
    ffmpeg && \
    apt-get clean 
# Create a directory for recordings
RUN mkdir -p /opt/recordings

COPY ./supervisor/supervisord.conf /etc/supervisord.conf

COPY --chown=1200:1201 ./scripts/video_recorder.sh /opt/scripts/video_recorder.sh
RUN chmod ugo+x /opt/scripts/video_recorder.sh

COPY ./background.png /usr/share/images/fluxbox/ubuntu-light.png
COPY ./background.png /usr/share/images/fluxbox/fluxbox.png
COPY ./background.png /usr/share/images/fluxbox/ubuntu-dark.png

USER 1200

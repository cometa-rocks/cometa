FROM selenium/standalone-chrome:123.0


USER root

RUN apt update -y
RUN apt-get install -y software-properties-common
RUN apt-get update
RUN apt-get install -y ffmpeg

RUN mkdir -p /video
RUN mkdir -p /code
# RUN chown -R cometa:cometa /share
RUN chmod -R 755 /video
RUN chmod -R 755 /code

WORKDIR /opt/code/
COPY ./start_recorder.sh /opt/code/start_recorder.sh
COPY ./entry.sh /opt/code/entry.sh
COPY ./amvara.png /usr/share/images/fluxbox/ubuntu-dark.png
COPY ./amvara.png /usr/share/images/fluxbox/ubuntu-light.png
RUN chmod +x start_recorder.sh
RUN chmod +x entry.sh

CMD ["bash","./entry.sh"]

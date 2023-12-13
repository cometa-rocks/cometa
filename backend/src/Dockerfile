FROM python:3.9 as base

# set maintainers
LABEL org.opencontainers.image.author1="Arslan Sohail <hello.arslan@amvara.de>"
LABEL org.opencontainers.image.author2="AMVARA CONSULTING S.L. <tec_dev@amvara.de>"

RUN apt update
RUN apt install -y cron clamav-daemon

# install poetry using pip 
RUN pip install poetry

# Disable creation of virtual env
RUN poetry config virtualenvs.create false

# fetch clamv db
RUN freshclam

# ################# WIP ################# #
# This file is still under progress.
# This is currently being used together
# with the start.sh script specified in
# docker-compose file.
# ################# WIP ################# #
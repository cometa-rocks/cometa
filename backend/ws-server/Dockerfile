FROM node:20.10.0-alpine as base

# set maintainers
LABEL org.opencontainers.image.author1="Arslan Sohail <hello.arslan@amvara.de>"
LABEL org.opencontainers.image.author2="AMVARA CONSULTING S.L. <tec_dev@amvara.de>"

WORKDIR /home/cometa/ws
COPY . /home/cometa/ws

# install all the packages
RUN npm i

FROM base as development

CMD [ "npx", "pm2", "start", "--no-daemon", "app/index.js", "--watch", "--ignore-watch='node_modules'" ]

FROM base as production

CMD [ "npx", "pm2", "start", "--no-daemon", "app/index.js" ]
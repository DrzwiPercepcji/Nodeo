FROM node:alpine

RUN echo 'http://dl-cdn.alpinelinux.org/alpine/edge/community' >> /etc/apk/repositories
RUN apk update
RUN apk add ffmpeg

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run sass:compile

CMD ["npm", "start"]
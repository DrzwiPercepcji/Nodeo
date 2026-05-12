FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/

RUN npm run build

FROM node:24-alpine

RUN apk add --no-cache ffmpeg su-exec python3 py3-pip \
 && pip3 install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist/ dist/
COPY src/openapi.yaml dist/
COPY src/db/migrations/ dist/db/migrations/
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "dist/index.js"]

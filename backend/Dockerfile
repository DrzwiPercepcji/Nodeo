FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/

RUN npm run build

FROM node:24-alpine

RUN apk add --no-cache ffmpeg

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist/ dist/
COPY src/openapi.yaml dist/
COPY src/db/migrations/ dist/db/migrations/

USER node

EXPOSE 3000

CMD ["node", "dist/index.js"]

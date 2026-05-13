#!/bin/sh
set -e
if [ "$(id -u)" = "0" ]; then
  tmp="${NODEO_TEMP_DIR:-/data/nodeo-tmp}"
  data="${NODEO_DATA_DIR:-/data/nodeo-data}"
  mkdir -p "$tmp" "$data"
  chown -R node:node "$tmp" "$data"
  exec su-exec node:node "$@"
fi
exec "$@"

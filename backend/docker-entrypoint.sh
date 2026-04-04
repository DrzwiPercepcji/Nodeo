#!/bin/sh
set -e
if [ "$(id -u)" = "0" ]; then
  tmp="${NODEO_TEMP_DIR:-/data/nodeo-tmp}"
  mkdir -p "$tmp"
  chown -R node:node "$tmp"
  exec su-exec node:node "$@"
fi
exec "$@"

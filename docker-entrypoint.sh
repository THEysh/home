#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/data}"
APP_USER="${APP_USER:-appuser}"
APP_GROUP="${APP_GROUP:-nodejs}"

mkdir -p "$DATA_DIR"
mkdir -p "$DATA_DIR/uploads/originals" "$DATA_DIR/uploads/display" "$DATA_DIR/uploads/thumbs"
chown -R "$APP_USER:$APP_GROUP" "$DATA_DIR"

if [ "$(id -u)" = "0" ]; then
  exec su-exec "$APP_USER:$APP_GROUP" "$@"
fi

exec "$@"

#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/data}"

mkdir -p "$DATA_DIR"
mkdir -p "$DATA_DIR/uploads/originals" "$DATA_DIR/uploads/display" "$DATA_DIR/uploads/thumbs"

if [ ! -f "$DATA_DIR/links.json" ]; then
  cp /app/links.example.json "$DATA_DIR/links.json"
fi

if [ ! -f "$DATA_DIR/background.json" ]; then
  cp /app/background.example.json "$DATA_DIR/background.json"
fi

if [ ! -f "$DATA_DIR/images.json" ]; then
  cp /app/images.example.json "$DATA_DIR/images.json"
fi

rm -rf /app/uploads
ln -sfn "$DATA_DIR/uploads" /app/uploads
ln -sfn "$DATA_DIR/links.json" /app/links.json
ln -sfn "$DATA_DIR/background.json" /app/background.json
ln -sfn "$DATA_DIR/images.json" /app/images.json

exec "$@"

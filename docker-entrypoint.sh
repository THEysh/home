#!/bin/sh
set -eu

if [ ! -f /app/links.json ]; then
  cp /app/links.example.json /app/links.json
fi

if [ ! -f /app/background.json ]; then
  cp /app/background.example.json /app/background.json
fi

if [ ! -f /app/images.json ]; then
  cp /app/images.example.json /app/images.json
fi

mkdir -p /app/uploads/originals /app/uploads/display /app/uploads/thumbs

exec "$@"

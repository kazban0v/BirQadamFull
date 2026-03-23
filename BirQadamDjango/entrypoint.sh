#!/usr/bin/env sh
set -e

RUN_COLLECTSTATIC="${RUN_COLLECTSTATIC:-1}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-1}"

# ВАЖНО: убедимся, что мы в папке где manage.py
cd /app

if [ "$RUN_COLLECTSTATIC" = "1" ]; then
  echo "== Django collectstatic =="
  python manage.py collectstatic --noinput
fi

if [ "$RUN_MIGRATIONS" = "1" ]; then
  echo "== Django migrate =="
  python manage.py migrate --noinput
fi

exec "$@"

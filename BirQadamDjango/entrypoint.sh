#!/usr/bin/env sh
set -eu

echo "[entrypoint] Running migrations..."
python manage.py migrate --noinput --fake-initial

echo "[entrypoint] Collecting static..."
python manage.py collectstatic --noinput

echo "[entrypoint] Starting: $*"
exec "$@"





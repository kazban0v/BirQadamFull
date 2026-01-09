#!/usr/bin/env sh
set -eu

echo "[entrypoint] Running migrations..."
python safe_migrate.py

echo "[entrypoint] Collecting static..."
python manage.py collectstatic --noinput

echo "[entrypoint] Starting: $*"
exec "$@"





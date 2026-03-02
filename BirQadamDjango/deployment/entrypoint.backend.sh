#!/usr/bin/env sh
set -e

echo "== Django collectstatic =="
python manage.py collectstatic --noinput

echo "== Django migrate =="
python manage.py migrate --noinput

exec "$@"

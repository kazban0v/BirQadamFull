#!/bin/bash
# Don't use set -e here, we want to see all errors
set -x  # Debug mode - show all commands

echo "=== Starting BirQadam Django Application ==="
echo "[start.sh] Current directory: $(pwd)"
echo "[start.sh] Current user: $(whoami)"
echo "[start.sh] Python version: $(python --version)"

# Check if we're in the right directory
if [ ! -f "manage.py" ]; then
    echo "[start.sh] ERROR: manage.py not found in current directory!"
    echo "[start.sh] Contents of current directory:"
    ls -la
    exit 1
fi

echo "[start.sh] Running migrations..."
if ! python safe_migrate.py; then
    echo "[start.sh] ERROR: Migrations failed!"
    exit 1
fi

echo "[start.sh] Collecting static files..."
if ! python manage.py collectstatic --noinput; then
    echo "[start.sh] WARNING: collectstatic failed, but continuing..."
fi

# Check if PORT is set
if [ -z "$PORT" ]; then
    echo "[start.sh] WARNING: PORT environment variable is not set, using default 8000"
    PORT=8000
fi

echo "[start.sh] Starting Gunicorn..."
echo "[start.sh] PORT=$PORT"
echo "[start.sh] Binding to 0.0.0.0:$PORT"
echo "[start.sh] WSGI application: volunteer_project.wsgi:application"

# Start gunicorn with detailed logging
# Note: We don't test Django import here - if it fails, gunicorn will show the error
echo "[start.sh] Launching Gunicorn now..."
exec gunicorn volunteer_project.wsgi:application \
    --bind "0.0.0.0:$PORT" \
    --workers 3 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    --capture-output \
    --enable-stdio-inheritance


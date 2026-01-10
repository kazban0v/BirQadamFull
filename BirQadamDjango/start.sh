#!/bin/bash
# Complete startup script for Railway (without Docker)
set -x  # Debug mode - show all commands

echo "=== Starting BirQadam Django Application ==="
echo "[start.sh] Current directory: $(pwd)"
echo "[start.sh] Current user: $(whoami)"
echo "[start.sh] Python version: $(python --version 2>&1)"
echo "[start.sh] PORT=$PORT"

# Ensure we see all output immediately
export PYTHONUNBUFFERED=1

# Check if we're in the right directory
if [ ! -f "manage.py" ]; then
    echo "[start.sh] ERROR: manage.py not found in $(pwd)!"
    echo "[start.sh] Contents:"
    ls -la
    exit 1
fi

# Run migrations
echo "[start.sh] ========================================="
echo "[start.sh] Running migrations..."
echo "[start.sh] ========================================="
python safe_migrate.py || {
    EXIT_CODE=$?
    echo "[start.sh] ERROR: Migrations failed with exit code $EXIT_CODE"
    echo "[start.sh] Continuing anyway to see if app can start..."
}

# Collect static files
echo "[start.sh] ========================================="
echo "[start.sh] Collecting static files..."
echo "[start.sh] ========================================="
python manage.py collectstatic --noinput || {
    EXIT_CODE=$?
    echo "[start.sh] WARNING: collectstatic failed with exit code $EXIT_CODE"
    echo "[start.sh] Continuing anyway..."
}

# Check if PORT is set
if [ -z "$PORT" ]; then
    echo "[start.sh] WARNING: PORT environment variable is not set, using default 8000"
    PORT=8000
fi

echo "[start.sh] ========================================="
echo "[start.sh] Starting Gunicorn..."
echo "[start.sh] Binding to 0.0.0.0:$PORT"
echo "[start.sh] WSGI application: volunteer_project.wsgi:application"
echo "[start.sh] ========================================="

# Start gunicorn with detailed logging
exec gunicorn volunteer_project.wsgi:application \
    --bind "0.0.0.0:$PORT" \
    --workers 3 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    --capture-output \
    --enable-stdio-inheritance


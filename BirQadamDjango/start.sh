#!/bin/bash
# Start Gunicorn only - migrations and collectstatic are done in entrypoint.sh
set -x  # Debug mode - show all commands

echo "=== Starting Gunicorn ==="
echo "[start.sh] Current directory: $(pwd)"
echo "[start.sh] PORT=$PORT"

# Check if PORT is set
if [ -z "$PORT" ]; then
    echo "[start.sh] WARNING: PORT environment variable is not set, using default 8000"
    PORT=8000
fi

echo "[start.sh] Binding to 0.0.0.0:$PORT"
echo "[start.sh] WSGI application: volunteer_project.wsgi:application"

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


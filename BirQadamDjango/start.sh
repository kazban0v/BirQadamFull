#!/bin/bash
# Complete startup script for Railway (without Docker)
set -x  # Debug mode - show all commands

echo "=== Starting BirQadam Django Application ===" 1>&2
echo "[start.sh] Script started at $(date)" 1>&2
echo "[start.sh] Current directory: $(pwd)" 1>&2
echo "[start.sh] Current user: $(whoami)" 1>&2

# Activate virtual environment if it exists
if [ -d "/opt/venv" ]; then
    echo "[start.sh] Activating virtual environment at /opt/venv" 1>&2
    source /opt/venv/bin/activate
    export PATH="/opt/venv/bin:$PATH"
fi

echo "[start.sh] Python version: $(python --version 2>&1)" 1>&2
echo "[start.sh] Python path: $(which python)" 1>&2
echo "[start.sh] PORT=$PORT" 1>&2

# Ensure we see all output immediately
export PYTHONUNBUFFERED=1

# List directory contents
echo "[start.sh] Directory contents:" 1>&2
ls -la 1>&2 || echo "[start.sh] Failed to list directory" 1>&2

# Check if we're in the right directory
if [ ! -f "manage.py" ]; then
    echo "[start.sh] ERROR: manage.py not found in $(pwd)!" 1>&2
    echo "[start.sh] Searching for manage.py..." 1>&2
    find . -maxdepth 3 -name "manage.py" 2>&1 | head -5 1>&2 || echo "[start.sh] manage.py not found" 1>&2
    echo "[start.sh] Will continue anyway - Railway may be in correct directory" 1>&2
else
    echo "[start.sh] Found manage.py - good!" 1>&2
fi

# Run migrations
echo "[start.sh] =========================================" 1>&2
echo "[start.sh] Running migrations..." 1>&2
echo "[start.sh] =========================================" 1>&2
python safe_migrate.py 2>&1 || {
    EXIT_CODE=$?
    echo "[start.sh] ERROR: Migrations failed with exit code $EXIT_CODE" 1>&2
    echo "[start.sh] Continuing anyway to see if app can start..." 1>&2
}

# Collect static files
echo "[start.sh] =========================================" 1>&2
echo "[start.sh] Collecting static files..." 1>&2
echo "[start.sh] =========================================" 1>&2
python manage.py collectstatic --noinput 2>&1 || {
    EXIT_CODE=$?
    echo "[start.sh] WARNING: collectstatic failed with exit code $EXIT_CODE" 1>&2
    echo "[start.sh] Continuing anyway..." 1>&2
}

# Check if PORT is set
if [ -z "$PORT" ]; then
    echo "[start.sh] WARNING: PORT environment variable is not set, using default 8000"
    PORT=8000
fi

echo "[start.sh] =========================================" 1>&2
echo "[start.sh] Starting Gunicorn..." 1>&2
echo "[start.sh] Binding to 0.0.0.0:$PORT" 1>&2
echo "[start.sh] WSGI application: volunteer_project.wsgi:application" 1>&2
echo "[start.sh] =========================================" 1>&2

# Test Django import before starting gunicorn
echo "[start.sh] Testing Django import..." 1>&2
python -c "import django; import os; os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'volunteer_project.settings'); django.setup(); print('Django setup OK')" 2>&1 || {
    echo "[start.sh] WARNING: Django import test failed, but continuing..." 1>&2
}

# Start gunicorn with detailed logging
echo "[start.sh] Launching Gunicorn now..." 1>&2
exec gunicorn volunteer_project.wsgi:application \
    --bind "0.0.0.0:$PORT" \
    --workers 3 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info \
    --capture-output \
    --enable-stdio-inheritance


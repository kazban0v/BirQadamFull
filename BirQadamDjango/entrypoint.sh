#!/usr/bin/env bash
# Entrypoint script for Docker
# Output all commands for debugging
set -x

# Ensure we see all output immediately
export PYTHONUNBUFFERED=1

echo "=== Docker Entrypoint Starting ==="
echo "[entrypoint] Container starting..."
echo "[entrypoint] Date: $(date)"
echo "[entrypoint] Current directory: $(pwd)"
echo "[entrypoint] Current user: $(whoami)"
echo "[entrypoint] PORT=$PORT"

# List current directory contents
echo "[entrypoint] Directory contents:"
ls -la || echo "[entrypoint] Failed to list directory"

# Check if we're in the right directory
if [ ! -f "manage.py" ]; then
    echo "[entrypoint] ERROR: manage.py not found in $(pwd)!"
    echo "[entrypoint] Searching for manage.py:"
    find /app -name "manage.py" 2>/dev/null || echo "[entrypoint] manage.py not found anywhere"
    echo "[entrypoint] Will continue anyway..."
else
    echo "[entrypoint] Found manage.py - continuing..."
fi

# Check Python
echo "[entrypoint] Python check:"
python --version || echo "[entrypoint] Python version check failed"

# Run migrations
echo "[entrypoint] ========================================="
echo "[entrypoint] Running migrations..."
echo "[entrypoint] ========================================="
python safe_migrate.py || {
    EXIT_CODE=$?
    echo "[entrypoint] ERROR: Migrations failed with exit code $EXIT_CODE"
    echo "[entrypoint] Continuing anyway to see if app can start..."
}

# Collect static files
echo "[entrypoint] ========================================="
echo "[entrypoint] Collecting static files..."
echo "[entrypoint] ========================================="
python manage.py collectstatic --noinput || {
    EXIT_CODE=$?
    echo "[entrypoint] WARNING: collectstatic failed with exit code $EXIT_CODE"
    echo "[entrypoint] Continuing anyway..."
}

# Execute the command passed from CMD (usually start.sh)
echo "[entrypoint] ========================================="
echo "[entrypoint] Executing command: $*"
echo "[entrypoint] ========================================="

# Check if start.sh exists and is executable
if [ -f "/app/start.sh" ]; then
    echo "[entrypoint] start.sh exists"
    ls -la /app/start.sh
    echo "[entrypoint] Making sure start.sh is executable..."
    chmod +x /app/start.sh
else
    echo "[entrypoint] ERROR: start.sh not found!"
    echo "[entrypoint] Looking for start.sh..."
    find /app -name "start.sh" 2>/dev/null
    echo "[entrypoint] Will try to execute command anyway: $*"
fi

# Execute command
echo "[entrypoint] About to exec: $*"
exec "$@"





#!/usr/bin/env bash
# Entrypoint script for Docker
# Output all commands for debugging
set -x
# Don't use set -e here - we want to see errors, not fail silently
# set -euo pipefail

# Ensure we see all output immediately
export PYTHONUNBUFFERED=1

echo "=== Docker Entrypoint Starting ===" | tee /dev/stderr
echo "[entrypoint] Container starting..." | tee /dev/stderr
echo "[entrypoint] Date: $(date)" | tee /dev/stderr
echo "[entrypoint] Current directory: $(pwd)" | tee /dev/stderr
echo "[entrypoint] Current user: $(whoami 2>&1)" | tee /dev/stderr
echo "[entrypoint] PORT=$PORT" | tee /dev/stderr

# List current directory contents
echo "[entrypoint] Directory contents:" | tee /dev/stderr
ls -la 2>&1 | tee /dev/stderr || echo "[entrypoint] Failed to list directory" | tee /dev/stderr

# Check if we're in the right directory
if [ ! -f "manage.py" ]; then
    echo "[entrypoint] ERROR: manage.py not found in $(pwd)!" | tee /dev/stderr
    echo "[entrypoint] Searching for manage.py:" | tee /dev/stderr
    find /app -name "manage.py" 2>&1 | tee /dev/stderr || echo "[entrypoint] manage.py not found anywhere" | tee /dev/stderr
    exit 1
fi

echo "[entrypoint] Found manage.py - continuing..." | tee /dev/stderr

# Check Python
echo "[entrypoint] Python check:" | tee /dev/stderr
python --version 2>&1 | tee /dev/stderr || echo "[entrypoint] Python version check failed" | tee /dev/stderr

# Run migrations
echo "[entrypoint] =========================================" | tee /dev/stderr
echo "[entrypoint] Running migrations..." | tee /dev/stderr
echo "[entrypoint] =========================================" | tee /dev/stderr
python safe_migrate.py 2>&1 | tee /dev/stderr || {
    EXIT_CODE=$?
    echo "[entrypoint] ERROR: Migrations failed with exit code $EXIT_CODE" | tee /dev/stderr
    echo "[entrypoint] Continuing anyway to see if app can start..." | tee /dev/stderr
}

# Collect static files
echo "[entrypoint] =========================================" | tee /dev/stderr
echo "[entrypoint] Collecting static files..." | tee /dev/stderr
echo "[entrypoint] =========================================" | tee /dev/stderr
python manage.py collectstatic --noinput 2>&1 | tee /dev/stderr || {
    EXIT_CODE=$?
    echo "[entrypoint] WARNING: collectstatic failed with exit code $EXIT_CODE" | tee /dev/stderr
    echo "[entrypoint] Continuing anyway..." | tee /dev/stderr
}

# Execute the command passed from CMD (usually start.sh)
echo "[entrypoint] =========================================" | tee /dev/stderr
echo "[entrypoint] Executing command: $*" | tee /dev/stderr
echo "[entrypoint] =========================================" | tee /dev/stderr

# Check if start.sh exists and is executable
if [ -f "/app/start.sh" ]; then
    echo "[entrypoint] start.sh exists" | tee /dev/stderr
    ls -la /app/start.sh 2>&1 | tee /dev/stderr
    echo "[entrypoint] Making sure start.sh is executable..." | tee /dev/stderr
    chmod +x /app/start.sh 2>&1 | tee /dev/stderr
else
    echo "[entrypoint] ERROR: start.sh not found!" | tee /dev/stderr
    echo "[entrypoint] Looking for start.sh..." | tee /dev/stderr
    find /app -name "start.sh" 2>&1 | tee /dev/stderr
    exit 1
fi

# Execute command
echo "[entrypoint] About to exec: $*" | tee /dev/stderr
exec "$@"





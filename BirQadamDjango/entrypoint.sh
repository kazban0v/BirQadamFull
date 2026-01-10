#!/bin/bash
# Entrypoint script for Docker
set -x  # Debug mode

echo "=== Docker Entrypoint ==="
echo "[entrypoint] Container starting..."
echo "[entrypoint] Current directory: $(pwd)"
echo "[entrypoint] Current user: $(whoami)"
echo "[entrypoint] Python version: $(python --version 2>&1 || echo 'Python not found')"
echo "[entrypoint] PORT=$PORT"

# Check if we're in the right directory
if [ ! -f "manage.py" ]; then
    echo "[entrypoint] ERROR: manage.py not found!"
    echo "[entrypoint] Contents:"
    ls -la
    exit 1
fi

# Run migrations
echo "[entrypoint] Running migrations..."
if ! python safe_migrate.py; then
    echo "[entrypoint] ERROR: Migrations failed!"
    exit 1
fi

# Collect static files
echo "[entrypoint] Collecting static files..."
python manage.py collectstatic --noinput || {
    echo "[entrypoint] WARNING: collectstatic failed, but continuing..."
}

# Execute the command passed from CMD (usually start.sh)
echo "[entrypoint] Executing command: $*"
exec "$@"





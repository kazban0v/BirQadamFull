web: python manage.py migrate --fake --noinput || true && python manage.py collectstatic --noinput && gunicorn volunteer_project.wsgi:application --bind 0.0.0.0:$PORT --workers 3 --timeout 120


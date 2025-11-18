"""
WSGI config for volunteer_project project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

# ✅ ИСПРАВЛЕНИЕ: Устанавливаем UTF-8 для Windows
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'volunteer_project.settings')
if os.name == 'nt':  # Windows
    os.environ['PYTHONIOENCODING'] = 'utf-8'

application = get_wsgi_application()

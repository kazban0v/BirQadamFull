import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'birqadam_project.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    try:
        cursor.execute("SELECT to_regclass('public.api_user');")
        result = cursor.fetchone()
        print("Таблица api_user:", result)
    except Exception as e:
        print("Ошибка:", e)

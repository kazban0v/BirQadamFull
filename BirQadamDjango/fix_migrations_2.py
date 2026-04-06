import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'birqadam_project.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    try:
        cursor.execute("DELETE FROM django_migrations WHERE app='admin';")
        deleted = cursor.rowcount
        print(f"Удалено записей из django_migrations по admin: {deleted}")
    except Exception as e:
        print("Ошибка при удалении записи:", e)

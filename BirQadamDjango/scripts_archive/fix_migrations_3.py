import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'birqadam_project.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    try:
        cursor.execute("DROP INDEX IF EXISTS device_token_user_active_idx;")
        print("Индекс device_token_user_active_idx удален.")
    except Exception as e:
        print("Ошибка при удалении индекса:", e)

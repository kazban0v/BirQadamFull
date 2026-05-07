import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'birqadam_project.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    try:
        cursor.execute("CREATE TABLE django_migrations_backup AS SELECT * FROM django_migrations;")
        print("Бэкап таблицы django_migrations создан (django_migrations_backup).")
    except Exception as e:
        print("Не удалось создать бэкап (возможно, он уже существует):", e)
        # Откатываем транзакцию, если была ошибка с созданием таблицы
        connection.rollback()
    
    try:
        cursor.execute("DELETE FROM django_migrations WHERE app='admin' AND name='0001_initial';")
        deleted = cursor.rowcount
        print(f"Удалено записей из django_migrations по admin.0001_initial: {deleted}")
    except Exception as e:
        print("Ошибка при удалении записи:", e)

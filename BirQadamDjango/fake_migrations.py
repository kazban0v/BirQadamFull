#!/usr/bin/env python
"""
Скрипт для пометки всех миграций как примененных, если таблицы уже существуют.
Используется когда БД была импортирована из дампа.
"""
import os
import sys
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'volunteer_project.settings')
django.setup()

from django.db import connection
from django.core.management import call_command

def table_exists(table_name):
    """Проверяет, существует ли таблица"""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = %s
            );
        """, [table_name])
        return cursor.fetchone()[0]

def main():
    # Проверяем, есть ли хотя бы одна таблица Django
    if table_exists('django_content_type'):
        print("Таблицы уже существуют. Помечаем все миграции как примененные...")
        # Получаем список всех приложений и их миграций
        from django.apps import apps
        from django.db.migrations.recorder import MigrationRecorder
        
        recorder = MigrationRecorder(connection)
        if not table_exists('django_migrations'):
            # Создаем таблицу django_migrations если её нет
            recorder.ensure_schema()
        
        # Помечаем все миграции как примененные
        from django.core.management import get_commands
        from django.db import migrations
        
        # Получаем все миграции для всех приложений
        from django.db.migrations.loader import MigrationLoader
        loader = MigrationLoader(connection)
        
        # Помечаем все миграции как примененные
        for app_label, app_migrations in loader.disk_migrations.items():
            for migration_name, migration in app_migrations.items():
                recorder.record_applied(app_label, migration_name)
                print(f"Помечена миграция: {app_label}.{migration_name}")
        
        print("Все миграции помечены как примененные.")
    else:
        print("Таблицы не найдены. Выполняем обычные миграции...")
        call_command('migrate', verbosity=1, interactive=False)

if __name__ == '__main__':
    main()


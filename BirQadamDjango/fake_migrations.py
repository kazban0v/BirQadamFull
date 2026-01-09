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
    if table_exists('django_migrations'):
        print("Таблица django_migrations существует. Пометим все миграции как примененные...")
        # Помечаем все миграции как примененные
        call_command('migrate', '--fake', verbosity=1)
        print("Миграции помечены как примененные.")
    else:
        print("Таблица django_migrations не найдена. Выполняем обычные миграции...")
        call_command('migrate', verbosity=1)

if __name__ == '__main__':
    main()


#!/usr/bin/env python
"""
Безопасная обертка для команды migrate, которая игнорирует ошибки о существующих объектах.
Используется для деплоя в Railway, когда база данных уже содержит некоторые таблицы/индексы.
"""
import os
import sys
import django

# Настройка Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'volunteer_project.settings')
django.setup()

from django.core.management import call_command
from django.db import connection
from django.db.utils import ProgrammingError, OperationalError


def safe_migrate():
    """Безопасное выполнение миграций с обработкой ошибок о существующих объектах."""
    print("[safe_migrate] Запуск безопасных миграций...")
    
    # Сначала пробуем выполнить миграции с --fake-initial
    # Это обработает случай с существующими таблицами
    try:
        print("[safe_migrate] Попытка миграций с --fake-initial...")
        call_command('migrate', verbosity=1, interactive=False, fake_initial=True)
        print("[safe_migrate] ✓ Миграции успешно применены")
        return True
    except (ProgrammingError, OperationalError) as e:
        error_msg = str(e).lower()
        
        # Если ошибка связана с существующими объектами (таблицы, индексы, constraints)
        if any(keyword in error_msg for keyword in [
            'already exists',
            'duplicate table',
            'duplicate index',
            'duplicate key',
            'relation already exists'
        ]):
            print(f"[safe_migrate] ⚠ Обнаружена ошибка о существующем объекте")
            print(f"[safe_migrate] Детали: {str(e)[:200]}...")
            print("[safe_migrate] Применяем миграции по одной с обработкой ошибок...")
            
            # Получаем список миграций, которые нужно применить
            from django.db.migrations.executor import MigrationExecutor
            
            executor = MigrationExecutor(connection)
            
            # Получаем список не примененных миграций
            plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
            
            if not plan:
                print("[safe_migrate] ✓ Все миграции уже применены")
                return True
            
            # Пытаемся применить каждую миграцию отдельно с обработкой ошибок
            applied_count = 0
            fake_count = 0
            
            for migration, backwards in plan:
                if backwards:
                    continue
                
                try:
                    print(f"[safe_migrate] Применение: {migration.app_label}.{migration.name}")
                    executor.apply_migration(migration, fake=False)
                    applied_count += 1
                    print(f"[safe_migrate] ✓ Применена: {migration.app_label}.{migration.name}")
                except (ProgrammingError, OperationalError) as migration_error:
                    error_str = str(migration_error).lower()
                    
                    # Если ошибка о существующих объектах - помечаем миграцию как fake
                    if any(keyword in error_str for keyword in [
                        'already exists',
                        'duplicate',
                        'relation already exists'
                    ]):
                        print(f"[safe_migrate] ⚠ Объекты уже существуют для {migration.app_label}.{migration.name}")
                        executor.apply_migration(migration, fake=True)
                        fake_count += 1
                        print(f"[safe_migrate] ✓ Помечена как примененная: {migration.app_label}.{migration.name}")
                    else:
                        # Другие ошибки - пробрасываем дальше
                        print(f"[safe_migrate] ✗ Ошибка: {migration_error}")
                        raise
                except Exception as e:
                    # Неожиданные ошибки - пробрасываем
                    print(f"[safe_migrate] ✗ Неожиданная ошибка: {e}")
                    raise
            
            print(f"[safe_migrate] ✓ Завершено: применено {applied_count}, помечено {fake_count}")
            return True
        else:
            # Другие ошибки - пробрасываем
            print(f"[safe_migrate] ✗ Ошибка: {e}")
            raise
    except Exception as e:
        print(f"[safe_migrate] ✗ Общая ошибка: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == '__main__':
    try:
        safe_migrate()
        print("[safe_migrate] ✓ Миграции успешно завершены")
        sys.exit(0)
    except Exception as e:
        print(f"[safe_migrate] ✗ Критическая ошибка: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


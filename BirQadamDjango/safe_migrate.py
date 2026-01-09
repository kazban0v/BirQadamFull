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
            from django.db.migrations.recorder import MigrationRecorder
            
            recorder = MigrationRecorder(connection)
            applied_count = 0
            fake_count = 0
            
            for migration, backwards in plan:
                if backwards:
                    continue
                
                migration_name = migration.name
                app_label = migration.app_label
                
                # Проверяем, не применена ли уже миграция
                migration_key = (app_label, migration_name)
                applied_migrations = recorder.applied_migrations()
                
                if migration_key in applied_migrations:
                    print(f"[safe_migrate] ⚠ Миграция {app_label}.{migration_name} уже применена, пропускаем")
                    continue
                
                try:
                    print(f"[safe_migrate] Применение: {app_label}.{migration_name}")
                    # Применяем миграцию через call_command с правильными аргументами
                    # Формат: python manage.py migrate app_label migration_name
                    # В call_command это позиционные аргументы после имени команды
                    call_command(
                        'migrate',
                        app_label,
                        migration_name,
                        verbosity=1,
                        interactive=False,
                        fake=False
                    )
                    applied_count += 1
                    print(f"[safe_migrate] ✓ Применена: {app_label}.{migration_name}")
                except (ProgrammingError, OperationalError) as migration_error:
                    error_str = str(migration_error).lower()
                    
                    # Если ошибка о существующих объектах - помечаем миграцию как fake
                    if any(keyword in error_str for keyword in [
                        'already exists',
                        'duplicate',
                        'relation already exists'
                    ]):
                        print(f"[safe_migrate] ⚠ Объекты уже существуют для {app_label}.{migration_name}")
                        # Помечаем миграцию как примененную через MigrationRecorder напрямую
                        try:
                            recorder.record_applied(app_label, migration_name)
                            fake_count += 1
                            print(f"[safe_migrate] ✓ Помечена как примененная: {app_label}.{migration_name}")
                        except Exception as record_error:
                            # Проверяем, не помечена ли уже миграция (может быть race condition)
                            applied_migrations_after = recorder.applied_migrations()
                            if migration_key not in applied_migrations_after:
                                print(f"[safe_migrate] ⚠ Не удалось пометить миграцию: {record_error}")
                                raise
                            else:
                                print(f"[safe_migrate] ⚠ Миграция уже помечена другим процессом")
                                fake_count += 1
                    else:
                        # Другие ошибки - пробрасываем дальше
                        print(f"[safe_migrate] ✗ Ошибка: {migration_error}")
                        raise
                except Exception as e:
                    # Неожиданные ошибки - пробрасываем
                    print(f"[safe_migrate] ✗ Неожиданная ошибка: {e}")
                    import traceback
                    traceback.print_exc()
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


# Generated migration to fix all foreign keys referencing core_user

from django.db import migrations


def fix_all_user_foreign_keys(apps, schema_editor):
    """
    Исправляет все внешние ключи, ссылающиеся на core_user
    Изменяет их на SET_NULL и разрешает NULL значения (где возможно)
    """
    from django.db import connection
    
    with connection.cursor() as cursor:
        # Получаем список всех таблиц, которые имеют внешние ключи на core_user
        cursor.execute("""
            SELECT 
                tc.table_name,
                kcu.column_name,
                tc.constraint_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
                AND ccu.table_schema = tc.table_schema
            WHERE tc.constraint_type = 'FOREIGN KEY'
                AND ccu.table_name = 'core_user'
                AND tc.table_schema = 'public'
                AND tc.table_name != 'core_user'
                AND tc.table_name NOT IN ('django_admin_log', 'django_content_type', 'auth_permission', 'auth_group');
        """)
        
        tables_to_fix = cursor.fetchall()
        
        for table_name, column_name, constraint_name in tables_to_fix:
            try:
                print(f"Обработка таблицы {table_name}, колонка {column_name}, ограничение {constraint_name}")
                
                # Проверяем, разрешены ли NULL значения
                cursor.execute("""
                    SELECT is_nullable 
                    FROM information_schema.columns 
                    WHERE table_name = %s 
                    AND column_name = %s;
                """, [table_name, column_name])
                
                result = cursor.fetchone()
                is_nullable = result[0] if result else 'NO'
                
                # Удаляем старое ограничение
                cursor.execute(f"""
                    ALTER TABLE {table_name} 
                    DROP CONSTRAINT IF EXISTS {constraint_name} CASCADE;
                """)
                print(f"  Удалено ограничение: {constraint_name}")
                
                # Если NULL не разрешены, разрешаем их (для большинства полей это безопасно)
                if is_nullable == 'NO':
                    # Для некоторых полей (например, creator, volunteer) лучше оставить CASCADE
                    # Но для комментариев и лайков можно разрешить NULL
                    if 'comment' in table_name.lower() or 'like' in table_name.lower() or 'message' in table_name.lower():
                        cursor.execute(f"""
                            ALTER TABLE {table_name} 
                            ALTER COLUMN {column_name} DROP NOT NULL;
                        """)
                        print(f"  Разрешены NULL значения в {column_name}")
                        
                        # Создаем новое ограничение с SET_NULL
                        new_constraint_name = f"{table_name}_{column_name}_fk"
                        cursor.execute(f"""
                            ALTER TABLE {table_name} 
                            ADD CONSTRAINT {new_constraint_name} 
                            FOREIGN KEY ({column_name}) 
                            REFERENCES core_user(id) 
                            ON DELETE SET NULL;
                        """)
                        print(f"  Создано новое ограничение: {new_constraint_name} с SET_NULL")
                    else:
                        # Для критических полей оставляем CASCADE, но это не должно вызывать проблем
                        # так как мы уже обрабатываем удаление в UserAdmin
                        cursor.execute(f"""
                            ALTER TABLE {table_name} 
                            ADD CONSTRAINT {table_name}_{column_name}_fk 
                            FOREIGN KEY ({column_name}) 
                            REFERENCES core_user(id) 
                            ON DELETE CASCADE;
                        """)
                        print(f"  Создано новое ограничение с CASCADE для {table_name}.{column_name}")
                
            except Exception as e:
                print(f"  Ошибка при обработке {table_name}: {e}")


def reverse_fix_all_user_foreign_keys(apps, schema_editor):
    """Обратная миграция - не требуется"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0034_fix_photocomment_user_foreign_key'),
    ]

    operations = [
        migrations.RunPython(
            fix_all_user_foreign_keys,
            reverse_fix_all_user_foreign_keys,
        ),
    ]


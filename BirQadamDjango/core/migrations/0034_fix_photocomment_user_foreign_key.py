# Generated migration to fix photocomment user foreign key

from django.db import migrations


def fix_photocomment_user_foreign_key(apps, schema_editor):
    """
    Исправляет внешний ключ user_id в таблице core_photocomment
    """
    from django.db import connection
    from django.conf import settings
    
    with connection.cursor() as cursor:
        # Проверяем, существует ли таблица
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'core_photocomment'
            );
        """)
        table_exists = cursor.fetchone()[0]
        
        if not table_exists:
            print("Таблица core_photocomment не существует, пропускаем миграцию")
            return
        
        # Получаем имя таблицы пользователей из базы данных
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name LIKE '%user%'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        """)
        user_tables = [row[0] for row in cursor.fetchall()]
        # Обычно это core_user
        user_table = 'core_user' if 'core_user' in user_tables else (user_tables[0] if user_tables else 'core_user')
        
        # Получаем все внешние ключи user_id в core_photocomment
        cursor.execute("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'core_photocomment' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%user_id%';
        """)
        fk_constraints = [row[0] for row in cursor.fetchall()]
        
        # Удаляем все существующие внешние ключи для user_id
        for constraint_name in fk_constraints:
            try:
                cursor.execute(f"""
                    ALTER TABLE core_photocomment 
                    DROP CONSTRAINT IF EXISTS {constraint_name} CASCADE;
                """)
                print(f"Удалено ограничение: {constraint_name}")
            except Exception as e:
                print(f"Ошибка при удалении ограничения {constraint_name}: {e}")
        
        # Проверяем, разрешены ли NULL значения в user_id
        cursor.execute("""
            SELECT is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'core_photocomment' 
            AND column_name = 'user_id';
        """)
        result = cursor.fetchone()
        is_nullable = result[0] if result else 'NO'
        
        if is_nullable == 'NO':
            # Изменяем поле user_id, чтобы разрешить NULL
            try:
                cursor.execute("""
                    ALTER TABLE core_photocomment 
                    ALTER COLUMN user_id DROP NOT NULL;
                """)
                print("Разрешены NULL значения в user_id")
            except Exception as e:
                print(f"Ошибка при изменении поля user_id: {e}")
        
        # Проверяем, существует ли уже новый внешний ключ
        cursor.execute("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'core_photocomment' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = 'core_photocomment_user_id_fk';
        """)
        fk_exists = cursor.fetchone()
        
        if not fk_exists:
            # Создаем новый внешний ключ с SET_NULL
            try:
                cursor.execute(f"""
                    ALTER TABLE core_photocomment 
                    ADD CONSTRAINT core_photocomment_user_id_fk 
                    FOREIGN KEY (user_id) 
                    REFERENCES {user_table}(id) 
                    ON DELETE SET NULL;
                """)
                print(f"Создан новый внешний ключ user_id с SET_NULL (ссылается на {user_table})")
            except Exception as e:
                print(f"Ошибка при создании внешнего ключа user_id: {e}")


def reverse_fix_photocomment_user_foreign_key(apps, schema_editor):
    """Обратная миграция - не требуется"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0033_fix_all_photo_foreign_keys'),
    ]

    operations = [
        migrations.RunPython(
            fix_photocomment_user_foreign_key,
            reverse_fix_photocomment_user_foreign_key,
        ),
    ]


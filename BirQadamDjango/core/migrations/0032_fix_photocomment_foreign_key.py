# Generated migration to fix photocomment foreign key issue

from django.db import migrations, models


def fix_photocomment_foreign_key(apps, schema_editor):
    """
    Изменяем внешний ключ в таблице core_photocomment на SET_NULL
    или удаляем таблицу, если она не используется
    """
    from django.db import connection
    
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
        
        # Проверяем, есть ли записи в таблице
        cursor.execute("SELECT COUNT(*) FROM core_photocomment;")
        count = cursor.fetchone()[0]
        
        if count == 0:
            # Если таблица пустая, удаляем её
            cursor.execute("DROP TABLE IF EXISTS core_photocomment CASCADE;")
            print("Удалена пустая таблица core_photocomment")
            return
        
        # Получаем список всех ограничений внешнего ключа для photo_id
        cursor.execute("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'core_photocomment' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name LIKE '%photo_id%';
        """)
        fk_constraints = [row[0] for row in cursor.fetchall()]
        
        # Удаляем все существующие внешние ключи для photo_id
        for constraint_name in fk_constraints:
            try:
                cursor.execute(f"""
                    ALTER TABLE core_photocomment 
                    DROP CONSTRAINT IF EXISTS {constraint_name};
                """)
                print(f"Удалено ограничение: {constraint_name}")
            except Exception as e:
                print(f"Ошибка при удалении ограничения {constraint_name}: {e}")
        
        # Проверяем, разрешены ли NULL значения в photo_id
        cursor.execute("""
            SELECT is_nullable 
            FROM information_schema.columns 
            WHERE table_name = 'core_photocomment' 
            AND column_name = 'photo_id';
        """)
        result = cursor.fetchone()
        is_nullable = result[0] if result else 'NO'
        
        if is_nullable == 'NO':
            # Изменяем поле photo_id, чтобы разрешить NULL
            try:
                cursor.execute("""
                    ALTER TABLE core_photocomment 
                    ALTER COLUMN photo_id DROP NOT NULL;
                """)
                print("Разрешены NULL значения в photo_id")
            except Exception as e:
                print(f"Ошибка при изменении поля photo_id: {e}")
                # Если не удалось, удаляем проблемные записи
                cursor.execute("DELETE FROM core_photocomment WHERE photo_id IS NULL OR photo_id NOT IN (SELECT id FROM core_photo);")
                cursor.execute("""
                    ALTER TABLE core_photocomment 
                    ALTER COLUMN photo_id DROP NOT NULL;
                """)
                print("Разрешены NULL значения в photo_id после очистки данных")
        
        # Проверяем, существует ли уже новый внешний ключ
        cursor.execute("""
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE table_name = 'core_photocomment' 
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = 'core_photocomment_photo_id_fk';
        """)
        fk_exists = cursor.fetchone()
        
        if not fk_exists:
            # Создаем новый внешний ключ с SET_NULL
            try:
                cursor.execute("""
                    ALTER TABLE core_photocomment 
                    ADD CONSTRAINT core_photocomment_photo_id_fk 
                    FOREIGN KEY (photo_id) 
                    REFERENCES core_photo(id) 
                    ON DELETE SET NULL;
                """)
                print("Создан новый внешний ключ с SET_NULL")
            except Exception as e:
                print(f"Ошибка при создании внешнего ключа: {e}")
                # Если не удалось создать, просто удаляем таблицу
                cursor.execute("DROP TABLE IF EXISTS core_photocomment CASCADE;")
                print("Удалена таблица core_photocomment после ошибки создания внешнего ключа")
        else:
            print("Внешний ключ core_photocomment_photo_id_fk уже существует")


def reverse_fix_photocomment_foreign_key(apps, schema_editor):
    """Обратная миграция - не требуется"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0031_change_photo_volunteer_on_delete'),
    ]

    operations = [
        migrations.RunPython(
            fix_photocomment_foreign_key,
            reverse_fix_photocomment_foreign_key,
        ),
    ]


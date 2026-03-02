# Generated migration to remove unused tables (core_photocomment and core_photolike)

from django.db import migrations


def remove_unused_tables(apps, schema_editor):
    """
    Удаляет неиспользуемые таблицы core_photocomment и core_photolike
    """
    from django.db import connection
    
    with connection.cursor() as cursor:
        # Проверяем и удаляем core_photocomment
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'core_photocomment'
            );
        """)
        if cursor.fetchone()[0]:
            cursor.execute("DROP TABLE IF EXISTS core_photocomment CASCADE;")
            print("Удалена таблица core_photocomment")
        
        # Проверяем и удаляем core_photolike
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'core_photolike'
            );
        """)
        if cursor.fetchone()[0]:
            cursor.execute("DROP TABLE IF EXISTS core_photolike CASCADE;")
            print("Удалена таблица core_photolike")


def reverse_remove_tables(apps, schema_editor):
    """Обратная миграция - не требуется, так как таблицы не используются"""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0048_remove_old_verification_models'),
    ]

    operations = [
        migrations.RunPython(remove_unused_tables, reverse_remove_tables),
    ]




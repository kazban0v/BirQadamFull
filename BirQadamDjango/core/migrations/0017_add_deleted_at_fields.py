# Generated migration for adding deleted_at fields
# ✅ ИСПРАВЛЕНИЕ СП-1: Добавление deleted_at к моделям с мягким удалением

from django.db import migrations, models
from django.utils import timezone


def populate_deleted_at(apps, schema_editor):
    """Заполняем deleted_at для существующих удаленных записей"""
    Task = apps.get_model('core', 'Task')
    Photo = apps.get_model('core', 'Photo')
    
    now = timezone.now()
    
    # Обновляем задачи
    deleted_tasks = Task.objects.filter(is_deleted=True, deleted_at__isnull=True)
    deleted_tasks.update(deleted_at=now)
    
    # Обновляем фотографии
    deleted_photos = Photo.objects.filter(is_deleted=True, deleted_at__isnull=True)
    deleted_photos.update(deleted_at=now)


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0016_alter_task_task_image'),
    ]

    operations = [
        migrations.AddField(
            model_name='task',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='photo',
            name='deleted_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        # Заполняем deleted_at для существующих удаленных записей
        migrations.RunPython(populate_deleted_at, migrations.RunPython.noop),
    ]


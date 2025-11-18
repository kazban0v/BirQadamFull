from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0026_message_delivered_at_message_is_delivered_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrganizerApplication',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('organization_name', models.CharField(max_length=255)),
                ('description', models.TextField(blank=True)),
                ('city', models.CharField(blank=True, max_length=100)),
                ('website', models.URLField(blank=True)),
                ('contact_person', models.CharField(blank=True, max_length=120)),
                ('status', models.CharField(choices=[('pending', 'Ожидает'), ('approved', 'Одобрено'), ('rejected', 'Отклонено')], db_index=True, default='pending', max_length=20)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('notes', models.TextField(blank=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='organizer_application', to='core.user')),
            ],
            options={
                'verbose_name': 'Заявка организатора',
                'verbose_name_plural': 'Заявки организаторов',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='organizerapplication',
            index=models.Index(fields=['status'], name='org_app_status_idx'),
        ),
        migrations.AddIndex(
            model_name='organizerapplication',
            index=models.Index(fields=['created_at'], name='org_app_created_idx'),
        ),
    ]


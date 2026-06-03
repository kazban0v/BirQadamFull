# Generated manually for VolunteerDocument model

import common.storage.upload_paths
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0005_volunteerreview'),
    ]

    operations = [
        migrations.CreateModel(
            name='VolunteerDocument',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('doc_type', models.CharField(
                    choices=[('resume', 'Резюме, презентация'), ('certificate', 'Диплом, сертификат, награда')],
                    max_length=20,
                    verbose_name='Тип документа',
                )),
                ('file', models.FileField(
                    upload_to=common.storage.upload_paths.volunteer_document_upload_path,
                    verbose_name='Файл',
                )),
                ('original_name', models.CharField(max_length=255, verbose_name='Исходное имя файла')),
                ('uploaded_at', models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Загружен')),
                ('volunteer', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='documents',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Волонтёр',
                )),
            ],
            options={
                'verbose_name': 'Документ волонтёра',
                'verbose_name_plural': 'Документы волонтёров',
                'ordering': ['-uploaded_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='volunteerdocument',
            constraint=models.UniqueConstraint(
                fields=('volunteer', 'doc_type'),
                name='unique_volunteer_doc_type',
            ),
        ),
    ]

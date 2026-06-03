# Generated manually for VolunteerReview model

import django.core.validators
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0004_block_report'),
    ]

    operations = [
        migrations.CreateModel(
            name='VolunteerReview',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('rating', models.PositiveSmallIntegerField(
                    validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(5)],
                    verbose_name='Оценка',
                )),
                ('text', models.TextField(max_length=2000, verbose_name='Текст отзыва')),
                ('is_published', models.BooleanField(db_index=True, default=True, verbose_name='Опубликован')),
                ('created_at', models.DateTimeField(auto_now_add=True, db_index=True)),
                ('organizer', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='given_reviews',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Организатор',
                )),
                ('photo', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='volunteer_reviews', to='api.photo',
                )),
                ('project', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='volunteer_reviews', to='api.project', verbose_name='Проект',
                )),
                ('task', models.ForeignKey(
                    blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                    related_name='volunteer_reviews', to='api.task',
                )),
                ('volunteer', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='received_reviews',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Волонтёр',
                )),
            ],
            options={
                'verbose_name': 'Отзыв о волонтёре',
                'verbose_name_plural': 'Отзывы о волонтёрах',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddIndex(
            model_name='volunteerreview',
            index=models.Index(fields=['volunteer', 'is_published', 'created_at'], name='vol_review_pub_idx'),
        ),
        migrations.AddConstraint(
            model_name='volunteerreview',
            constraint=models.UniqueConstraint(
                fields=('organizer', 'volunteer', 'project'),
                name='unique_volunteer_review_per_project',
            ),
        ),
    ]

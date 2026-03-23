"""
Projects domain models
Модели домена проектов
"""
from django.db import models
from django.utils import timezone
from taggit.managers import TaggableManager  # type: ignore[reportMissingTypeStubs]
from asgiref.sync import async_to_sync
import logging
from typing import Any
from common.storage.upload_paths import project_cover_upload_path

logger = logging.getLogger(__name__)


class Project(models.Model):
    """Модель проекта"""
    STATUS_CHOICES = (
        ('pending', 'Ожидает проверки'),
        ('approved', 'Одобрен'),
        ('rejected', 'Отклонён'),
    )
    VOLUNTEER_TYPE_CHOICES = (
        ('social', 'Социальная помощь'),
        ('environmental', 'Экологические проекты'),
        ('cultural', 'Культурные и развлекательные мероприятия'),
    )

    title = models.CharField(max_length=255)
    volunteer_type = models.CharField(
        max_length=20,
        choices=VOLUNTEER_TYPE_CHOICES,
        default='environmental',
        db_index=True,
        verbose_name='Тип волонтерства'
    )
    description = models.TextField()
    city = models.CharField(max_length=100, db_index=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    registration_date = models.DateTimeField(auto_now_add=True)
    # Lazy import для User
    creator = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='created_projects')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    tags = TaggableManager(blank=True)
    address = models.CharField(max_length=255, blank=True, default='')
    contact_person = models.CharField(max_length=120, blank=True, default='')
    contact_phone = models.CharField(max_length=30, blank=True, default='')
    contact_email = models.EmailField(blank=True, null=True)
    contact_telegram = models.CharField(max_length=150, blank=True, default='')
    info_url = models.URLField(blank=True, null=True)
    gis2_url = models.URLField(blank=True, null=True, max_length=500, verbose_name='Ссылка на 2ГИС')
    cover_image = models.ImageField(upload_to=project_cover_upload_path, null=True, blank=True, max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        from django.db import transaction
        # Lazy imports для связанных моделей
        from api.support.models import FeedbackSession
        from api.tasks.models import TaskAssignment
        
        with transaction.atomic():
            self.deleted_at = timezone.now()
            self.is_deleted = True
            self.save()

            # Незавершённые задачи → в архив (чтобы волонтёры видели во вкладке «В архиве»).
            # Завершённые задачи остаются со статусом 'completed'.
            # Trust factor при этом НЕ изменяется — архивирование автоматическое.
            self.tasks.filter(  # type: ignore[attr-defined]
                is_deleted=False
            ).exclude(
                status='completed'
            ).update(status='archived')

            # Мягко удаляем прочие связанные объекты (кроме задач — они остаются видимыми)
            self.photos.update(is_deleted=True)  # type: ignore[attr-defined]
            self.volunteer_projects.update(is_active=False)  # type: ignore[attr-defined]

            # Деактивируем связанные feedback сессии
            FeedbackSession.objects.filter(project=self, is_active=True).update(
                is_active=False,
                is_completed=True,
                completed_at=timezone.now()
            )

            # Закрываем открытые задания
            TaskAssignment.objects.filter(
                task__project=self,
                completed=False
            ).update(completed=False)

        return (1, {'api.Project': 1})

    def restore(self) -> None:
        self.deleted_at = None
        self.is_deleted = False
        self.save()

    def approve(self) -> None:
        """Отправляет уведомление об одобрении проекта."""
        from admin_panel.services.notification_service import NotificationService
        logger.info(f"Вызов approve для проекта {self.id}. Отправка уведомления для {self.creator.username}.")  # type: ignore[attr-defined]
        async_to_sync(NotificationService.notify_project_approved)(self.creator, self)

    def reject(self) -> None:
        """Отправляет уведомление об отклонении проекта."""
        from admin_panel.services.notification_service import NotificationService
        logger.info(f"Вызов reject для проекта {self.id}. Отправка уведомления для {self.creator.username}.")  # type: ignore[attr-defined]
        async_to_sync(NotificationService.notify_project_rejected)(self.creator, self)

    def __str__(self) -> str:
        return f"{self.title} (Creator: {self.creator.username})"

    class Meta:
        verbose_name = 'Проект'
        verbose_name_plural = 'Проекты'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'is_deleted'], name='project_status_deleted_idx'),
            models.Index(fields=['creator', 'is_deleted'], name='project_creator_deleted_idx'),
            models.Index(fields=['created_at', 'status'], name='project_created_status_idx'),
            models.Index(fields=['city', 'status'], name='project_city_status_idx'),
            models.Index(fields=['start_date'], name='project_start_date_idx'),
        ]


class VolunteerProject(models.Model):
    """Участие волонтера в проекте"""
    volunteer = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='volunteer_projects')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='volunteer_projects')
    joined_at = models.DateTimeField(auto_now_add=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['volunteer', 'project'], name='unique_volunteer_project')
        ]
        verbose_name = 'Участие волонтёра'
        verbose_name_plural = 'Участия волонтёров'
        ordering = ['-joined_at']
        indexes = [
            models.Index(fields=['is_active', 'joined_at'], name='vol_proj_active_joined_idx'),
        ]

    def __str__(self) -> str:
        return f"{self.volunteer.username} in {self.project.title} ({'active' if self.is_active else 'inactive'})"


class Event(models.Model):
    """События календаря - мероприятия, встречи, дедлайны"""
    
    EVENT_TYPE_CHOICES = (
        ('project_start', 'Начало проекта'),
        ('project_end', 'Завершение проекта'),
        ('task_deadline', 'Дедлайн задачи'),
        ('meeting', 'Встреча'),
        ('reminder', 'Напоминание'),
        ('custom', 'Свое событие'),
    )
    
    VISIBILITY_CHOICES = (
        ('public', 'Публичное'),
        ('private', 'Приватное'),
        ('project', 'Только участники проекта'),
    )
    
    # Основная информация
    title = models.CharField(max_length=200, verbose_name='Название')
    description = models.TextField(blank=True, verbose_name='Описание')
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES, default='custom', db_index=True)
    
    # Время и дата
    start_date = models.DateField(verbose_name='Дата начала', db_index=True)
    start_time = models.TimeField(null=True, blank=True, verbose_name='Время начала')
    end_date = models.DateField(null=True, blank=True, verbose_name='Дата окончания')
    end_time = models.TimeField(null=True, blank=True, verbose_name='Время окончания')
    
    # Связи
    creator = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='created_events', verbose_name='Создатель')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name='events', verbose_name='Проект')
    task = models.ForeignKey('api.Task', on_delete=models.CASCADE, null=True, blank=True, related_name='events', verbose_name='Задача')
    
    # Участники (для встреч)
    participants = models.ManyToManyField('api.User', related_name='event_participations', blank=True, verbose_name='Участники')
    
    # Настройки
    visibility = models.CharField(max_length=10, choices=VISIBILITY_CHOICES, default='public')
    location = models.CharField(max_length=200, blank=True, verbose_name='Место проведения')
    is_all_day = models.BooleanField(default=False, verbose_name='Весь день')
    
    # Напоминания
    reminder_minutes = models.IntegerField(null=True, blank=True, help_text='За сколько минут напомнить (15, 30, 60, 1440)')
    reminder_sent = models.BooleanField(default=False, verbose_name='Напоминание отправлено')
    
    # Служебные поля
    is_deleted = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Событие'
        verbose_name_plural = 'События'
        ordering = ['start_date', 'start_time']
        indexes = [
            models.Index(fields=['creator', 'start_date'], name='event_creator_date_idx'),
            models.Index(fields=['project', 'start_date'], name='event_project_date_idx'),
            models.Index(fields=['event_type', 'start_date'], name='event_type_date_idx'),
            models.Index(fields=['is_deleted', 'start_date'], name='event_deleted_date_idx'),
        ]
    
    def __str__(self) -> str:
        return f"{self.title} ({self.start_date})"
    
    def is_upcoming(self) -> bool:
        """Проверка, что событие еще не прошло"""
        now = timezone.now().date()
        return self.start_date >= now
    
    def get_participants_count(self) -> int:
        """Количество участников"""
        return self.participants.count()


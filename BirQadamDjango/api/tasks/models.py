"""
Tasks domain models
Модели домена задач
"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
from django.db import transaction
import logging
from typing import Any
from common.storage.upload_paths import task_image_upload_path, photo_upload_path

logger = logging.getLogger(__name__)


class Task(models.Model):
    """Модель задачи"""
    STATUS_CHOICES = (
        ('open', 'Открыто'),
        ('in_progress', 'В работе'),
        ('under_review', 'На проверке'),
        ('completed', 'Выполнено'),
        ('failed', 'Отклонено'),
        ('closed', 'Закрыто'),
        ('archived', 'В архиве'),
    )
    project = models.ForeignKey('api.Project', on_delete=models.CASCADE, related_name='tasks')
    creator = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='created_tasks')
    text = models.TextField()
    task_image = models.ImageField(upload_to=task_image_upload_path, null=True, blank=True, max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    deadline_date = models.DateField(null=True, blank=True, db_index=True)
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open', db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    decline_reason = models.TextField(null=True, blank=True, verbose_name='Причина отклонения')

    def is_expired(self) -> bool:
        now = timezone.localtime(timezone.now())

        if self.deadline_date:
            if now.date() > self.deadline_date:
                return True
            elif now.date() == self.deadline_date:
                if self.end_time and now.time() > self.end_time:
                    return True

        return False

    def close_if_expired(self) -> None:
        if self.is_expired() and self.status != 'completed':
            self.status = 'closed'
            self.save()
            logger.info(f"Task {self.id} closed due to expiration")  # type: ignore[attr-defined]

    def is_closed_and_not_completed(self) -> bool:
        if self.status == 'closed':
            return self.assignments.filter(completed=False).exists()  # type: ignore[attr-defined]
        return False

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        """Мягкое удаление задачи"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()
        return (1, {'api.Task': 1})

    def restore(self) -> None:
        """Восстановление удалённой задачи"""
        self.is_deleted = False
        self.deleted_at = None
        self.save()

    def retry(self) -> None:
        """
        Переделать отклоненную задачу - возвращает задачу в статус 'open' для повторного выполнения
        Очищает причину отклонения и сбрасывает назначения
        """
        if self.status != 'failed':
            raise ValueError(f"Задачу можно переделать только если она отклонена. Текущий статус: {self.status}")
        
        with transaction.atomic():
            # Возвращаем задачу в статус 'open'
            self.status = 'open'
            # Очищаем причину отклонения
            self.decline_reason = None
            self.save(update_fields=['status', 'decline_reason'])
            
            # Сбрасываем все назначения задачи (чтобы волонтеры могли заново принять задачу)
            self.assignments.update(
                accepted=False,
                completed=False,
                completed_at=None,
                rating=None,
                feedback=None
            )
            
            logger.info(f"Task {self.id} reopened for retry after being declined")  # type: ignore[attr-defined]

    def __str__(self) -> str:
        return f"Task {self.id} for {self.project.title}"  # type: ignore[attr-defined]

    class Meta:
        verbose_name = 'Задание'
        verbose_name_plural = 'Задания'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'project'], name='task_status_project_idx'),
            models.Index(fields=['deadline_date'], name='task_deadline_idx'),
        ]


class Photo(models.Model):
    """Модель фотоотчета"""
    STATUS_CHOICES = (
        ('pending', 'Ожидает проверки'),
        ('approved', 'Одобрен'),
        ('rejected', 'Отклонён'),
    )
    volunteer = models.ForeignKey('api.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='photos')
    project = models.ForeignKey('api.Project', on_delete=models.CASCADE, related_name='photos')
    task = models.ForeignKey(Task, on_delete=models.CASCADE, null=True, blank=True, related_name='task_photos')
    image = models.ImageField(upload_to=photo_upload_path)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    rating = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    feedback = models.TextField(null=True, blank=True)
    volunteer_comment = models.TextField(null=True, blank=True)
    organizer_comment = models.TextField(null=True, blank=True)
    rejection_reason = models.TextField(null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    moderated_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    is_before_after = models.BooleanField(default=False)

    def approve(self, rating: int | None = None, feedback: str | None = None) -> bool:
        # Lazy imports
        from api.users.models import User, Activity
        
        with transaction.atomic():
            updated = Photo.objects.filter(
                pk=self.pk,
                status='pending'
            ).update(
                status='approved',
                rating=rating,
                organizer_comment=feedback,
                moderated_at=timezone.now()
            )
            
            if updated == 0:
                logger.warning(f"Photo {self.pk} already approved or not found, skipping")
                return False
            
            photo = Photo.objects.select_for_update().get(pk=self.pk)
            
            if rating and photo.volunteer:
                volunteer = User.objects.select_for_update().get(pk=photo.volunteer.pk)
                volunteer.update_rating(rating)

            if photo.task:
                task = Task.objects.select_for_update().get(pk=photo.task.pk)
                task.status = 'completed'
                task.save()

                assignment = task.assignments.filter(volunteer=photo.volunteer).select_for_update().first()  # type: ignore[attr-defined]
                if assignment:
                    assignment.completed = True
                    assignment.completed_at = timezone.now()
                    assignment.rating = rating
                    assignment.feedback = feedback
                    assignment.save()

                logger.info(f"Task {task.id} marked as completed after photo approval")  # type: ignore[attr-defined]

            if photo.volunteer:
                Activity.objects.create(
                    user=photo.volunteer,
                    type='photo_uploaded',
                    title='Фото одобрено',
                    description=f'Ваше фото для проекта "{photo.project.title}" одобрено с оценкой {rating}' if rating else f'Ваше фото для проекта "{photo.project.title}" одобрено',
                    project=photo.project
                )
            
            logger.info(f"Photo {self.pk} approved successfully with rating {rating}")
            return True

    def reject(self, feedback: str | None = None) -> None:
        # Lazy import
        from api.users.models import User
        
        with transaction.atomic():
            self.status = 'rejected'
            self.rejection_reason = feedback
            self.moderated_at = timezone.now()
            self.save()
            
            if self.task:
                assignment = self.task.assignments.filter(volunteer=self.volunteer).first()
                if assignment:
                    assignment.completed = False
                    assignment.completed_at = None
                    assignment.feedback = feedback
                    assignment.save()

                self.task.status = 'in_progress'
                self.task.save()
                logger.info(f"Task {self.task.id} status changed to 'in_progress' after photo rejection - giving second chance")
                
                if self.volunteer:
                    user = User.objects.select_for_update().get(pk=self.volunteer.pk)
                    user._change_trust_factor(-1, 'photo_rejected', 'photo', self.id)
                    logger.info(f"Applied -1 Trust Factor penalty to {user.username} for rejected photo {self.id}")

    async def async_reject(self, context: Any) -> None:
        try:
            from admin_panel.services.notification_service import NotificationService
            from asgiref.sync import sync_to_async
            await sync_to_async(self.reject)()
            await NotificationService.notify_photo_rejected(self.volunteer, self, self.project)
        except Exception as e:
            logger.error(f"Ошибка при отклонении фото: {e}")
            raise

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        """Мягкое удаление фотоотчёта"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()
        return (1, {'api.Photo': 1})

    def restore(self) -> None:
        """Восстановление удалённого фотоотчёта"""
        self.is_deleted = False
        self.deleted_at = None
        self.save()

    def __str__(self) -> str:
        return f"Фото {self.id} от {self.volunteer.username if self.volunteer else 'Unknown'} ({self.get_status_display()})"  # type: ignore[attr-defined]

    class Meta:
        verbose_name = 'Фотоотчёт'
        verbose_name_plural = 'Фотоотчёты'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['status', 'uploaded_at'], name='photo_status_uploaded_idx'),
            models.Index(fields=['moderated_at'], name='photo_moderated_at_idx'),
            models.Index(fields=['volunteer', 'status'], name='photo_volunteer_status_idx'),
            models.Index(fields=['project', 'status'], name='photo_project_status_idx'),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(rating__isnull=True) | (models.Q(rating__gte=1) & models.Q(rating__lte=5)),
                name='photo_rating_range'
            ),
        ]


class TaskAssignment(models.Model):
    """Назначение задачи волонтеру"""
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='assignments')
    volunteer = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='assignments')
    accepted = models.BooleanField(default=False, db_index=True)
    completed = models.BooleanField(default=False, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True, db_index=True)
    rating = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    feedback = models.TextField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['task', 'volunteer'], name='unique_task_volunteer'),
            models.CheckConstraint(
                check=models.Q(rating__isnull=True) | (models.Q(rating__gte=1) & models.Q(rating__lte=5)),
                name='task_assignment_rating_range'
            ),
        ]
        verbose_name = 'Назначение задания'
        verbose_name_plural = 'Назначения заданий'
        ordering = ['-completed_at']

    def __str__(self) -> str:
        return f"{self.volunteer.username} -> {self.task} ({'completed' if self.completed else 'pending'})"


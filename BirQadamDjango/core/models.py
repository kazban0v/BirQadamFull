from django.db import models
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator, MaxValueValidator, RegexValidator
from taggit.managers import TaggableManager  # type: ignore[reportMissingTypeStubs]
from django.utils import timezone
import os
import logging
from asgiref.sync import async_to_sync
from datetime import time
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from typing import Protocol

logger = logging.getLogger(__name__)

def photo_upload_path(instance: Any, filename: str) -> str:
    date = timezone.now().strftime("%Y/%m/%d")
    return os.path.join('photos', date, filename)

def task_image_upload_path(instance: Any, filename: str) -> str:
    date = timezone.now().strftime("%Y/%m/%d")
    return os.path.join('tasks', date, filename)

def project_cover_upload_path(instance: Any, filename: str) -> str:
    date = timezone.now().strftime("%Y/%m/%d")
    return os.path.join('projects', date, filename)

class User(AbstractUser):

    telegram_id = models.CharField(max_length=50, unique=True, blank=True, null=True)  # unique уже создает индекс
    phone_number = models.CharField(
        max_length=15,
        unique=True,
        blank=True,
        null=True,
        validators=[RegexValidator(regex=r'^\+?\d{10,15}$', message="Номер телефона должен быть в формате: '+1234567890'.")]
    )
    organization_name = models.CharField(max_length=255, blank=True, null=True)
    rating = models.IntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(750)])  # Рейтинг волонтера
    is_organizer = models.BooleanField(default=False)  # Индекс будет создан через Meta.indexes
    is_admin = models.BooleanField(default=False)
    # Добавляем поле name
    name = models.CharField(max_length=100, blank=True, null=True, default='')  # Поле для имени пользователя
    # Поле role (добавлено ранее)
    role = models.CharField(
        max_length=20,
        choices=(('volunteer', 'Волонтёр'), ('organizer', 'Организатор')),
        default='volunteer',
        blank=True,
        null=True
    )
    # Поле для одобрения организатора администратором
    is_approved = models.BooleanField(default=False)

    ORGANIZER_STATUS_CHOICES = (
        ('pending', 'Ожидает'),
        ('approved', 'Одобрен'),
        ('rejected', 'Отклонен'),
    )
    organizer_status = models.CharField(
        max_length=10,
        choices=ORGANIZER_STATUS_CHOICES,
        default='pending',
        db_index=True
    )
    # Поле для аватара профиля
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    REGISTRATION_SOURCE_CHOICES = (
        ('mobile_app', 'Mobile App'),
        ('telegram_bot', 'Telegram Bot'),
        ('telegram', 'Telegram (legacy)'),
        ('web_portal', 'Web Portal'),
        ('both', 'Mobile + Telegram'),
    )

    registration_source = models.CharField(
        max_length=20,
        choices=REGISTRATION_SOURCE_CHOICES,
        default='mobile_app',
        blank=True,
        null=True
    )
    
    # Портфолио организатора
    age = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(18), MaxValueValidator(100)], verbose_name='Возраст')
    GENDER_CHOICES = (
        ('male', 'Мужской'),
        ('female', 'Женский'),
        ('other', 'Другое'),
    )
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True, verbose_name='Пол')
    bio = models.TextField(blank=True, null=True, verbose_name='О себе')
    work_experience_years = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(0), MaxValueValidator(100)], verbose_name='Стаж работы (лет)')
    work_history = models.TextField(blank=True, null=True, verbose_name='Опыт работы')
    portfolio_photo = models.ImageField(upload_to='portfolio_photos/', null=True, blank=True, verbose_name='Фото 3х4')

    def update_rating(self, points: int) -> None:
        old_rating = self.rating
        self.rating = max(0, min(750, self.rating + points))
        self.save()

        # Проверяем и разблокируем новые достижения
        if self.rating > old_rating:
            self.check_and_unlock_achievements()

    def check_and_unlock_achievements(self) -> None:
        """Проверить и разблокировать достижения на основе рейтинга"""
        # Получаем все достижения, которые пользователь может разблокировать
        available_achievements = Achievement.objects.filter(
            required_rating__lte=self.rating
        ).exclude(
            user_achievements__user=self
        )

        for achievement in available_achievements:
            # Создаем связь пользователь-достижение
            UserAchievement.objects.create(
                user=self,
                achievement=achievement
            )

            # Создаем активность
            Activity.objects.create(
                user=self,
                type='achievement_unlocked',
                title=f'Разблокировано достижение: {achievement.name}',
                description=f'Поздравляем! Вы получили достижение "{achievement.name}" за достижение {achievement.required_rating} рейтинга!'
            )

            logger.info(f"User {self.username} unlocked achievement: {achievement.name}")

    def save(self, *args: Any, **kwargs: Any) -> None:
        # ✅ ИСПРАВЛЕНИЕ СП-6: Автоматическая нормализация телефона
        if self.phone_number:
            from core.utils.utils import normalize_phone
            self.phone_number = normalize_phone(self.phone_number)
        
        if self.role == 'organizer' and self.is_approved:
            self.is_organizer = True
        else:
            self.is_organizer = False

        # Проверяем, изменился ли рейтинг при обновлении через админку
        should_check_achievements = False
        if self.pk:
            try:
                old_instance = User.objects.filter(pk=self.pk).first()
                if old_instance and old_instance.rating != self.rating:
                    # Рейтинг изменился, нужно проверить достижения после сохранения
                    should_check_achievements = True
                    logger.info(f"User {self.username} rating changed: {old_instance.rating} -> {self.rating}")
            except Exception as e:
                logger.error(f"Error checking rating change: {e}")

        super().save(*args, **kwargs)

        # Проверяем достижения после сохранения
        if should_check_achievements:
            logger.info(f"Triggering achievement check for {self.username}")
            self.check_and_unlock_achievements()

    def __str__(self) -> str:
        role_display = 'Admin' if self.is_admin else ('Organizer' if self.role == 'organizer' else 'Volunteer')
        return f"{self.username} (ID: {self.telegram_id}, Role: {role_display})"

    class Meta:
        verbose_name = 'Пользователь'
        verbose_name_plural = 'Пользователи'
        ordering = ['-rating', 'username']
        indexes = [
            # Составной индекс для фильтрации организаторов
            models.Index(fields=['role', 'is_approved'], name='user_role_approved_idx'),
            models.Index(fields=['is_organizer'], name='user_is_organizer_idx'),
            # ✅ Индекс для быстрой фильтрации по статусу организатора и дате
            models.Index(fields=['organizer_status', 'date_joined'], name='user_org_status_joined_idx'),
            # Индекс для поиска по telegram_id уже создается через unique=True
        ]
        # ✅ ИСПРАВЛЕНИЕ: DB Constraints для критичных полей
        constraints = [
            models.CheckConstraint(
                check=models.Q(rating__gte=0) & models.Q(rating__lte=500),
                name='user_rating_range'
            ),
        ]


class OrganizerApplication(models.Model):
    STATUS_CHOICES = (
        ('pending', 'Ожидает'),
        ('approved', 'Одобрено'),
        ('rejected', 'Отклонено'),
    )

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='organizer_application')
    organization_name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    website = models.URLField(blank=True)
    contact_person = models.CharField(max_length=120, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True)

    def __str__(self) -> str:
        return f"{self.organization_name} ({self.get_status_display()})"

    class Meta:
        verbose_name = 'Заявка организатора'
        verbose_name_plural = 'Заявки организаторов'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status'], name='org_app_status_idx'),
            models.Index(fields=['created_at'], name='org_app_created_idx'),
        ]


class Project(models.Model):
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
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_projects')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    tags = TaggableManager(blank=True)
    address = models.CharField(max_length=255, blank=True, default='')
    contact_person = models.CharField(max_length=120, blank=True, default='')
    contact_phone = models.CharField(max_length=30, blank=True, default='')
    contact_email = models.EmailField(blank=True, null=True)
    contact_telegram = models.CharField(max_length=150, blank=True, default='')
    info_url = models.URLField(blank=True, null=True)
    cover_image = models.ImageField(upload_to=project_cover_upload_path, null=True, blank=True, max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False, db_index=True)

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        from django.db import transaction
        with transaction.atomic():
            self.deleted_at = timezone.now()
            self.is_deleted = True
            self.save()

            # Мягко удаляем связанные объекты
            self.tasks.update(is_deleted=True)  # type: ignore[attr-defined]
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
            ).update(completed=False)  # Помечаем как незавершенные

        # Возвращаем результат как у родительского метода
        return (1, {'core.Project': 1})

    def restore(self) -> None:
        self.deleted_at = None
        self.is_deleted = False
        self.save()

    def approve(self) -> None:
        """Отправляет уведомление об одобрении проекта."""
        from custom_admin.services.notification_service import NotificationService
        logger.info(f"Вызов approve для проекта {self.id}. Отправка уведомления для {self.creator.username}.")  # type: ignore[attr-defined]
        async_to_sync(NotificationService.notify_project_approved)(self.creator, self)

    def reject(self) -> None:
        """Отправляет уведомление об отклонении проекта."""
        from custom_admin.services.notification_service import NotificationService
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
            # ✅ ИСПРАВЛЕНИЕ: Дополнительные индексы для оптимизации
            models.Index(fields=['city', 'status'], name='project_city_status_idx'),
            models.Index(fields=['start_date'], name='project_start_date_idx'),
        ]

class VolunteerProject(models.Model):
    volunteer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='volunteer_projects')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='volunteer_projects')
    joined_at = models.DateTimeField(auto_now_add=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)  # Индекс для фильтрации активных участников

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

class Task(models.Model):
    STATUS_CHOICES = (
        ('open', 'Открыто'),
        ('in_progress', 'В работе'),
        ('completed', 'Выполнено'),
        ('failed', 'Отклонено'),
        ('closed', 'Закрыто'),
    )
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='tasks')
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_tasks')
    text = models.TextField()
    task_image = models.ImageField(upload_to=task_image_upload_path, null=True, blank=True, max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    deadline_date = models.DateField(null=True, blank=True, db_index=True)  # Индекс для фильтрации по дедлайну
    start_time = models.TimeField(null=True, blank=True)
    end_time = models.TimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open', db_index=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)  # ✅ ИСПРАВЛЕНИЕ СП-1: Добавлено поле deleted_at

    def is_expired(self) -> bool:
        now = timezone.now()

        # Если есть deadline_date, проверяем его
        if self.deadline_date:
            if now.date() > self.deadline_date:
                return True
            elif now.date() == self.deadline_date:
                # Если есть end_time, проверяем время
                if self.end_time and now.time() > self.end_time:
                    return True
                # Если нет end_time, задача не истекает в день дедлайна
                # (предполагаем, что задача на весь день)

        return False

    def close_if_expired(self) -> None:
        if self.is_expired() and self.status != 'completed':
            self.status = 'closed'
            self.save()
            logger.info(f"Task {self.id} closed due to expiration")  # type: ignore[attr-defined]

    def is_closed_and_not_completed(self) -> bool:
        if self.status == 'closed':
            # Проверяем, есть ли назначения, которые не завершены
            return self.assignments.filter(completed=False).exists()  # type: ignore[attr-defined]
        return False

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        """✅ ИСПРАВЛЕНИЕ СП-1: Мягкое удаление задачи"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()
        return (1, {'core.Task': 1})

    def restore(self) -> None:
        """✅ ИСПРАВЛЕНИЕ СП-1: Восстановление удалённой задачи"""
        self.is_deleted = False
        self.deleted_at = None
        self.save()

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
    STATUS_CHOICES = (
        ('pending', 'Ожидает проверки'),
        ('approved', 'Одобрен'),
        ('rejected', 'Отклонён'),
    )
    volunteer = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='photos')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='photos')
    task = models.ForeignKey(Task, on_delete=models.CASCADE, null=True, blank=True, related_name='task_photos')
    image = models.ImageField(upload_to=photo_upload_path)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', db_index=True)
    rating = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    feedback = models.TextField(null=True, blank=True)  # Комментарий волонтёра при отправке
    volunteer_comment = models.TextField(null=True, blank=True)  # Комментарий волонтёра
    organizer_comment = models.TextField(null=True, blank=True)  # Комментарий организатора при модерации
    rejection_reason = models.TextField(null=True, blank=True)  # Причина отклонения
    uploaded_at = models.DateTimeField(auto_now_add=True, db_index=True)
    moderated_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)  # ✅ ИСПРАВЛЕНИЕ СП-1: Добавлено поле deleted_at
    is_before_after = models.BooleanField(default=False)  # Фото до/после

    def approve(self, rating: int | None = None, feedback: str | None = None) -> bool:
        from django.db import transaction
        with transaction.atomic():
            # ✅ ИСПРАВЛЕНИЕ Race Condition: Атомарный update вместо get + save
            updated = Photo.objects.filter(
                pk=self.pk,
                status='pending'  # ✅ Обновляем только если статус pending
            ).update(
                status='approved',
                rating=rating,
                organizer_comment=feedback,
                moderated_at=timezone.now()
            )
            
            # Если обновление не произошло (уже approved или не найдено)
            if updated == 0:
                logger.warning(f"Photo {self.pk} already approved or not found, skipping")
                return False
            
            # Обновляем объект из БД после атомарного update
            photo = Photo.objects.select_for_update().get(pk=self.pk)
            
            if rating:
                # Блокируем волонтера для обновления рейтинга
                volunteer = User.objects.select_for_update().get(pk=photo.volunteer.pk)
                volunteer.update_rating(rating)

            # Обновляем статус задачи на "completed" если есть связанная задача
            if photo.task:
                # Блокируем задачу для обновления
                task = Task.objects.select_for_update().get(pk=photo.task.pk)
                task.status = 'completed'
                task.save()

                # Обновляем assignment
                assignment = task.assignments.filter(volunteer=photo.volunteer).select_for_update().first()  # type: ignore[attr-defined]
                if assignment:
                    assignment.completed = True
                    assignment.completed_at = timezone.now()
                    assignment.rating = rating
                    assignment.feedback = feedback
                    assignment.save()

                logger.info(f"Task {task.id} marked as completed after photo approval")  # type: ignore[attr-defined]

            # Создаём активность
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
        from django.db import transaction
        with transaction.atomic():
            self.status = 'rejected'
            self.rejection_reason = feedback  # Причина отклонения
            self.moderated_at = timezone.now()
            self.save()
            if self.task:
                assignment = self.task.assignments.filter(volunteer=self.volunteer).first()
                if assignment:
                    assignment.completed = False
                    assignment.completed_at = None
                    assignment.feedback = feedback  # Сохраняем причину отклонения
                    assignment.save()

                # Возвращаем статус задачи в 'failed' при отклонении
                self.task.status = 'failed'
                self.task.save()
                logger.info(f"Task {self.task.id} status changed to 'failed' after photo rejection")

    async def async_reject(self, context: Any) -> None:
        try:
            from custom_admin.services.notification_service import NotificationService
            # Выполняем reject в sync_to_async
            from asgiref.sync import sync_to_async
            await sync_to_async(self.reject)()
            # Используем новый notification service для отправки уведомления
            await NotificationService.notify_photo_rejected(self.volunteer, self, self.project)
        except Exception as e:
            logger.error(f"Ошибка при отклонении фото: {e}")
            raise

    def delete(self, *args: Any, **kwargs: Any) -> tuple[int, dict[str, int]]:
        """✅ ИСПРАВЛЕНИЕ СП-1: Мягкое удаление фотоотчёта"""
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save()
        return (1, {'core.Photo': 1})

    def restore(self) -> None:
        """✅ ИСПРАВЛЕНИЕ СП-1: Восстановление удалённого фотоотчёта"""
        self.is_deleted = False
        self.deleted_at = None
        self.save()

    def __str__(self) -> str:
        return f"Фото {self.id} от {self.volunteer.username} ({self.get_status_display()})"  # type: ignore[attr-defined]

    class Meta:
        verbose_name = 'Фотоотчёт'
        verbose_name_plural = 'Фотоотчёты'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['status', 'uploaded_at'], name='photo_status_uploaded_idx'),
            models.Index(fields=['moderated_at'], name='photo_moderated_at_idx'),
            # ✅ ИСПРАВЛЕНИЕ: Дополнительные индексы для оптимизации
            models.Index(fields=['volunteer', 'status'], name='photo_volunteer_status_idx'),
            models.Index(fields=['project', 'status'], name='photo_project_status_idx'),
        ]
        # ✅ ИСПРАВЛЕНИЕ: DB Constraints для rating
        constraints = [
            models.CheckConstraint(
                check=models.Q(rating__isnull=True) | (models.Q(rating__gte=1) & models.Q(rating__lte=5)),
                name='photo_rating_range'
            ),
        ]

class TaskAssignment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name='assignments')
    volunteer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='assignments')
    accepted = models.BooleanField(default=False, db_index=True)  # Индекс для фильтрации принятых заданий
    completed = models.BooleanField(default=False, db_index=True)  # Индекс для фильтрации завершенных заданий
    completed_at = models.DateTimeField(null=True, blank=True, db_index=True)  # Индекс для сортировки по дате завершения
    rating = models.IntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    feedback = models.TextField(null=True, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['task', 'volunteer'], name='unique_task_volunteer'),
            # ✅ ИСПРАВЛЕНИЕ: DB Constraints для rating
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

class FeedbackSession(models.Model):
    organizer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='feedback_sessions')
    volunteer = models.ForeignKey(User, on_delete=models.CASCADE, related_name='volunteer_feedback_sessions')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='feedback_sessions')
    task = models.ForeignKey(Task, on_delete=models.SET_NULL, null=True, blank=True)
    photo = models.ForeignKey(Photo, on_delete=models.SET_NULL, null=True, blank=True)
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)], null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = 'Сессия обратной связи'
        verbose_name_plural = 'Сессии обратной связи'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['project', 'is_active'], name='feedback_session_project_idx'),
        ]

    def __str__(self) -> str:
        return f"Feedback for {self.volunteer.username} on {self.project.title}"

    @classmethod
    def get_or_create_for_photo(cls, photo: Any) -> Any:
        """Получить или создать feedback сессию для фотоотчета"""
        # Ищем существующую активную сессию для этого волонтера и проекта
        session = cls.objects.filter(
            volunteer=photo.volunteer,
            project=photo.project,
            is_active=True
        ).first()

        if not session:
            # Создаем новую сессию
            session = cls.objects.create(
                organizer=photo.project.creator,
                volunteer=photo.volunteer,
                project=photo.project,
                is_active=True
            )

        return session

class FeedbackMessage(models.Model):
    MESSAGE_TYPE_CHOICES = (
        ('text', 'Текстовое сообщение'),
        ('photo', 'Фотоотчет'),
        ('system', 'Системное сообщение'),
    )

    session = models.ForeignKey(FeedbackSession, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField(blank=True)  # Может быть пустым для фото
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, default='text')

    # Связь с фотоотчетом (если это сообщение о фото)
    photo = models.ForeignKey(Photo, on_delete=models.SET_NULL, null=True, blank=True, related_name='feedback_messages')

    # Telegram интеграция
    telegram_message_id = models.BigIntegerField(null=True, blank=True, db_index=True)  # ID сообщения в Telegram

    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    is_spam = models.BooleanField(default=False)  # Отмечен как спам
    is_flagged = models.BooleanField(default=False)  # Автоматически помечен системой

    def check_spam(self) -> bool:
        """Проверка сообщения на наличие спама/цензурных слов"""
        import re

        # Не проверяем фото и системные сообщения
        if self.message_type in ['photo', 'system'] or not self.text:
            return False

        # Список цензурных слов (можно расширить)
        profanity_words = [
            'дурак', 'идиот', 'тупой', 'урод', 'козел', 'свинья',
            'придурок', 'дебил', 'дура', 'мудак', 'хрен', 'чёрт',
            'блин', 'черт', 'гад', 'сволочь', 'негодяй', 'подонок',
            # Добавьте больше слов по необходимости
        ]

        text_lower = self.text.lower()

        # Проверяем на наличие цензурных слов
        for word in profanity_words:
            if re.search(r'\b' + re.escape(word) + r'\b', text_lower):
                self.is_flagged = True
                return True

        # Проверка на большое количество заглавных букв (КАПС)
        if len(self.text) > 10:
            caps_ratio = sum(1 for c in self.text if c.isupper()) / len(self.text)
            if caps_ratio > 0.7:
                self.is_flagged = True
                return True

        # Проверка на повторяющиеся символы (например, "аааааа")
        if re.search(r'(.)\1{5,}', self.text):
            self.is_flagged = True
            return True

        return False

    @classmethod
    def create_from_telegram(cls, session: Any, sender: Any, text: str = '', message_type: str = 'text', photo: Any = None, telegram_message_id: int | None = None) -> Any:
        """Создать сообщение из Telegram"""
        message = cls.objects.create(
            session=session,
            sender=sender,
            text=text,
            message_type=message_type,
            photo=photo,
            telegram_message_id=telegram_message_id
        )
        return message

    def get_display_text(self) -> str:
        """Получить текст для отображения"""
        if self.message_type == 'photo':
            if self.photo:
                return f"📸 Фотоотчет: {self.text}" if self.text else "📸 Фотоотчет"
            return "📸 Фотография"
        elif self.message_type == 'system':
            return f"ℹ️ {self.text}"
        return self.text

    def save(self, *args: Any, **kwargs: Any) -> None:
        # Автоматическая проверка на спам при сохранении
        if not self.pk:  # Только для новых сообщений
            self.check_spam()
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['session', 'timestamp'], name='feedback_msg_session_time_idx'),
            models.Index(fields=['is_spam'], name='feedback_msg_spam_idx'),
        ]

class DeviceToken(models.Model):
    """Модель для хранения FCM токенов устройств пользователей"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='device_tokens')
    token = models.TextField(unique=True)  # FCM токен устройства
    platform = models.CharField(max_length=20, choices=(
        ('android', 'Android'),
        ('ios', 'iOS'),
    ), default='android')
    device_name = models.CharField(max_length=255, blank=True, null=True)  # Название устройства для идентификации
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(auto_now=True)  # Последнее использование для автоочистки

    class Meta:
        verbose_name = 'Токен устройства'
        verbose_name_plural = 'Токены устройств'
        # Удалена constraint unique_user_platform_token - теперь пользователь может иметь несколько устройств одной платформы
        indexes = [
            models.Index(fields=['user', 'is_active'], name='device_token_user_active_idx'),
            models.Index(fields=['token'], name='device_token_token_idx'),
            models.Index(fields=['last_used_at'], name='device_token_last_used_idx'),
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        """✅ ИСПРАВЛЕНИЕ СП-10: Защита от дубликатов FCM токенов"""
        # Деактивируем все токены с таким же token для других пользователей
        if self.token:
            DeviceToken.objects.filter(token=self.token).exclude(pk=self.pk).update(is_active=False)
            logger.info(f"Deactivated duplicate tokens for token: {self.token[:20]}...")
        
        super().save(*args, **kwargs)
    
    def mark_as_used(self) -> None:
        """Обновить время последнего использования"""
        self.last_used_at = timezone.now()
        self.save(update_fields=['last_used_at'])

    def __str__(self) -> str:
        device_info = f" ({self.device_name})" if self.device_name else ""
        return f"{self.user.username} - {self.platform}{device_info} ({'active' if self.is_active else 'inactive'})"


class Activity(models.Model):
    """Модель для отслеживания активности волонтеров"""
    ACTIVITY_TYPE_CHOICES = (
        ('project_joined', 'Присоединился к проекту'),
        ('project_left', 'Покинул проект'),
        ('task_assigned', 'Новое задание'),
        ('task_completed', 'Задача выполнена'),
        ('photo_uploaded', 'Фото загружено'),
        ('achievement_unlocked', 'Достижение разблокировано'),
    )

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='activities')
    type = models.CharField(max_length=30, choices=ACTIVITY_TYPE_CHOICES, db_index=True)
    title = models.CharField(max_length=255)
    description = models.TextField()
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name='activities')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        verbose_name = 'Активность'
        verbose_name_plural = 'Активности'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at'], name='activity_user_created_idx'),
            models.Index(fields=['type', 'created_at'], name='activity_type_created_idx'),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.get_type_display()} - {self.created_at.strftime('%Y-%m-%d %H:%M')}"  # type: ignore[attr-defined]


class Achievement(models.Model):
    """Модель достижений для волонтеров"""
    name = models.CharField(max_length=100, verbose_name='Название')
    description = models.TextField(verbose_name='Описание')
    icon = models.CharField(max_length=50, default='star', verbose_name='Иконка')
    required_rating = models.IntegerField(default=0, validators=[MinValueValidator(0)], verbose_name='Требуемый рейтинг')
    xp = models.IntegerField(default=0, validators=[MinValueValidator(0)], verbose_name='Опыт (XP)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Достижение'
        verbose_name_plural = 'Достижения'
        ordering = ['required_rating']

    def __str__(self) -> str:
        return f"{self.name} (Рейтинг: {self.required_rating})"


class UserAchievement(models.Model):
    """Модель связи пользователей и достижений"""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='user_achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name='user_achievements')
    unlocked_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args: Any, **kwargs: Any) -> None:
        """✅ ИСПРАВЛЕНИЕ СП-8: Инвалидация кеша при разблокировке достижения"""
        super().save(*args, **kwargs)
        
        # Инвалидируем кеш достижений пользователя
        from django.core.cache import cache
        cache_key = f'achievements_user_{self.user.id}'
        cache.delete(cache_key)
        logger.info(f"Cache invalidated for user {self.user.id} achievements")
    
    class Meta:
        verbose_name = 'Достижение пользователя'
        verbose_name_plural = 'Достижения пользователей'
        unique_together = ['user', 'achievement']
        ordering = ['-unlocked_at']
        indexes = [
            models.Index(fields=['user', 'unlocked_at'], name='user_ach_user_unlocked_idx'),
        ]

    def __str__(self) -> str:
        return f"{self.user.username} - {self.achievement.name}"


# ==================== МАССОВЫЕ РАССЫЛКИ ====================

class NotificationTemplate(models.Model):
    """Шаблоны для массовых рассылок"""
    TEMPLATE_TYPES = (
        ('welcome', '🎉 Приветствие'),
        ('reminder', '⏰ Напоминание'),
        ('thanks', '🏆 Благодарность'),
        ('announcement', '📢 Объявление'),
        ('custom', '✨ Свой шаблон'),
    )
    
    name = models.CharField(max_length=200, verbose_name='Название шаблона')
    template_type = models.CharField(max_length=20, choices=TEMPLATE_TYPES, default='custom', verbose_name='Тип')
    subject = models.CharField(max_length=200, verbose_name='Тема')
    message = models.TextField(verbose_name='Текст сообщения')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Поддержка переменных в шаблоне: {{name}}, {{city}}, {{rating}}
    
    class Meta:
        verbose_name = 'Шаблон уведомления'
        verbose_name_plural = 'Шаблоны уведомлений'
        ordering = ['-created_at']
    
    def __str__(self) -> str:
        return f"{self.get_template_type_display()} - {self.name}"  # type: ignore[attr-defined]


class BulkNotification(models.Model):
    """Массовая рассылка уведомлений"""
    NOTIFICATION_TYPES = (
        ('email', 'Email'),
        ('push', 'Push уведомление'),
        ('both', 'Email + Push'),
    )
    
    STATUS_CHOICES = (
        ('draft', 'Черновик'),
        ('scheduled', 'Запланировано'),
        ('in_progress', 'В процессе'),
        ('sending', 'Отправляется'),
        ('sent', 'Отправлено'),
        ('completed', 'Завершено'),
        ('failed', 'Ошибка'),
    )
    
    # Основная информация
    created_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bulk_notifications')
    notification_type = models.CharField(max_length=10, choices=NOTIFICATION_TYPES, default='push', verbose_name='Тип рассылки')
    template = models.ForeignKey(NotificationTemplate, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Шаблон')
    
    # Содержание
    subject = models.CharField(max_length=200, verbose_name='Тема')
    message = models.TextField(verbose_name='Сообщение')
    
    # Фильтры получателей
    filter_city = models.CharField(max_length=100, blank=True, null=True, verbose_name='Город')
    filter_rating_min = models.IntegerField(default=0, validators=[MinValueValidator(0)], verbose_name='Мин. рейтинг')
    filter_rating_max = models.IntegerField(default=100, validators=[MinValueValidator(0)], verbose_name='Макс. рейтинг')
    filter_active_days = models.IntegerField(default=30, help_text='Активные за последние N дней', verbose_name='Активность (дни)')
    filter_role = models.CharField(max_length=20, choices=(('all', 'Все'), ('volunteer', 'Волонтёры'), ('organizer', 'Организаторы')), default='all')
    
    # Статистика
    total_recipients = models.IntegerField(default=0, verbose_name='Всего получателей')
    sent_count = models.IntegerField(default=0, verbose_name='Отправлено')
    delivered_count = models.IntegerField(default=0, verbose_name='Доставлено')
    opened_count = models.IntegerField(default=0, verbose_name='Открыто')
    clicked_count = models.IntegerField(default=0, verbose_name='Кликнуто')
    failed_count = models.IntegerField(default=0, verbose_name='Ошибок')
    
    # Метаданные
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='Статус')
    scheduled_at = models.DateTimeField(null=True, blank=True, verbose_name='Время отправки')
    sent_at = models.DateTimeField(null=True, blank=True, verbose_name='Отправлено в')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'Массовая рассылка'
        verbose_name_plural = 'Массовые рассылки'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'scheduled_at'], name='bulk_notif_status_sched_idx'),
            models.Index(fields=['created_by', 'created_at'], name='bulk_notif_creator_idx'),
        ]
    
    def __str__(self) -> str:
        return f"{self.subject} ({self.total_recipients} получателей) - {self.get_status_display()}"  # type: ignore[attr-defined]
    
    def get_filtered_recipients(self) -> Any:
        """Получить отфильтрованных получателей"""
        queryset = User.objects.all()
        
        # Фильтр по роли
        if self.filter_role == 'volunteer':
            queryset = queryset.filter(role='volunteer')
        elif self.filter_role == 'organizer':
            queryset = queryset.filter(role='organizer')
        
        # Фильтр по городу (ОТКЛЮЧЕНО - User не имеет поля city)
        # if self.filter_city:
        #     queryset = queryset.filter(city__icontains=self.filter_city)
        
        # Фильтр по рейтингу
        queryset = queryset.filter(
            rating__gte=self.filter_rating_min,
            rating__lte=self.filter_rating_max
        )
        
        # Фильтр по активности (безопасное преобразование)
        if self.filter_active_days:
            try:
                days = int(self.filter_active_days)
                if days > 0:
                    from datetime import timedelta
                    from django.db.models import Q
                    active_since = timezone.now() - timedelta(days=days)
                    # Включаем пользователей, которые активны ИЛИ никогда не логинились (last_login=NULL)
                    queryset = queryset.filter(
                        Q(last_login__gte=active_since) | Q(last_login__isnull=True)
                    )
            except (ValueError, TypeError):
                # Игнорируем некорректные значения
                pass
        
        return queryset


class NotificationRecipient(models.Model):
    """Отслеживание доставки уведомления получателю"""
    STATUS_CHOICES = (
        ('pending', 'Ожидает'),
        ('sent', 'Отправлено'),
        ('delivered', 'Доставлено'),
        ('opened', 'Открыто'),
        ('clicked', 'Кликнуто'),
        ('failed', 'Ошибка'),
    )
    
    notification = models.ForeignKey(BulkNotification, on_delete=models.CASCADE, related_name='recipients')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notification_receipts')
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    error_message = models.TextField(blank=True, null=True)
    
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    opened_at = models.DateTimeField(null=True, blank=True)
    clicked_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Получатель уведомления'
        verbose_name_plural = 'Получатели уведомлений'
        unique_together = ['notification', 'user']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['notification', 'status'], name='notif_recip_notif_status_idx'),
            models.Index(fields=['user', 'status'], name='notif_recip_user_status_idx'),
        ]
    
    def __str__(self) -> str:
        return f"{self.user.username} - {self.notification.subject} ({self.get_status_display()})"  # type: ignore[attr-defined]


# ==================== СОХРАНЕННЫЕ ФИЛЬТРЫ ПОИСКА ====================

class UserSearchFilter(models.Model):
    """Сохраненные фильтры поиска пользователя"""
    FILTER_TYPES = (
        ('users', 'Пользователи'),
        ('projects', 'Проекты'),
        ('tasks', 'Задачи'),
    )
    
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_search_filters')
    name = models.CharField(max_length=200, verbose_name='Название фильтра')
    filter_type = models.CharField(max_length=20, choices=FILTER_TYPES, verbose_name='Тип')
    filters = models.JSONField(verbose_name='Параметры фильтра')
    created_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        verbose_name = 'Сохраненный фильтр'
        verbose_name_plural = 'Сохраненные фильтры'
        unique_together = ['user', 'name']
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'filter_type'], name='search_filter_user_type_idx'),
        ]
    
    def __str__(self) -> str:
        return f"{self.user.username} - {self.name}"


# 📅 ==================== CALENDAR & EVENTS ====================

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
    creator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='created_events', verbose_name='Создатель')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name='events', verbose_name='Проект')
    task = models.ForeignKey(Task, on_delete=models.CASCADE, null=True, blank=True, related_name='events', verbose_name='Задача')
    
    # Участники (для встреч)
    participants = models.ManyToManyField(User, related_name='event_participations', blank=True, verbose_name='Участники')
    
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
        from django.utils import timezone
        now = timezone.now().date()
        return self.start_date >= now
    
    def get_participants_count(self) -> int:
        """Количество участников"""
        return self.participants.count()


# 📍 ==================== GEOFENCE REMINDERS ====================

class GeofenceReminder(models.Model):
    """Геолокационные напоминания - уведомления при приближении к месту"""
    
    RADIUS_CHOICES = (
        (100, '100 метров'),
        (250, '250 метров'),
        (500, '500 метров'),
        (1000, '1 километр'),
        (2000, '2 километра'),
    )
    
    # Основная информация
    user = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='geofence_reminders', 
        verbose_name='Пользователь'
    )
    
    # Связи с проектом или событием
    project = models.ForeignKey(
        Project, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='geofence_reminders', 
        verbose_name='Проект'
    )
    event = models.ForeignKey(
        Event, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='geofence_reminders', 
        verbose_name='Событие'
    )
    
    # Геолокационные данные
    latitude = models.DecimalField(
        max_digits=9, 
        decimal_places=6, 
        verbose_name='Широта',
        help_text='Широта места проведения'
    )
    longitude = models.DecimalField(
        max_digits=9, 
        decimal_places=6, 
        verbose_name='Долгота',
        help_text='Долгота места проведения'
    )
    radius = models.IntegerField(
        choices=RADIUS_CHOICES, 
        default=500, 
        verbose_name='Радиус',
        help_text='Радиус зоны уведомления в метрах'
    )
    
    # Настройки
    is_active = models.BooleanField(default=True, verbose_name='Активно', db_index=True)
    is_triggered = models.BooleanField(default=False, verbose_name='Сработало')
    
    # Кастомные настройки
    title = models.CharField(max_length=200, blank=True, verbose_name='Заголовок')
    message = models.TextField(blank=True, verbose_name='Сообщение')
    
    # Служебные поля
    triggered_at = models.DateTimeField(null=True, blank=True, verbose_name='Время срабатывания')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создано')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')
    
    class Meta:
        verbose_name = 'Геолокационное напоминание'
        verbose_name_plural = 'Геолокационные напоминания'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'is_active'], name='geofence_user_active_idx'),
            models.Index(fields=['project', 'is_active'], name='geofence_project_active_idx'),
            models.Index(fields=['event', 'is_active'], name='geofence_event_active_idx'),
            models.Index(fields=['is_active', 'is_triggered'], name='geofence_active_triggered_idx'),
        ]
    
    def __str__(self) -> str:
        if self.project:
            return f"Напоминание для {self.user.username} - Проект: {self.project.title}"
        elif self.event:
            return f"Напоминание для {self.user.username} - Событие: {self.event.title}"
        else:
            return f"Напоминание для {self.user.username}"
    
    def get_location_name(self) -> str:
        """Получить название места"""
        if self.project:
            return self.project.title
        elif self.event:
            return self.event.title
        return self.title or "Локация"


# 💬 ==================== CHAT & MESSAGING ====================

class Chat(models.Model):
    """Чаты - группы для общения по проектам"""
    
    CHAT_TYPE_CHOICES = (
        ('project', 'Чат проекта'),
        ('direct', 'Личный чат'),
        ('group', 'Группа'),
    )
    
    # Основная информация
    name = models.CharField(max_length=200, blank=True, verbose_name='Название')
    chat_type = models.CharField(max_length=20, choices=CHAT_TYPE_CHOICES, default='project', db_index=True)
    
    # Связи
    project = models.ForeignKey(
        Project, 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='chats', 
        verbose_name='Проект'
    )
    
    # Участники
    participants = models.ManyToManyField(
        User, 
        related_name='chats', 
        verbose_name='Участники'
    )
    
    # Служебные поля
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлен')
    is_active = models.BooleanField(default=True, verbose_name='Активен', db_index=True)
    
    class Meta:
        verbose_name = 'Чат'
        verbose_name_plural = 'Чаты'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['chat_type', 'is_active'], name='chat_type_active_idx'),
            models.Index(fields=['project', 'is_active'], name='chat_project_active_idx'),
        ]
    
    def __str__(self) -> str:
        if self.name:
            return self.name
        elif self.project:
            return f"Чат проекта: {self.project.title}"
        return f"Чат #{self.id}"  # type: ignore[attr-defined]
    
    def get_last_message(self) -> Any:
        """Получить последнее сообщение"""
        return self.messages.order_by('-created_at').first()  # type: ignore[attr-defined]
    
    def get_unread_count(self, user: Any) -> int:
        """Количество непрочитанных сообщений для пользователя"""
        return self.messages.filter(is_read=False).exclude(sender=user).count()  # type: ignore[attr-defined]


class Message(models.Model):
    """Сообщения в чате"""
    
    MESSAGE_TYPE_CHOICES = (
        ('text', 'Текст'),
        ('image', 'Изображение'),
        ('video', 'Видео'),
        ('file', 'Файл'),
        ('system', 'Системное'),
    )
    
    # Основная информация
    chat = models.ForeignKey(
        Chat, 
        on_delete=models.CASCADE, 
        related_name='messages', 
        verbose_name='Чат'
    )
    sender = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='sent_messages', 
        verbose_name='Отправитель'
    )
    
    # Содержимое
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, default='text')
    text = models.TextField(blank=True, verbose_name='Текст')
    image = models.ImageField(upload_to='chat/images/', null=True, blank=True, verbose_name='Изображение')
    file = models.FileField(upload_to='chat/files/', null=True, blank=True, verbose_name='Файл')
    
    # Статус доставки и прочтения
    is_delivered = models.BooleanField(default=False, verbose_name='Доставлено', db_index=True)
    delivered_at = models.DateTimeField(null=True, blank=True, verbose_name='Доставлено в')
    is_read = models.BooleanField(default=False, verbose_name='Прочитано', db_index=True)
    read_at = models.DateTimeField(null=True, blank=True, verbose_name='Прочитано в')
    is_deleted = models.BooleanField(default=False, verbose_name='Удалено', db_index=True)
    
    # Служебные поля
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Отправлено', db_index=True)
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлено')
    
    class Meta:
        verbose_name = 'Сообщение'
        verbose_name_plural = 'Сообщения'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['chat', 'created_at'], name='message_chat_created_idx'),
            models.Index(fields=['sender', 'created_at'], name='message_sender_created_idx'),
            models.Index(fields=['chat', 'is_read'], name='message_chat_read_idx'),
            models.Index(fields=['is_deleted', 'created_at'], name='message_deleted_created_idx'),
        ]
    
    def __str__(self) -> str:
        return f"{self.sender.username}: {self.text[:50]}"
    
    def mark_as_read(self) -> None:
        """Пометить как прочитанное"""
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            self.save(update_fields=['is_read', 'read_at'])
    
    def mark_as_delivered(self) -> None:
        """Пометить как доставленное"""
        if not self.is_delivered:
            self.is_delivered = True
            self.delivered_at = timezone.now()
            self.save(update_fields=['is_delivered', 'delivered_at'])


class ChatMember(models.Model):
    """Настройки участника в чате"""
    
    chat = models.ForeignKey(
        Chat,
        on_delete=models.CASCADE,
        related_name='chat_members',
        verbose_name='Чат'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='chat_memberships',
        verbose_name='Пользователь'
    )
    
    # Настройки
    notifications_enabled = models.BooleanField(default=True, verbose_name='Уведомления включены')
    joined_at = models.DateTimeField(auto_now_add=True, verbose_name='Присоединился')
    last_read_at = models.DateTimeField(auto_now_add=True, verbose_name='Последнее прочтение')
    
    class Meta:
        verbose_name = 'Участник чата'
        verbose_name_plural = 'Участники чатов'
        unique_together = ['chat', 'user']
        indexes = [
            models.Index(fields=['chat', 'user'], name='chat_member_chat_user_idx'),
            models.Index(fields=['user', 'notifications_enabled'], name='chat_member_user_notif_idx'),
        ]
    
    def __str__(self) -> str:
        return f"{self.user.username} в {self.chat}"


class PinnedMessage(models.Model):
    """Закрепленные сообщения в чате"""
    
    chat = models.ForeignKey(
        Chat,
        on_delete=models.CASCADE,
        related_name='pinned_messages',
        verbose_name='Чат'
    )
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='pins',
        verbose_name='Сообщение'
    )
    pinned_by = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='pinned_by_user',
        verbose_name='Закрепил'
    )
    pinned_at = models.DateTimeField(auto_now_add=True, verbose_name='Закреплено')
    
    class Meta:
        verbose_name = 'Закрепленное сообщение'
        verbose_name_plural = 'Закрепленные сообщения'
        unique_together = ['chat', 'message']
        ordering = ['-pinned_at']
        indexes = [
            models.Index(fields=['chat', 'pinned_at'], name='pinned_msg_chat_pinned_idx'),
        ]
    
    def __str__(self) -> str:
        return f"Закреплено в {self.chat}: {self.message.text[:50]}"


class TypingStatus(models.Model):
    """Статус печати пользователя в чате"""
    
    TYPING_TYPE_CHOICES = (
        ('text', 'печатает...'),
        ('image', 'отправляет фото...'),
        ('video', 'отправляет видео...'),
        ('file', 'отправляет файл...'),
    )
    
    chat = models.ForeignKey(
        Chat,
        on_delete=models.CASCADE,
        related_name='typing_statuses',
        verbose_name='Чат'
    )
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='typing_in_chats',
        verbose_name='Пользователь'
    )
    typing_type = models.CharField(
        max_length=20,
        choices=TYPING_TYPE_CHOICES,
        default='text',
        verbose_name='Тип действия'
    )
    started_at = models.DateTimeField(auto_now=True, verbose_name='Начало')
    
    class Meta:
        verbose_name = 'Статус печати'
        verbose_name_plural = 'Статусы печати'
        unique_together = ['chat', 'user']
        indexes = [
            models.Index(fields=['chat', 'started_at'], name='typing_chat_started_idx'),
        ]
    
    def __str__(self) -> str:
        return f"{self.user.username} {self.get_typing_type_display()} в {self.chat}"  # type: ignore[attr-defined]
    
    def is_active(self) -> bool:
        """Проверка актуальности статуса (последние 5 секунд)"""
        from datetime import timedelta
        return (timezone.now() - self.started_at) < timedelta(seconds=5)


class TelegramLinkCode(models.Model):
    """Временные коды для привязки Telegram аккаунта к веб-порталу"""
    code = models.CharField(max_length=6, unique=True, db_index=True, verbose_name='Код')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='telegram_link_codes', verbose_name='Пользователь')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Создан')
    expires_at = models.DateTimeField(db_index=True, verbose_name='Истекает')
    is_used = models.BooleanField(default=False, db_index=True, verbose_name='Использован')
    used_at = models.DateTimeField(null=True, blank=True, verbose_name='Использован в')
    
    class Meta:
        verbose_name = 'Код привязки Telegram'
        verbose_name_plural = 'Коды привязки Telegram'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['code', 'is_used'], name='tg_link_code_code_used_idx'),
            models.Index(fields=['user', 'is_used'], name='tg_link_code_user_used_idx'),
            models.Index(fields=['expires_at'], name='tg_link_code_expires_idx'),
        ]
    
    def __str__(self) -> str:
        return f"Code {self.code} for user {self.user.username} ({'used' if self.is_used else 'active'})"
    
    def is_expired(self) -> bool:
        """Проверка, истек ли код"""
        return timezone.now() > self.expires_at
    
    def is_valid(self) -> bool:
        """Проверка, действителен ли код"""
        return not self.is_used and not self.is_expired()


class EmailVerificationCode(models.Model):
    """Коды подтверждения email при регистрации"""
    code = models.CharField(max_length=6, db_index=True, verbose_name='Код')
    email = models.EmailField(db_index=True, verbose_name='Email')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='email_verification_codes', verbose_name='Пользователь')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Создан')
    expires_at = models.DateTimeField(db_index=True, verbose_name='Истекает')
    is_used = models.BooleanField(default=False, db_index=True, verbose_name='Использован')
    used_at = models.DateTimeField(null=True, blank=True, verbose_name='Использован в')
    
    class Meta:
        verbose_name = 'Код подтверждения email'
        verbose_name_plural = 'Коды подтверждения email'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['email', 'is_used'], name='email_verify_email_used_idx'),
            models.Index(fields=['user', 'is_used'], name='email_verify_user_used_idx'),
            models.Index(fields=['expires_at'], name='email_verify_expires_idx'),
        ]
    
    def __str__(self) -> str:
        return f"Code {self.code} for {self.email} ({'used' if self.is_used else 'active'})"
    
    def is_expired(self) -> bool:
        """Проверка, истек ли код"""
        return timezone.now() > self.expires_at
    
    def is_valid(self) -> bool:
        """Проверка, действителен ли код"""
        return not self.is_used and not self.is_expired()
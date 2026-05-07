"""
Support domain models
Модели домена поддержки
"""
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from django.utils import timezone
import re
import logging
from typing import Any

logger = logging.getLogger(__name__)


class SupportTicket(models.Model):
    """Модель для тикетов поддержки от пользователей"""
    STATUS_CHOICES = (
        ('open', 'Открыт'),
        ('in_progress', 'В обработке'),
        ('resolved', 'Решен'),
        ('closed', 'Закрыт'),
    )
    
    SOURCE_CHOICES = (
        ('ai_chat', 'AI Чат'),
        ('manual', 'Ручное создание'),
        ('email', 'Email'),
    )

    user = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='support_tickets', verbose_name='Пользователь')
    message = models.TextField(verbose_name='Сообщение')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open', db_index=True, verbose_name='Статус')
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='ai_chat', verbose_name='Источник')
    admin_response = models.TextField(blank=True, null=True, verbose_name='Ответ администратора')
    created_at = models.DateTimeField(auto_now_add=True, db_index=True, verbose_name='Создан')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='Обновлен')
    resolved_at = models.DateTimeField(null=True, blank=True, verbose_name='Решен')

    class Meta:
        verbose_name = 'Тикет поддержки'
        verbose_name_plural = 'Тикеты поддержки'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status'], name='support_user_status_idx'),
            models.Index(fields=['status', 'created_at'], name='support_status_created_idx'),
        ]

    def __str__(self) -> str:
        return f"Тикет #{self.id} от {self.user.username} - {self.get_status_display()}"

    def mark_resolved(self) -> None:
        """Пометить тикет как решенный"""
        self.status = 'resolved'
        self.resolved_at = timezone.now()
        self.save(update_fields=['status', 'resolved_at'])


class FeedbackSession(models.Model):
    """Сессия обратной связи между организатором и волонтером"""
    organizer = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='feedback_sessions')
    volunteer = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='volunteer_feedback_sessions')
    project = models.ForeignKey('api.Project', on_delete=models.CASCADE, related_name='feedback_sessions')
    task = models.ForeignKey('api.Task', on_delete=models.SET_NULL, null=True, blank=True)
    photo = models.ForeignKey('api.Photo', on_delete=models.SET_NULL, null=True, blank=True)
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
        session = cls.objects.filter(
            volunteer=photo.volunteer,
            project=photo.project,
            is_active=True
        ).first()

        if not session:
            session = cls.objects.create(
                organizer=photo.project.creator,
                volunteer=photo.volunteer,
                project=photo.project,
                is_active=True
            )

        return session


class FeedbackMessage(models.Model):
    """Сообщения в сессии обратной связи"""
    MESSAGE_TYPE_CHOICES = (
        ('text', 'Текстовое сообщение'),
        ('photo', 'Фотоотчет'),
        ('system', 'Системное сообщение'),
    )

    session = models.ForeignKey(FeedbackSession, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey('api.User', on_delete=models.CASCADE)
    text = models.TextField(blank=True)
    message_type = models.CharField(max_length=20, choices=MESSAGE_TYPE_CHOICES, default='text')

    # Связь с фотоотчетом (если это сообщение о фото)
    photo = models.ForeignKey('api.Photo', on_delete=models.SET_NULL, null=True, blank=True, related_name='feedback_messages')

    # Telegram интеграция
    telegram_message_id = models.BigIntegerField(null=True, blank=True, db_index=True)

    timestamp = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    is_spam = models.BooleanField(default=False)
    is_flagged = models.BooleanField(default=False)

    def check_spam(self) -> bool:
        """Проверка сообщения на наличие спама/цензурных слов"""
        # Не проверяем фото и системные сообщения
        if self.message_type in ['photo', 'system'] or not self.text:
            return False

        # Список цензурных слов
        profanity_words = [
            'дурак', 'идиот', 'тупой', 'урод', 'козел', 'свинья',
            'придурок', 'дебил', 'дура', 'мудак', 'хрен', 'чёрт',
            'блин', 'черт', 'гад', 'сволочь', 'негодяй', 'подонок',
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

        # Проверка на повторяющиеся символы
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
        if not self.pk:
            self.check_spam()
        super().save(*args, **kwargs)

    class Meta:
        ordering = ['timestamp']
        indexes = [
            models.Index(fields=['session', 'timestamp'], name='feedback_msg_session_time_idx'),
            models.Index(fields=['is_spam'], name='feedback_msg_spam_idx'),
        ]


class UserSearchFilter(models.Model):
    """Сохраненные фильтры поиска пользователя"""
    FILTER_TYPES = (
        ('users', 'Пользователи'),
        ('projects', 'Проекты'),
        ('tasks', 'Задачи'),
    )
    
    user = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='saved_search_filters')
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
        'api.User', 
        on_delete=models.CASCADE, 
        related_name='geofence_reminders', 
        verbose_name='Пользователь'
    )
    
    # Связи с проектом или событием
    project = models.ForeignKey(
        'api.Project', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='geofence_reminders', 
        verbose_name='Проект'
    )
    event = models.ForeignKey(
        'api.Event', 
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


"""
Notifications domain models
Модели домена уведомлений
"""
from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone
from datetime import timedelta
from django.db.models import Q
import logging
from typing import Any

logger = logging.getLogger(__name__)


class DeviceToken(models.Model):
    """Модель для хранения FCM токенов устройств пользователей"""
    user = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='device_tokens')
    token = models.TextField(unique=True)
    platform = models.CharField(max_length=20, choices=(
        ('android', 'Android'),
        ('ios', 'iOS'),
    ), default='android')
    device_name = models.CharField(max_length=255, blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Токен устройства'
        verbose_name_plural = 'Токены устройств'
        indexes = [
            models.Index(fields=['user', 'is_active'], name='device_token_user_active_idx'),
            models.Index(fields=['token'], name='device_token_token_idx'),
            models.Index(fields=['last_used_at'], name='device_token_last_used_idx'),
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Защита от дубликатов FCM токенов"""
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
    created_by = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='bulk_notifications')
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
        from api.users.models import User
        
        queryset = User.objects.all()
        
        # Фильтр по роли
        if self.filter_role == 'volunteer':
            queryset = queryset.filter(role='volunteer')
        elif self.filter_role == 'organizer':
            queryset = queryset.filter(role='organizer')
        
        # Фильтр по рейтингу
        queryset = queryset.filter(
            rating__gte=self.filter_rating_min,
            rating__lte=self.filter_rating_max
        )
        
        # Фильтр по активности
        if self.filter_active_days:
            try:
                days = int(self.filter_active_days)
                if days > 0:
                    active_since = timezone.now() - timedelta(days=days)
                    queryset = queryset.filter(
                        Q(last_login__gte=active_since) | Q(last_login__isnull=True)
                    )
            except (ValueError, TypeError):
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
    user = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='notification_receipts')
    
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


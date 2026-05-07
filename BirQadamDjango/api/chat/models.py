"""
Chat domain models
Модели домена чата
"""
from django.db import models
from django.utils import timezone
from datetime import timedelta
import logging
from typing import Any

logger = logging.getLogger(__name__)


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
        'api.Project', 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True, 
        related_name='chats', 
        verbose_name='Проект'
    )
    
    # Участники
    participants = models.ManyToManyField(
        'api.User', 
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
        'api.User', 
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
        'api.User',
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
        'api.User',
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
        'api.User',
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
        return (timezone.now() - self.started_at) < timedelta(seconds=5)


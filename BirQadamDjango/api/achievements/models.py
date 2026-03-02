"""
Achievements domain models
Модели домена достижений
"""
from django.db import models
from django.core.validators import MinValueValidator
from django.core.cache import cache
import logging
from typing import Any

logger = logging.getLogger(__name__)


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
    user = models.ForeignKey('api.User', on_delete=models.CASCADE, related_name='user_achievements')
    achievement = models.ForeignKey(Achievement, on_delete=models.CASCADE, related_name='user_achievements')
    unlocked_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args: Any, **kwargs: Any) -> None:
        """Инвалидация кеша при разблокировке достижения"""
        super().save(*args, **kwargs)
        
        # Инвалидируем кеш достижений пользователя
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


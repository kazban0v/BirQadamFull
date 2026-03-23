"""
✅ ИСПРАВЛЕНИЕ СП-3: Audit Trail - логирование критичных действий
"""
import logging
from typing import Any, Callable, Dict, Optional
from django.utils import timezone
from django.http import HttpRequest
from functools import wraps

# Создаём отдельный логгер для аудита
audit_logger = logging.getLogger('audit')


def log_audit_action(action_type: str, user: Optional[Any] = None, **extra_data: Any) -> None:  # type: ignore[no-any-unimported]
    """
    Логирует критичное действие в audit log
    
    Args:
        action_type (str): Тип действия (project_approved, organizer_approved, etc.)
        user: Пользователь, выполнивший действие
        **extra_data: Дополнительные данные для логирования
    """
    log_data = {
        'action': action_type,
        'timestamp': timezone.now().isoformat(),
        **extra_data
    }
    
    if user:
        log_data.update({
            'user_id': user.id,
            'username': user.username,
            'user_role': getattr(user, 'role', 'unknown'),
        })
    
    audit_logger.info(
        f"Audit: {action_type}",
        extra=log_data
    )


def audit_log(action_type: str) -> Callable[[Callable[..., Any]], Callable[..., Any]]:  # type: ignore[no-any-unimported]
    """
    Декоратор для автоматического логирования действий
    
    Usage:
        @audit_log('project_approved')
        def approve_project(request, project_id):
            ...
    """
    def decorator(func: Callable[..., Any]) -> Callable[..., Any]:  # type: ignore[no-any-unimported]
        @wraps(func)
        def wrapper(request: HttpRequest, *args: Any, **kwargs: Any) -> Any:  # type: ignore[no-any-unimported]
            result = func(request, *args, **kwargs)
            
            # Логируем после успешного выполнения
            extra_data = {
                'function': func.__name__,
                'path': request.path,
                'method': request.method,
            }
            
            # Добавляем ID из kwargs если есть
            for key, value in kwargs.items():
                if key.endswith('_id'):
                    extra_data[key] = value
            
            log_audit_action(
                action_type,
                user=request.user if hasattr(request, 'user') else None,
                **extra_data
            )
            
            return result
        return wrapper
    return decorator


class AuditActions:
    """Константы для типов аудит-действий"""
    # Проекты
    PROJECT_CREATED = 'project_created'
    PROJECT_APPROVED = 'project_approved'
    PROJECT_REJECTED = 'project_rejected'
    PROJECT_DELETED = 'project_deleted'
    
    # Организаторы
    ORGANIZER_APPROVED = 'organizer_approved'
    ORGANIZER_REJECTED = 'organizer_rejected'
    
    # Фотоотчёты
    PHOTO_APPROVED = 'photo_approved'
    PHOTO_REJECTED = 'photo_rejected'
    PHOTO_DELETED = 'photo_deleted'
    
    # Задачи
    TASK_CREATED = 'task_created'
    TASK_COMPLETED = 'task_completed'
    TASK_DELETED = 'task_deleted'
    
    # Рейтинг
    RATING_CHANGED = 'rating_changed'
    ACHIEVEMENT_UNLOCKED = 'achievement_unlocked'
    
    # Безопасность
    LOGIN_SUCCESS = 'login_success'
    LOGIN_FAILED = 'login_failed'
    PASSWORD_RESET = 'password_reset'
    ACCOUNT_LOCKED = 'account_locked'
    
    # Администрирование
    USER_ROLE_CHANGED = 'user_role_changed'
    USER_DELETED = 'user_deleted'
    SETTINGS_CHANGED = 'settings_changed'


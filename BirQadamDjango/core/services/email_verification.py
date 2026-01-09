from __future__ import annotations

import logging
import secrets
from datetime import timedelta

from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

from core.models import EmailVerificationCode, User

logger = logging.getLogger(__name__)

# Время жизни кода подтверждения - 15 минут
VERIFICATION_CODE_EXPIRY = timedelta(minutes=15)


def generate_verification_code(user: User, email: str) -> str:
    """
    Генерирует код подтверждения email и отправляет его на почту
    """
    from core.models import EmailVerificationCode
    
    # Деактивируем все предыдущие неиспользованные коды для этого email
    EmailVerificationCode.objects.filter(
        email=email,
        is_used=False
    ).update(is_used=True)
    
    # Генерируем уникальный 6-значный код
    max_attempts = 10
    for attempt in range(max_attempts):
        code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
        # Проверяем, что код не используется для этого email
        if not EmailVerificationCode.objects.filter(
            code=code,
            email=email,
            is_used=False,
            expires_at__gt=timezone.now()
        ).exists():
            break
    else:
        logger.error(f"Failed to generate unique code after {max_attempts} attempts")
        raise ValueError("Не удалось сгенерировать уникальный код")
    
    expires_at = timezone.now() + VERIFICATION_CODE_EXPIRY
    
    # Создаем запись о коде
    verification_code = EmailVerificationCode.objects.create(
        code=code,
        email=email,
        user=user,
        expires_at=expires_at
    )
    
    # Отправляем email с кодом
    try:
        send_verification_email(email, code, user.name or user.username)
        logger.info(f"Verification code sent to {email} for user {user.id}")
    except Exception as e:
        logger.error(f"Failed to send verification email to {email}: {e}")
        # Не удаляем код, пользователь может запросить повторную отправку
    
    return code


def send_verification_email(email: str, code: str, username: str) -> None:
    """
    Отправляет email с кодом подтверждения
    """
    subject = "Подтверждение регистрации в BirQadam"
    message = f"""
Здравствуйте, {username}!

Спасибо за регистрацию в BirQadam!

Ваш код подтверждения: {code}

Код действителен в течение 15 минут.

Если вы не регистрировались в BirQadam, просто проигнорируйте это письмо.

─────────────────────────────────────────────────────────
С уважением,
Команда BirQadam
🌱 Вместе делаем город чище!
"""
    
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )


def verify_email_code(email: str, code: str) -> tuple[bool, User | None, str]:
    """
    Проверяет код подтверждения email
    
    Returns:
        (success: bool, user: User | None, message: str)
    """
    try:
        verification_code = EmailVerificationCode.objects.filter(
            email=email,
            code=code,
            is_used=False
        ).order_by('-created_at').first()
        
        if not verification_code:
            return False, None, "Код не найден или уже использован"
        
        if verification_code.is_expired():
            return False, None, "Код истёк. Запросите новый код."
        
        # Помечаем код как использованный
        verification_code.is_used = True
        verification_code.used_at = timezone.now()
        verification_code.save()
        
        # Активируем пользователя
        user = verification_code.user
        user.is_active = True
        user.save(update_fields=['is_active'])
        
        logger.info(f"Email {email} verified for user {user.id}")
        
        return True, user, "Email успешно подтверждён"
        
    except Exception as e:
        logger.error(f"Error verifying email code: {e}")
        return False, None, "Произошла ошибка при проверке кода"


def get_user_verification_code(user: User, email: str) -> EmailVerificationCode | None:
    """
    Получает последний неиспользованный код подтверждения для пользователя
    """
    return EmailVerificationCode.objects.filter(
        user=user,
        email=email,
        is_used=False
    ).order_by('-created_at').first()



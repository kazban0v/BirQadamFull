"""
Email verification service for users
Сервис подтверждения email пользователей
"""
from __future__ import annotations

import logging
import secrets
from datetime import timedelta

from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

from api.users.models import VerificationCode, User

logger = logging.getLogger(__name__)

# Время жизни кода подтверждения - 15 минут
VERIFICATION_CODE_EXPIRY = timedelta(minutes=15)


def generate_verification_code(user: User, email: str) -> str:
    """
    Генерирует код подтверждения email и отправляет его на почту
    """
    # Деактивируем все предыдущие неиспользованные коды для этого email
    VerificationCode.objects.filter(
        email=email,
        verification_type='email_verification',
        is_used=False
    ).update(is_used=True)
    
    # Генерируем уникальный 6-значный код
    max_attempts = 10
    for attempt in range(max_attempts):
        code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
        # Проверяем, что код не используется для этого email
        if not VerificationCode.objects.filter(
            code=code,
            email=email,
            verification_type='email_verification',
            is_used=False,
            expires_at__gt=timezone.now()
        ).exists():
            break
    else:
        logger.error(f"Failed to generate unique code after {max_attempts} attempts")
        raise ValueError("Не удалось сгенерировать уникальный код")
    
    expires_at = timezone.now() + VERIFICATION_CODE_EXPIRY
    
    # Создаем запись о коде
    verification_code = VerificationCode.objects.create(
        verification_type='email_verification',
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
    
    # Логируем попытку отправки
    print(f"[EMAIL] Attempting to send verification email to {email} from {settings.DEFAULT_FROM_EMAIL}")
    
    # Показываем тип backend
    backend_name = settings.EMAIL_BACKEND.split('.')[-1] if settings.EMAIL_BACKEND else 'unknown'
    print(f"[EMAIL] Using backend: {backend_name}")
    
    logger.info(f"Attempting to send verification email to {email} from {settings.DEFAULT_FROM_EMAIL}")
    logger.info(f"Using email backend: {backend_name}")
    
    # Показываем SMTP настройки только если используется SMTP backend
    if 'smtp' in settings.EMAIL_BACKEND.lower():
        print(f"[EMAIL] SMTP Settings: HOST={getattr(settings, 'EMAIL_HOST', 'N/A')}, PORT={getattr(settings, 'EMAIL_PORT', 'N/A')}, USER={getattr(settings, 'EMAIL_HOST_USER', 'N/A')}")
        logger.info(f"Email settings: HOST={settings.EMAIL_HOST}, PORT={settings.EMAIL_PORT}, USER={settings.EMAIL_HOST_USER}")
    
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[email],
            fail_silently=False,
        )
        success_msg = f"Successfully sent verification email to {email}"
        print(f"[EMAIL] ✓ {success_msg}")
        logger.info(success_msg)
    except Exception as e:
        error_msg = f"Failed to send verification email to {email}: {str(e)}"
        print(f"[EMAIL] ✗ {error_msg}")
        print(f"[EMAIL] Config: HOST={settings.EMAIL_HOST}, PORT={settings.EMAIL_PORT}, SSL={settings.EMAIL_USE_SSL}, TLS={settings.EMAIL_USE_TLS}, USER={settings.EMAIL_HOST_USER}")
        print(f"[EMAIL] FROM={settings.DEFAULT_FROM_EMAIL}, PASSWORD_SET={bool(settings.EMAIL_HOST_PASSWORD)}")
        
        # Детальная диагностика ошибки подключения
        error_str = str(e).lower()
        if 'network is unreachable' in error_str or 'errno 101' in error_str:
            advice = "🚨 Не удается подключиться к SMTP серверу! Решения:\n"
            advice += "1. Установите переменную: EMAIL_PORT=465 (порт 465 часто разблокирован)\n"
            advice += "2. Или используйте альтернативный email сервис (SendGrid, Mailgun, Resend)\n"
            advice += "3. Проверьте настройки сети и файрвола"
            print(f"[EMAIL] 💡 {advice}")
            logger.error(advice)
        elif 'authentication failed' in error_str or '535' in error_str:
            advice = "🚨 Ошибка аутентификации! Проверьте:\n"
            advice += "1. Правильный ли App Password (без пробелов)\n"
            advice += "2. Включена ли двухфакторная аутентификация в Gmail\n"
            advice += "3. Создан ли новый App Password в https://myaccount.google.com/apppasswords"
            print(f"[EMAIL] 💡 {advice}")
            logger.error(advice)
        elif 'timeout' in error_str or 'timed out' in error_str:
            advice = "🚨 Таймаут подключения! Увеличьте EMAIL_TIMEOUT (например, 60)"
            print(f"[EMAIL] 💡 {advice}")
            logger.error(advice)
        
        logger.error(error_msg)
        logger.error(f"Email config: HOST={settings.EMAIL_HOST}, PORT={settings.EMAIL_PORT}, SSL={settings.EMAIL_USE_SSL}, TLS={settings.EMAIL_USE_TLS}, USER={settings.EMAIL_HOST_USER}, FROM={settings.DEFAULT_FROM_EMAIL}")
        logger.error(f"EMAIL_HOST_PASSWORD is set: {bool(settings.EMAIL_HOST_PASSWORD)}")
        # Выводим тип ошибки для диагностики
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise  # Пробрасываем ошибку дальше, чтобы её можно было обработать


def verify_email_code(email: str, code: str) -> tuple[bool, User | None, str]:
    """
    Проверяет код подтверждения email
    Проверяет только последний активный код для неактивного пользователя
    
    Returns:
        (success: bool, user: User | None, message: str)
    """
    try:
        # Находим последний неиспользованный код для этого email
        # Важно: берем последний созданный код (самый свежий)
        verification_code = VerificationCode.objects.filter(
            email=email,
            code=code,
            verification_type='email_verification',
            is_used=False
        ).order_by('-created_at').first()
        
        if not verification_code:
            return False, None, "Код не найден или уже использован"
        
        # Проверяем, что код не истек
        if verification_code.is_expired():
            return False, None, "Код истёк. Запросите новый код."
        
        # Проверяем, что пользователь еще не активирован (важно для безопасности)
        user = verification_code.user
        if user.is_active:
            logger.warning(f"Attempt to verify code for already active user {user.id} with email {email}")
            return False, None, "Пользователь уже активирован"
        
        # Проверяем, что это действительно последний созданный код для этого email
        # (защита от использования старых кодов)
        latest_code = VerificationCode.objects.filter(
            email=email,
            verification_type='email_verification',
            is_used=False
        ).order_by('-created_at').first()
        
        if latest_code and latest_code.id != verification_code.id:
            logger.warning(f"Attempt to use old code {code} for email {email}. Latest code was created at {latest_code.created_at}")
            return False, None, "Этот код больше не действителен. Используйте последний отправленный код."
        
        # Помечаем код как использованный
        verification_code.is_used = True
        verification_code.used_at = timezone.now()
        verification_code.save()
        
        # Деактивируем все остальные неиспользованные коды для этого email
        # (на случай, если были отправлены несколько кодов)
        VerificationCode.objects.filter(
            email=email,
            verification_type='email_verification',
            is_used=False
        ).exclude(id=verification_code.id).update(is_used=True, used_at=timezone.now())
        
        # Активируем пользователя
        user.is_active = True
        user.save(update_fields=['is_active'])
        
        logger.info(f"Email {email} verified for user {user.id}")
        
        return True, user, "Email успешно подтверждён"
        
    except Exception as e:
        logger.error(f"Error verifying email code: {e}")
        return False, None, "Произошла ошибка при проверке кода"


def get_user_verification_code(user: User, email: str) -> VerificationCode | None:
    """
    Получает последний неиспользованный код подтверждения для пользователя
    """
    return VerificationCode.objects.filter(
        user=user,
        email=email,
        verification_type='email_verification',
        is_used=False
    ).order_by('-created_at').first()


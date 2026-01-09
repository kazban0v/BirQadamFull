"""
Сервис для синхронизации аккаунта веб-портала с Telegram ботом
"""
import secrets
import logging
from typing import Optional, Dict, Any
from django.core.cache import cache
from django.contrib.auth import get_user_model
from django.utils import timezone
from datetime import timedelta
from django.db import transaction

logger = logging.getLogger(__name__)
User = get_user_model()

# Время жизни кода привязки (10 минут)
LINK_CODE_EXPIRY = timedelta(minutes=10)
CACHE_PREFIX = 'telegram_link_code_'


def generate_link_code(user: User) -> str:
    """
    Генерирует уникальный код для привязки Telegram аккаунта
    Сохраняет в базе данных для доступа из разных процессов
    
    Args:
        user: Пользователь, для которого генерируется код
        
    Returns:
        Строка с 6-значным кодом
    """
    from core.models import TelegramLinkCode
    
    # Деактивируем старые неиспользованные коды пользователя
    TelegramLinkCode.objects.filter(user=user, is_used=False).update(is_used=True)
    
    # Генерируем уникальный 6-значный код
    max_attempts = 10
    for attempt in range(max_attempts):
        code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
        
        # Проверяем, не существует ли уже такой код
        if not TelegramLinkCode.objects.filter(code=code, is_used=False).exists():
            break
    else:
        logger.error(f"Failed to generate unique code after {max_attempts} attempts")
        raise ValueError("Не удалось сгенерировать уникальный код")
    
    # Сохраняем в базе данных
    expires_at = timezone.now() + LINK_CODE_EXPIRY
    link_code = TelegramLinkCode.objects.create(
        code=code,
        user=user,
        expires_at=expires_at
    )
    
    logger.info(f"Generated link code for user {user.id} ({user.username}): {code}, expires at {expires_at}")
    return code


def get_link_code_data(code: str) -> Optional[Dict[str, Any]]:
    """
    Получает данные пользователя по коду привязки из базы данных
    
    Args:
        code: Код привязки
        
    Returns:
        Словарь с данными пользователя или None
    """
    from core.models import TelegramLinkCode
    
    logger.info(f"Looking for code {code} in database")
    
    try:
        link_code = TelegramLinkCode.objects.select_related('user').get(code=code, is_used=False)
        
        # Проверяем, не истек ли код
        if link_code.is_expired():
            logger.warning(f"Link code {code} has expired")
            return None
        
        data = {
            'user_id': link_code.user.id,
            'username': link_code.user.username,
            'phone_number': link_code.user.phone_number,
            'created_at': link_code.created_at.isoformat(),
            'link_code_id': link_code.id,
        }
        
        logger.info(f"Found link code data for code {code}: user_id={data.get('user_id')}, username={data.get('username')}")
        return data
        
    except TelegramLinkCode.DoesNotExist:
        logger.warning(f"Link code {code} not found in database")
        return None
    except Exception as e:
        logger.error(f"Error getting link code data: {e}")
        return None


def verify_and_link_telegram(code: str, telegram_id: str, telegram_username: str) -> Optional[User]:
    """
    Проверяет код и привязывает Telegram аккаунт к пользователю
    
    Args:
        code: Код привязки
        telegram_id: ID пользователя в Telegram
        telegram_username: Username пользователя в Telegram
        
    Returns:
        Пользователь, если привязка успешна, иначе None
    """
    from core.models import TelegramLinkCode
    
    data = get_link_code_data(code)
    
    if not data:
        logger.warning(f"Invalid or expired link code: {code}")
        return None
    
    user_id = data.get('user_id')
    link_code_id = data.get('link_code_id')
    
    if not user_id:
        logger.error(f"No user_id in link code data for code {code}")
        return None
    
    try:
        with transaction.atomic():
            # Блокируем запись для атомарной операции
            link_code = TelegramLinkCode.objects.select_for_update().get(id=link_code_id, is_used=False)
            
            # Проверяем еще раз, не использован ли код
            if link_code.is_used or link_code.is_expired():
                logger.warning(f"Link code {code} already used or expired")
                return None
            
            user = User.objects.select_for_update().get(id=user_id)
            
            # Проверяем, не привязан ли уже этот telegram_id к другому пользователю
            existing_user = User.objects.filter(telegram_id=telegram_id).exclude(id=user.id).first()
            if existing_user:
                logger.warning(f"Telegram ID {telegram_id} already linked to user {existing_user.id}")
                return None
            
            # Привязываем Telegram
            user.telegram_id = telegram_id
            
            # Обновляем registration_source
            if user.registration_source == 'web_portal':
                user.registration_source = 'both'
            elif not user.registration_source or user.registration_source == 'mobile_app':
                user.registration_source = 'both'
            
            # Обновляем имя, если оно не было указано
            if not user.name and telegram_username:
                user.name = telegram_username
            
            user.save()
            
            # Помечаем код как использованный
            link_code.is_used = True
            link_code.used_at = timezone.now()
            link_code.save()
            
            logger.info(f"Successfully linked Telegram {telegram_id} to user {user.id} ({user.username})")
            return user
            
    except TelegramLinkCode.DoesNotExist:
        logger.error(f"Link code {code} not found in database")
        return None
    except User.DoesNotExist:
        logger.error(f"User with id {user_id} not found")
        return None
    except Exception as e:
        logger.error(f"Error linking Telegram: {e}")
        return None


def get_user_link_code(user: User) -> Optional[str]:
    """
    Получает активный код привязки для пользователя из базы данных
    
    Args:
        user: Пользователь
        
    Returns:
        Код привязки или None
    """
    from core.models import TelegramLinkCode
    
    try:
        link_code = TelegramLinkCode.objects.filter(
            user=user,
            is_used=False
        ).exclude(
            expires_at__lt=timezone.now()
        ).order_by('-created_at').first()
        
        if link_code and link_code.is_valid():
            return link_code.code
        return None
    except Exception as e:
        logger.error(f"Error getting user link code: {e}")
        return None


def is_telegram_linked(user: User) -> bool:
    """
    Проверяет, привязан ли Telegram аккаунт к пользователю
    
    Args:
        user: Пользователь
        
    Returns:
        True, если Telegram привязан
    """
    return bool(user.telegram_id)


from __future__ import annotations

import logging
import re
import secrets
from dataclasses import dataclass
from typing import Optional

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

from core.models import OrganizerApplication
from core.utils.utils import normalize_phone
from custom_admin.services.notification_service import NotificationService
from asgiref.sync import async_to_sync

logger = logging.getLogger(__name__)
User = get_user_model()


@dataclass
class RegistrationResult:
    user: User
    created: bool
    temporary_password: Optional[str] = None


class RegistrationError(Exception):
    """Raised when registration data is invalid or conflicts with existing users."""


def _build_username(seed: Optional[str]) -> str:
    base = (seed or 'user').lower().strip()
    base = re.sub(r'[^a-z0-9]+', '', base)
    if not base:
        base = 'user'

    candidate = base
    suffix = 1
    while User.objects.filter(username=candidate).exists():
        candidate = f"{base}{suffix}"
        suffix += 1
    return candidate


def _ensure_unique_contact(phone: Optional[str], email: Optional[str]) -> None:
    if phone and User.objects.filter(phone_number=phone).exists():
        raise RegistrationError("Пользователь с таким телефоном уже зарегистрирован.")
    if email and User.objects.filter(email__iexact=email).exists():
        raise RegistrationError("Пользователь с таким email уже зарегистрирован.")


@transaction.atomic
def register_volunteer(*, full_name: str, phone_number: str, email: Optional[str], password: Optional[str]) -> RegistrationResult:
    phone_normalized = normalize_phone(phone_number)
    if not phone_normalized:
        raise RegistrationError("Не удалось распознать номер телефона.")

    if not email:
        raise RegistrationError("Email обязателен для регистрации.")

    _ensure_unique_contact(phone_normalized, email)

    username_seed = phone_normalized or email or full_name or secrets.token_hex(4)
    username = _build_username(username_seed)

    password_to_set = password or secrets.token_urlsafe(12)

    temp_password: Optional[str] = None
    try:
        # Создаем пользователя неактивным до подтверждения email
        user = User(
            username=username,
            name=full_name.strip() or username,
            phone_number=phone_normalized,
            email=email,
            role='volunteer',
            registration_source='web_portal',
            is_active=False,  # Не активируем до подтверждения email
        )
        user.set_password(password_to_set)
        user.save()
        logger.info("Создан волонтёр через веб-портал (ожидает подтверждения email): %s", user.username)
        if not password:
            temp_password = password_to_set
        
        # Генерируем и отправляем код подтверждения
        from core.services.email_verification import generate_verification_code
        try:
            generate_verification_code(user, email)
            logger.info("Код подтверждения отправлен на email: %s", email)
        except Exception as e:
            logger.error(f"Ошибка отправки кода подтверждения: {e}")
            # Не прерываем регистрацию, пользователь может запросить повторную отправку
    except IntegrityError as exc:
        logger.exception("Ошибка создания волонтёра: %s", exc)
        raise RegistrationError("Не удалось создать пользователя. Попробуйте позже.") from exc

    return RegistrationResult(user=user, created=True, temporary_password=temp_password)


@transaction.atomic
def register_organizer(
    *,
    full_name: str,
    organization_name: str,
    phone_number: str,
    email: Optional[str],
    password: Optional[str],
    description: str = "",
    city: str = "",
    website: str = "",
    contact_person: str = "",
    notes: str = "",
) -> RegistrationResult:
    phone_normalized = normalize_phone(phone_number)
    if not phone_normalized:
        raise RegistrationError("Не удалось распознать номер телефона.")

    if not email:
        raise RegistrationError("Email обязателен для регистрации.")

    _ensure_unique_contact(phone_normalized, email)

    username_seed = organization_name or phone_normalized or email or full_name or secrets.token_hex(4)
    username = _build_username(username_seed)
    password_to_set = password or secrets.token_urlsafe(12)

    temp_password: Optional[str] = None
    try:
        # Создаем пользователя неактивным до подтверждения email
        user = User(
            username=username,
            name=full_name.strip() or username,
            phone_number=phone_normalized,
            email=email,
            role='organizer',
            organization_name=organization_name.strip(),
            organizer_status='pending',
            is_approved=False,
            registration_source='web_portal',
            is_active=False,  # Не активируем до подтверждения email
        )
        user.set_password(password_to_set)
        user.save()
        if not password:
            temp_password = password_to_set
        
        # Генерируем и отправляем код подтверждения
        from core.services.email_verification import generate_verification_code
        try:
            generate_verification_code(user, email)
            logger.info("Код подтверждения отправлен на email: %s", email)
        except Exception as e:
            logger.error(f"Ошибка отправки кода подтверждения: {e}")
            # Не прерываем регистрацию, пользователь может запросить повторную отправку

        application = OrganizerApplication.objects.create(
            user=user,
            organization_name=organization_name.strip(),
            description=description.strip(),
            city=city.strip(),
            website=website.strip(),
            contact_person=contact_person.strip() or full_name.strip(),
            notes=notes.strip(),
        )
        logger.info("Создана заявка организатора через веб-портал: %s", organization_name)

        # Уведомляем администраторов о новой заявке
        admins = list(User.objects.filter(is_staff=True, is_active=True))
        notification_title = "Новая заявка организатора"
        notification_message = (
            f"Поступила новая заявка на статус организатора от {user.name or user.username}.\n"
            f"Организация: {organization_name.strip()}\n"
            f"Город: {city.strip() or 'не указан'}"
        )
        notification_data = {
            'action': 'organizer_application',
            'user_id': user.id,
            'application_id': application.id,
        }

        for admin in admins:
            try:
                async_to_sync(NotificationService.notify_user)(
                    admin,
                    notification_title,
                    notification_message,
                    'organizer_application',
                    notification_data,
                    telegram_message=(
                        f"🆕 <b>Новая заявка организатора</b>\n\n"
                        f"👤 Имя: {user.name or user.username}\n"
                        f"🏢 Организация: {organization_name.strip()}\n"
                        f"📍 Город: {city.strip() or 'не указан'}\n"
                        f"📞 Телефон: {user.phone_number or 'не указан'}\n"
                        f"✉️ Email: {user.email or 'не указан'}\n\n"
                        f"Зайдите в админ-панель для проверки."
                    ),
                )
                logger.info("Администратор %s уведомлен о новой заявке организатора.", admin.username)
            except Exception as notify_exc:
                logger.error("Не удалось уведомить администратора %s: %s", admin.username, notify_exc)
    except IntegrityError as exc:
        logger.exception("Ошибка создания организатора: %s", exc)
        raise RegistrationError("Не удалось сохранить заявку организатора. Попробуйте позже.") from exc

    return RegistrationResult(user=user, created=True, temporary_password=temp_password)


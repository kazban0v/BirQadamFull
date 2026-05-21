from __future__ import annotations

import logging
from datetime import datetime, timedelta

from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.db.models import Avg, Count, Q
from django.urls import path
from django.utils.dateparse import parse_date, parse_datetime, parse_time
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from asgiref.sync import async_to_sync
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from api.projects.models import VolunteerProject
from api.tasks.models import Task, TaskAssignment
from django.shortcuts import get_object_or_404

from api.serializers import (
    OrganizerRegistrationSerializer,
    VolunteerRegistrationSerializer,
    LoginSerializer,
    VolunteerProfileSerializer,
    VolunteerTaskSummarySerializer,
    VolunteerProjectSerializer,
    VolunteerPhotoSerializer,
    VolunteerNotificationSerializer,
    VolunteerProjectCatalogSerializer,
    VolunteerStatsSerializer,
    VolunteerActivitySeriesSerializer,
)
from api.users.services.registration import (
    RegistrationError,
    register_organizer,
    register_volunteer,
)
from api.users.services.dashboard import get_volunteer_dashboard_data
from api.projects.services.catalog import get_projects_catalog
from api.projects.services.lifecycle import (
    archive_finished_project_tasks,
    cleanup_archived_project_chats,
    get_active_volunteer_project_ids,
)
from api.users.services.profile import get_volunteer_stats
from api.services.web_portal_profile import get_volunteer_activity
from api.users.services.organizer_permissions import is_approved_organizer
from api.users.services.telegram_sync import (
    generate_link_code,
    get_user_link_code,
    is_telegram_linked,
)
from api.users.services.email_verification import (
    verify_email_code,
    generate_verification_code,
    get_user_verification_code,
)
from api.utils.utils import normalize_phone
from api.tasks.models import Task, Photo, TaskAssignment
from api.users.models import Activity, VerificationCode
from api.projects.models import Project, VolunteerProject
from api.notifications.models import NotificationRecipient
from shared.notifications.utils import notify_organizer_new_photo
from .authentication import CsrfExemptSessionAuthentication

logger = logging.getLogger(__name__)
app_name = 'web_portal'
User = get_user_model()


def _build_auth_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    return {
        'access_token': str(refresh.access_token),
        'refresh_token': str(refresh),
    }


def _build_https_absolute_uri(request, path: str) -> str:
    url = request.build_absolute_uri(path)
    if url.startswith('http://'):
        url = url.replace('http://', 'https://', 1)
    return url


def _get_full_image_url(request, image_field):
    if not image_field or not getattr(image_field, 'url', None):
        return None
    try:
        return _build_https_absolute_uri(request, image_field.url)
    except Exception:
        return image_field.url


def _parse_optional_date(value):
    if value in (None, '', False):
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, str):
        parsed = parse_date(value)
        if parsed:
            return parsed
        parsed_dt = parse_datetime(value)
        if parsed_dt:
            return parsed_dt.date()
    return None


def _parse_optional_time(value):
    if value in (None, '', False):
        return None
    if isinstance(value, str):
        parsed = parse_time(value)
        if parsed:
            return parsed.replace(microsecond=0)
        parsed_dt = parse_datetime(value)
        if parsed_dt:
            return parsed_dt.time().replace(microsecond=0, tzinfo=None)
    if hasattr(value, 'replace'):
        try:
            return value.replace(microsecond=0, tzinfo=None)
        except TypeError:
            return value.replace(microsecond=0)
    return None


def _serialize_task_for_organizer(request, task):
    project = getattr(task, 'project', None)
    return {
        'id': task.id,
        'text': task.text,
        'status': task.status,
        'status_display': task.get_status_display() if hasattr(task, 'get_status_display') else task.status,
        'created_at': task.created_at.isoformat() if task.created_at else None,
        'start_date': task.start_date.isoformat() if task.start_date else None,
        'deadline_date': task.deadline_date.isoformat() if task.deadline_date else None,
        'start_time': task.start_time.strftime('%H:%M:%S') if task.start_time else None,
        'end_time': task.end_time.strftime('%H:%M:%S') if task.end_time else None,
        'decline_reason': getattr(task, 'decline_reason', None),
        'assignment_count': getattr(task, 'accepted_count', 0),
        'completed_count': getattr(task, 'completed_count', 0),
        'photo_reports_count': getattr(task, 'photo_reports_count', 0),
        'task_image_url': _get_full_image_url(request, getattr(task, 'task_image', None)),
        'project': {
            'id': project.id if project else None,
            'title': project.title if project else None,
            'city': project.city if project else None,
            'status': project.status if project else None,
            'status_display': project.get_status_display() if project and hasattr(project, 'get_status_display') else (project.status if project else None),
        } if project else None,
    }


def _active_project_chat_filter(today=None):
    current_day = today or timezone.localdate()
    return (
        Q(chat_type='project') &
        Q(project__isnull=False) &
        Q(project__is_deleted=False) &
        Q(project__status='approved') &
        (Q(project__end_date__isnull=True) | Q(project__end_date__gte=current_day))
    )


def _get_volunteer_chat_for_user(user, chat_id):
    today = timezone.localdate()
    cleanup_archived_project_chats(today=today)
    return get_object_or_404(
        Chat.objects.select_related('project'),
        Q(chat_type__in=['direct', 'group']) | _active_project_chat_filter(today),
        id=chat_id,
        participants=user,
        is_active=True,
    )


def _build_chat_message_preview(message):
    if message.text:
        return message.text
    if getattr(message, 'image', None):
        return 'Фото'
    if getattr(message, 'file', None):
        return 'Файл'
    return 'Вложение'


def _resolve_user(identifier: str) -> User | None:
    normalized_phone = normalize_phone(identifier)
    candidates = []
    if normalized_phone:
        candidates.append({'phone_number': normalized_phone})
    candidates.extend([
        {'username__iexact': identifier},
        {'email__iexact': identifier},
    ])
    for lookup in candidates:
        try:
            return User.objects.get(**lookup)
        except User.DoesNotExist:
            continue
    return None


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerRegistrationAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        # Логируем входящие данные для отладки
        logger.info(f"[VOL_REGISTER] Received data: {request.data}")
        logger.info(f"[VOL_REGISTER] Content-Type: {request.content_type}")
        
        serializer = VolunteerRegistrationSerializer(data=request.data)
        
        if not serializer.is_valid():
            logger.error(f"[VOL_REGISTER] Validation errors: {serializer.errors}")
            return Response({'detail': 'Ошибка валидации данных', 'errors': serializer.errors}, status=status.HTTP_400_BAD_REQUEST)

        try:
            payload = dict(serializer.validated_data)
            # password может быть пустой строкой с фронта — нормализуем в None
            if not payload.get('password'):
                payload['password'] = None
            result = register_volunteer(**payload)
            user = result.user
            logger.info("Веб-регистрация волонтёра создана (ожидает подтверждения email): id=%s", user.id)
            
            # НЕ входим автоматически - нужно подтвердить email
        except RegistrationError as exc:
            logger.error("[VOL_REGISTER] Failed: %s", exc)
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'message': 'Регистрация создана. Проверьте email для подтверждения.',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'full_name': user.name,
                    'phone_number': user.phone_number,
                    'email': user.email,
                    'registration_source': user.registration_source,
                    'role': user.role,
                    'is_active': user.is_active,
                },
                'requires_email_verification': True,
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerRegistrationAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        serializer = OrganizerRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            payload = dict(serializer.validated_data)
            # password может быть пустой строкой с фронта — нормализуем в None
            if not payload.get('password'):
                payload['password'] = None
            result = register_organizer(**payload)
            user = result.user
            logger.info("Веб-заявка организатора создана (ожидает подтверждения email): id=%s", user.id)
            
            # НЕ входим автоматически - нужно подтвердить email
        except RegistrationError as exc:
            logger.error("[ORG_REGISTER] Failed: %s", exc)
            return Response({'detail': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                'message': 'Заявка организатора создана. Проверьте email для подтверждения.',
                'user': {
                    'id': user.id,
                    'username': user.username,
                    'full_name': user.name,
                    'phone_number': user.phone_number,
                    'email': user.email,
                    'organization_name': user.organization_name,
                    'organizer_status': user.organizer_status,
                    'registration_source': user.registration_source,
                    'role': user.role,
                    'is_active': user.is_active,
                },
                'requires_email_verification': True,
            },
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_exempt, name='dispatch')
class EmailVerificationAPIView(APIView):
    """
    API для подтверждения email при регистрации
    """
    permission_classes = [AllowAny]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        """
        Подтвердить email кодом
        """
        email = request.data.get('email')
        code = request.data.get('code')
        
        if not email or not code:
            return Response(
                {'detail': 'Email и код обязательны.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        success, user, message = verify_email_code(email, code)
        
        if success and user:
            # Автоматически входим после подтверждения
            login(request, user, backend='django.contrib.auth.backends.ModelBackend')
            logger.info("Email подтверждён, пользователь вошёл в систему: %s", user.username)
            
            is_organizer = getattr(user, 'role', None) == 'organizer' or getattr(user, 'is_organizer', False)
            dashboard_url = '/organizer/dashboard' if is_organizer else '/volunteer/dashboard'
            tokens = _build_auth_tokens_for_user(user)
            
            return Response(
                {
                    'message': message,
                    'user': {
                        'id': user.id,
                        'username': user.username,
                        'full_name': user.name,
                        'phone_number': user.phone_number,
                        'email': user.email,
                        'registration_source': user.registration_source,
                        'role': getattr(user, 'role', None),
                        'is_organizer': is_organizer,
                        'organizer_status': getattr(user, 'organizer_status', None),
                        'is_active': user.is_active,
                    },
                    **tokens,
                    'dashboard_url': dashboard_url,
                },
                status=status.HTTP_200_OK,
            )
        else:
            return Response(
                {'detail': message},
                status=status.HTTP_400_BAD_REQUEST
            )


@method_decorator(csrf_exempt, name='dispatch')
class ResendVerificationCodeAPIView(APIView):
    """
    API для повторной отправки кода подтверждения email
    """
    permission_classes = [AllowAny]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        """
        Отправить код подтверждения повторно
        """
        email = request.data.get('email')
        
        if not email:
            return Response(
                {'detail': 'Email обязателен.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(email__iexact=email, is_active=False)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Пользователь с таким email не найден или уже активирован.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        try:
            generate_verification_code(user, email)
            logger.info("Код подтверждения повторно отправлен на email: %s", email)
            return Response(
                {
                    'message': 'Код подтверждения отправлен на ваш email.',
                },
                status=status.HTTP_200_OK,
            )
        except ValueError as e:
            # Ошибка генерации кода
            logger.error(f"Ошибка генерации кода подтверждения: {e}")
            return Response(
                {'detail': 'Не удалось сгенерировать код. Попробуйте позже.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
        except Exception as e:
            # Ошибка отправки email
            logger.error(f"Ошибка отправки email на {email}: {str(e)}")
            logger.error(f"Email settings: HOST={settings.EMAIL_HOST}, USER={settings.EMAIL_HOST_USER}, PASSWORD_SET={bool(settings.EMAIL_HOST_PASSWORD)}")
            # Возвращаем более информативное сообщение, но без раскрытия деталей
            error_message = 'Не удалось отправить email. Проверьте настройки почты на сервере.'
            if settings.DEBUG:
                error_message += f' Ошибка: {str(e)}'
            return Response(
                {'detail': error_message},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
class CancelRegistrationAPIView(APIView):
    """
    API для отмены регистрации (удаление неактивного пользователя)
    """
    permission_classes = [AllowAny]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        """
        Отменить регистрацию - удалить неактивного пользователя
        """
        email = request.data.get('email')
        
        logger.info(f"[CANCEL_REG] Received request to cancel registration for: {email}")
        
        if not email:
            return Response(
                {'detail': 'Email обязателен.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Ищем только неактивных пользователей (не подтвержденных)
            user = User.objects.get(email__iexact=email, is_active=False)
            
            # Удаляем все коды верификации пользователя (регистрация / сброс пароля и т.д.)
            VerificationCode.objects.filter(user=user).delete()
            
            # Удаляем пользователя
            user.delete()
            
            logger.info(f"[CANCEL_REG] ✅ Регистрация отменена, пользователь удален: {email}")
            return Response(
                {'message': 'Регистрация отменена.'},
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            # Пользователь не найден или уже активирован - это нормально
            logger.info(f"[CANCEL_REG] ⚠️ Попытка отменить регистрацию для несуществующего или активного пользователя: {email}")
            return Response(
                {'message': 'Регистрация не найдена или уже завершена.'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"[CANCEL_REG] ❌ Ошибка при отмене регистрации для {email}: {str(e)}")
            return Response(
                {'detail': 'Не удалось отменить регистрацию. Попробуйте позже.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
class PasswordResetRequestAPIView(APIView):
    """
    API для запроса сброса пароля
    Отправляет код подтверждения на email для сброса пароля
    """
    permission_classes = [AllowAny]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        """
        Запросить сброс пароля
        """
        logger.info(f"Password reset request received: {request.data}")
        email = request.data.get('email')
        
        if not email:
            logger.warning("Password reset request without email")
            return Response(
                {'detail': 'Email обязателен.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Сначала проверяем, существует ли пользователь вообще (без условия is_active)
            user = User.objects.get(email__iexact=email)
            logger.info(f"User found for password reset: {email}, is_active={user.is_active}, username={user.username}")
            
            # Если пользователь неактивен, все равно разрешаем сброс пароля
            if not user.is_active:
                logger.info(f"Password reset requested for inactive user: {email} (user_id={user.id})")
                # Продолжаем выполнение - разрешаем сброс пароля для неактивных пользователей
        except User.DoesNotExist:
            # Не раскрываем информацию о том, существует ли пользователь
            logger.warning(f"Password reset requested for non-existent email: {email}")
            # Проверяем, может быть email с другой регистрацией
            similar_emails = User.objects.filter(email__icontains=email.split('@')[0]).values_list('email', flat=True)
            if similar_emails:
                logger.info(f"Found similar emails: {list(similar_emails)}")
            return Response(
                {
                    'message': 'Если аккаунт с таким email существует, на него будет отправлен код для сброса пароля.'
                },
                status=status.HTTP_200_OK
            )
        
        try:
            # Генерируем код для сброса пароля
            from datetime import timedelta
            import secrets

            # Деактивируем только предыдущие неиспользованные коды сброса пароля (не трогаем регистрацию)
            VerificationCode.objects.filter(
                email__iexact=email,
                verification_type=VerificationCode.VERIFICATION_PASSWORD_RESET,
                is_used=False,
            ).update(is_used=True)

            # Генерируем уникальный 6-значный код
            max_attempts = 10
            code = None
            for attempt in range(max_attempts):
                code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
                if not VerificationCode.objects.filter(
                    code=code,
                    email__iexact=email,
                    verification_type=VerificationCode.VERIFICATION_PASSWORD_RESET,
                    is_used=False,
                    expires_at__gt=timezone.now()
                ).exists():
                    break
            else:
                logger.error(f"Failed to generate unique password reset code after {max_attempts} attempts")
                return Response(
                    {'detail': 'Не удалось сгенерировать код. Попробуйте позже.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )

            expires_at = timezone.now() + timedelta(minutes=15)

            # Создаем запись о коде
            verification_code = VerificationCode.objects.create(
                verification_type=VerificationCode.VERIFICATION_PASSWORD_RESET,
                code=code,
                email=email,
                user=user,
                expires_at=expires_at
            )
            
            # Отправляем email с кодом для сброса пароля
            subject = "Сброс пароля в BirQadam"
            message = f"""
Здравствуйте, {user.name or user.username}!

Вы запросили сброс пароля в BirQadam.

Ваш код для сброса пароля: {code}

Код действителен в течение 15 минут.

Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.

─────────────────────────────────────────────────────────
С уважением,
Команда BirQadam
🌱 Вместе делаем город чище!
"""
            
            from django.core.mail import send_mail
            try:
                send_mail(
                    subject=subject,
                    message=message,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=[email],
                    fail_silently=False,
                )
                logger.info(
                    "Password reset code sent email=%s user_id=%s",
                    email,
                    user.id,
                )
            except Exception as email_error:
                logger.error(f"Failed to send password reset email to {email}: {str(email_error)}")
                logger.error(f"Email settings: FROM={settings.DEFAULT_FROM_EMAIL}, HOST={getattr(settings, 'EMAIL_HOST', 'N/A')}")
                raise  # Пробрасываем ошибку дальше

            return Response(
                {
                    'message': 'Код для сброса пароля отправлен на ваш email.',
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.error(f"Ошибка при отправке кода сброса пароля на {email}: {str(e)}")
            return Response(
                {'detail': 'Не удалось отправить код. Попробуйте позже.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
class PasswordResetConfirmAPIView(APIView):
    """
    API для подтверждения сброса пароля
    Устанавливает новый пароль по коду
    """
    permission_classes = [AllowAny]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        """
        Подтвердить сброс пароля и установить новый пароль
        """
        email = request.data.get('email')
        code = request.data.get('code')
        new_password = request.data.get('new_password')
        
        if not all([email, code, new_password]):
            return Response(
                {'detail': 'Email, код и новый пароль обязательны.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(new_password) < 8:
            return Response(
                {'detail': 'Пароль должен содержать не менее 8 символов.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            return Response(
                {'detail': 'Пользователь не найден.'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Проверяем код сброса пароля (отдельный тип от регистрации)
        verification_code = VerificationCode.objects.filter(
            user=user,
            email__iexact=email,
            code=code,
            verification_type=VerificationCode.VERIFICATION_PASSWORD_RESET,
            is_used=False
        ).order_by('-created_at').first()
        
        if not verification_code:
            return Response(
                {'detail': 'Код не найден или уже использован.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if verification_code.is_expired():
            return Response(
                {'detail': 'Код истёк. Запросите новый код.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Устанавливаем новый пароль
        try:
            user.set_password(new_password)
            user.save()
            
            # Помечаем код как использованный
            verification_code.is_used = True
            verification_code.used_at = timezone.now()
            verification_code.save()
            
            logger.info(f"Password reset completed for user: {user.username} (email: {email})")
            return Response(
                {
                    'message': 'Пароль успешно изменён. Теперь вы можете войти с новым паролем.'
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Ошибка при установке нового пароля: {e}")
            return Response(
                {'detail': 'Не удалось установить новый пароль. Попробуйте позже.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerLoginAPIView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        identifier = serializer.validated_data['identifier']
        password = serializer.validated_data['password']

        user = _resolve_user(identifier)
        if not user:
            logger.warning("[LOGIN] User not found for identifier %s", identifier)
        elif not user.check_password(password):
            logger.warning("[LOGIN] Invalid password for user %s", user.username)

        if not user or not user.check_password(password):
            return Response({'detail': 'Неверный логин или пароль.'}, status=status.HTTP_400_BAD_REQUEST)

        if not user.is_active:
            logger.warning("[LOGIN] User %s is inactive", user.username)
            # Проверяем, не подтвержден ли email
            if user.email:
                verification_code = get_user_verification_code(user, user.email)
                if verification_code and verification_code.is_valid():
                    return Response({
                        'detail': 'Аккаунт не активирован. Подтвердите email для входа.',
                        'requires_email_verification': True,
                        'email': user.email,
                    }, status=status.HTTP_400_BAD_REQUEST)
            return Response({'detail': 'Аккаунт отключен. Обратитесь к администратору.'}, status=status.HTTP_400_BAD_REQUEST)

        login(request, user, backend='django.contrib.auth.backends.ModelBackend')
        logger.info("Пользователь вошёл в систему через веб-портал: %s (role=%s, is_organizer=%s, organizer_status=%s)", user.username, getattr(user, 'role', None), getattr(user, 'is_organizer', False), getattr(user, 'organizer_status', None))
        # Кабинет организатора по роли (модерация на портале)
        is_organizer_cabinet = (
            getattr(user, 'role', None) == 'organizer' or getattr(user, 'is_organizer', False)
        )
        dashboard_url = '/organizer/dashboard' if is_organizer_cabinet else '/volunteer/dashboard'
        tokens = _build_auth_tokens_for_user(user)
        return Response(
            {
                'message': 'Вход выполнен успешно.',
                'user': VolunteerProfileSerializer(user).data,
                **tokens,
                'dashboard_url': dashboard_url,
            },
            status=status.HTTP_200_OK,
        )


class VolunteerLogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerMeAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        user = request.user
        return Response(
            {
                'id': user.id,
                'username': user.username,
                'full_name': getattr(user, 'name', ''),
                'phone_number': user.phone_number,
                'email': user.email,
                'registration_source': user.registration_source,
                'role': getattr(user, 'role', None),
                'is_organizer': getattr(user, 'is_organizer', False),
                'organizer_status': getattr(user, 'organizer_status', None),
                'is_approved': getattr(user, 'is_approved', False),
                'organization_name': getattr(user, 'organization_name', None),
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerProfileAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def get(self, request, *args, **kwargs):
        serializer = VolunteerProfileSerializer(request.user)
        data = serializer.data
        logger.info(f"VolunteerProfileAPIView: Full data for user {request.user.username}: {data}")
        return Response(data, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        serializer = VolunteerProfileSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class ChangePasswordAPIView(APIView):
    """
    API для изменения пароля авторизованным пользователем
    Требует текущий пароль и новый пароль
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        """
        Изменить пароль пользователя
        """
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')
        
        if not current_password or not new_password:
            return Response(
                {'detail': 'Текущий пароль и новый пароль обязательны.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(new_password) < 8:
            return Response(
                {'detail': 'Пароль должен содержать не менее 8 символов.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        user = request.user
        
        # Проверяем текущий пароль
        if not user.check_password(current_password):
            return Response(
                {'detail': 'Неверный текущий пароль.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Устанавливаем новый пароль
        try:
            user.set_password(new_password)
            user.save(update_fields=['password'])
            
            # Обновляем сессию, чтобы пользователь остался залогиненным
            from django.contrib.auth import update_session_auth_hash
            update_session_auth_hash(request, user)
            
            logger.info(f"Password changed for user: {user.username} (id: {user.id})")
            return Response(
                {
                    'message': 'Пароль успешно изменён.'
                },
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Ошибка при изменении пароля: {e}", exc_info=True)
            return Response(
                {'detail': 'Не удалось изменить пароль. Попробуйте позже.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
class TelegramSyncAPIView(APIView):
    """
    API для синхронизации аккаунта с Telegram ботом
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        """
        Получить статус привязки Telegram и активный код (если есть)
        """
        user = request.user
        is_linked = is_telegram_linked(user)
        active_code = get_user_link_code(user)
        
        return Response({
            'is_linked': is_linked,
            'telegram_id': user.telegram_id if is_linked else None,
            'active_code': active_code,
            'registration_source': user.registration_source,
        }, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        """
        Генерировать новый код для привязки Telegram
        """
        user = request.user
        
        # Проверяем, не привязан ли уже Telegram
        if is_telegram_linked(user):
            return Response({
                'detail': 'Telegram аккаунт уже привязан.',
                'telegram_id': user.telegram_id,
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # Генерируем новый код
        code = generate_link_code(user)
        
        logger.info(f"Generated Telegram link code for user {user.id}: {code}")
        
        return Response({
            'code': code,
            'message': 'Код для привязки Telegram сгенерирован. Используйте команду /link в Telegram боте BirQadam.',
            'expires_in_minutes': 10,
        }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        # Отладка аутентификации
        logger.info(f"[DASHBOARD] User: {request.user}, Authenticated: {request.user.is_authenticated}")
        logger.info(f"[DASHBOARD] Headers: {dict(request.headers)}")
        logger.info(f"[DASHBOARD] Cookies: {request.COOKIES}")
        
        data = get_volunteer_dashboard_data(request.user)
        # Гарантируем, что всегда возвращаются массивы, даже если данные отсутствуют
        tasks_list = data.get('tasks') or []
        projects_list = data.get('projects') or []
        photos_list = data.get('photos') or []
        notifications_list = data.get('notifications') or []
        
        response = {
            'summary': data.get('summary', {}),
            'tasks': VolunteerTaskSummarySerializer(tasks_list, many=True, context={'request': request}).data or [],
            'projects': VolunteerProjectSerializer(projects_list, many=True, context={'request': request}).data or [],
            'photos': VolunteerPhotoSerializer(photos_list, many=True, context={'request': request}).data or [],
            'notifications': VolunteerNotificationSerializer(notifications_list, many=True, context={'request': request}).data or [],
            'moderation': {
                'pending_photo_reports': data.get('summary', {}).get('pending_photos', 0),
                'unread_notifications': data.get('summary', {}).get('unread_notifications', 0),
            },
        }
        return Response(response, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerTaskPhotoReportAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)
    parser_classes = (MultiPartParser, FormParser)
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get(self, request, task_id: int, *args, **kwargs):
        try:
            Task.objects.get(
                id=task_id,
                assignments__volunteer=request.user,
                is_deleted=False,
            )
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена или не назначена вам.'}, status=status.HTTP_404_NOT_FOUND)

        photos_qs = Photo.objects.select_related('project', 'task').filter(
            task_id=task_id,
            volunteer=request.user,
            is_deleted=False,
        ).order_by('-uploaded_at')

        serializer = VolunteerPhotoSerializer(photos_qs, many=True, context={'request': request})
        return Response({'photos': serializer.data}, status=status.HTTP_200_OK)

    def post(self, request, task_id: int, *args, **kwargs):
        try:
            task = Task.objects.select_related('project').get(
                id=task_id,
                assignments__volunteer=request.user,
                is_deleted=False,
            )
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена или не назначена вам.'}, status=status.HTTP_404_NOT_FOUND)

        # Проверяем, есть ли уже активный фотоотчет (не отклоненный)
        accepted_assignment = task.assignments.filter(volunteer=request.user, accepted=True).exists()
        if not accepted_assignment:
            return Response(
                {'detail': 'Сначала примите задачу, чтобы загрузить фотоотчёт.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if task.is_expired():
            return Response(
                {'detail': 'Срок задачи уже истёк. Загрузка фотоотчёта недоступна.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if task.status not in ['in_progress', 'revision']:
            return Response(
                {'detail': 'Сейчас для этой задачи нельзя загрузить фотоотчёт.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing_active_photos = Photo.objects.filter(
            task=task,
            volunteer=request.user,
            is_deleted=False
        ).exclude(status='rejected').exists()

        if existing_active_photos and task.status != 'revision':
            return Response(
                {'detail': 'Вы уже отправили фотоотчёт для этой задачи.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        files = request.FILES.getlist('photos')
        if not files:
            return Response(
                {'detail': 'Загрузите хотя бы одну фотографию.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if len(files) > 5:
            return Response(
                {'detail': 'Можно загрузить максимум 5 фотографий за один отчёт.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comment = request.data.get('comment', '')

        created_photos = []
        for uploaded_file in files:
            photo = Photo.objects.create(
                volunteer=request.user,
                project=task.project,
                task=task,
                image=uploaded_file,
                status='pending',
                volunteer_comment=comment,
            )
            created_photos.append(photo)

        # После отправки фотоотчёта задача переходит в статус "На проверке"
        if task.status in ['in_progress', 'revision']:
            task.status = 'under_review'
            task.save(update_fields=['status'])

        Activity.objects.create(
            user=request.user,
            type='photo_uploaded',
            title='Фотоотчёт отправлен',
            description=f'Вы отправили {len(created_photos)} фото для задачи "{task.text}"',
            project=task.project,
        )

        try:
            first_photo = created_photos[0]
            async_to_sync(notify_organizer_new_photo)(
                organizer=task.project.creator,
                photo_report=first_photo,
                volunteer=request.user,
                project=task.project,
                task=task,
            )
        except Exception as exc:  # pragma: no cover - уведомления не критичны
            logger.warning("[PHOTO] Failed to notify organizer: %s", exc)

        serializer = VolunteerPhotoSerializer(created_photos, many=True, context={'request': request})

        return Response(
            {
                'message': f'Фотоотчёт успешно отправлен ({len(created_photos)} фото).',
                'photos': serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def delete(self, request, task_id: int, *args, **kwargs):
        """Удаление (отзыв) фотоотчета для задачи"""
        try:
            task = Task.objects.select_related('project').get(
                id=task_id,
                assignments__volunteer=request.user,
                is_deleted=False,
            )
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена или не назначена вам.'}, status=status.HTTP_404_NOT_FOUND)

        # Находим все фотоотчеты для этой задачи от текущего волонтера
        photos = Photo.objects.filter(
            task=task,
            volunteer=request.user,
            is_deleted=False,
        )

        if not photos.exists():
            return Response(
                {'detail': 'Фотоотчёт не найден.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Мягкое удаление всех фотоотчетов
        photos_count = photos.count()
        for photo in photos:
            photo.delete()  # Использует мягкое удаление (is_deleted=True)

        Activity.objects.create(
            user=request.user,
            type='photo_withdrawn',
            title='Фотоотчёт отозван',
            description=f'Вы отозвали фотоотчёт для задачи "{task.text}"',
            project=task.project,
        )

        return Response(
            {'message': f'Фотоотчёт успешно отозван ({photos_count} фото). Теперь вы можете загрузить новый фотоотчёт.'},
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerPhotoReportsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        status_filter = request.query_params.get('status')
        valid_statuses = {'pending', 'approved', 'rejected'}
        if status_filter and status_filter not in valid_statuses:
            return Response({'detail': 'Недопустимый статус.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            limit = int(request.query_params.get('limit', 50))
        except ValueError:
            return Response({'detail': 'Параметр limit должен быть числом.'}, status=status.HTTP_400_BAD_REQUEST)
        limit = max(1, min(limit, 200))

        photos_qs = Photo.objects.select_related('project', 'task').filter(
            volunteer=request.user,
            is_deleted=False,
        ).order_by('-uploaded_at')

        if status_filter:
            photos_qs = photos_qs.filter(status=status_filter)

        photos = list(photos_qs[:limit])

        serializer = VolunteerPhotoSerializer(photos, many=True, context={'request': request})

        summary = {
            'total': photos_qs.count(),
            'pending': photos_qs.filter(status='pending').count(),
            'approved': photos_qs.filter(status='approved').count(),
            'rejected': photos_qs.filter(status='rejected').count(),
        }

        return Response(
            {
                'photos': serializer.data,
                'summary': summary,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerTaskAcceptAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, task_id: int, *args, **kwargs):
        try:
            task = Task.objects.select_related('project').get(
                id=task_id,
                status='open',
                is_deleted=False,
            )
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена или недоступна.'}, status=status.HTTP_404_NOT_FOUND)

        is_participant = VolunteerProject.objects.select_related('creator').filter(volunteer=request.user,
            project=task.project,
            is_active=True,
        ).exists()

        if not is_participant:
            return Response({'detail': 'Сначала присоединитесь к проекту.'}, status=status.HTTP_403_FORBIDDEN)

        existing_assignment = TaskAssignment.objects.filter(
            task=task,
            volunteer=request.user,
        ).first()

        if existing_assignment:
            if existing_assignment.accepted:
                return Response({'message': 'Вы уже взялись за эту задачу.', 'task_status': task.status}, status=status.HTTP_200_OK)
            existing_assignment.accepted = True
            existing_assignment.save(update_fields=['accepted'])
        else:
            TaskAssignment.objects.create(
                task=task,
                volunteer=request.user,
                accepted=True,
            )

        task.status = 'in_progress'
        task.save(update_fields=['status'])

        Activity.objects.create(
            user=request.user,
            type='task_assigned',
            title='Взялись за задачу',
            description=f'Вы взялись за выполнение задачи \"{task.text}\"',
            project=task.project,
        )

        return Response(
            {
                'message': 'Задача добавлена в ваши активные.',
                'task_status': task.status,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerTaskDeclineAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, task_id: int, *args, **kwargs):
        try:
            task = Task.objects.get(id=task_id, is_deleted=False)
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        assignment = TaskAssignment.objects.filter(
            task=task,
            volunteer=request.user,
        ).first()

        # Флаг для применения штрафа: штраф применяется только если задача была принята
        should_penalize = False
        if assignment and assignment.accepted:
            should_penalize = True

        if assignment:
            assignment.accepted = False
            assignment.completed = False
            assignment.save(update_fields=['accepted', 'completed'])

            if not TaskAssignment.objects.select_related('task', 'volunteer').filter(task=task, accepted=True).exists():
                task.status = 'open'
                task.save(update_fields=['status'])
        else:
            TaskAssignment.objects.create(
                task=task,
                volunteer=request.user,
                accepted=False,
            )

        # Применяем штраф -2 TF за отклонение принятой задачи
        updated_trust_factor = None
        if should_penalize:
            from django.db import transaction
            
            with transaction.atomic():
                # Получаем пользователя с блокировкой
                user = User.objects.select_for_update().get(pk=request.user.pk)
                # Изменяем TF (метод сам сохранит историю)
                user._change_trust_factor(-2, 'task_decline', 'task', task_id)
            
            # Обновляем request.user для ответа
            request.user.refresh_from_db()
            updated_trust_factor = request.user.trust_factor  # type: ignore[attr-defined]

        response_data = {
            'message': 'Задача скрыта из ваших активных.',
            'task_status': task.status,
        }
        
        if updated_trust_factor is not None:
            response_data['trust_factor'] = updated_trust_factor
            response_data['penalty_applied'] = True

        return Response(
            response_data,
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerTaskCompleteAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, task_id: int, *args, **kwargs):
        try:
            task = Task.objects.get(id=task_id, is_deleted=False)
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        assignment = TaskAssignment.objects.filter(
            task=task,
            volunteer=request.user,
            accepted=True,
        ).first()

        if not assignment:
            return Response({'detail': 'Вы ещё не взялись за эту задачу.'}, status=status.HTTP_400_BAD_REQUEST)

        if assignment.completed:
            return Response({'message': 'Задача уже отмечена как выполненная.'}, status=status.HTTP_200_OK)

        assignment.completed = True
        assignment.completed_at = timezone.now()
        assignment.save(update_fields=['completed', 'completed_at'])

        Activity.objects.create(
            user=request.user,
            type='task_completed',
            title='Отметили задачу выполненной',
            description=f'Задача \"{task.text}\" помечена выполненной. Загрузите фотоотчёт для проверки.',
            project=task.project,
        )

        return Response(
            {
                'message': 'Задача отмечена выполненной. Не забудьте прикрепить фотоотчёт.',
                'task_status': task.status,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerTaskRetryAPIView(APIView):
    """Переделать отклоненную задачу"""
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, task_id: int, *args, **kwargs):
        """
        Переделать отклоненную задачу - возвращает задачу в статус 'open' для повторного выполнения
        """
        try:
            task = Task.objects.select_related('project', 'creator').get(id=task_id, is_deleted=False)
        except Task.DoesNotExist:
            return Response({'detail': 'Задача не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        # Проверяем, что задача отклонена
        if task.status != 'failed':
            return Response(
                {'detail': f'Задачу можно переделать только если она отклонена. Текущий статус: {task.get_status_display()}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Проверяем, что пользователь является волонтером проекта или организатором проекта
        is_volunteer = task.project.volunteer_projects.filter(
            volunteer=request.user,
            is_active=True
        ).exists()
        is_organizer = task.project.creator == request.user or (
            hasattr(request.user, 'is_organizer') and request.user.is_organizer
        )

        if not (is_volunteer or is_organizer):
            return Response(
                {'detail': 'У вас нет прав для переделки этой задачи.'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            # Переделываем задачу
            task.retry()
            
            # Создаем активность для уведомления
            Activity.objects.create(
                user=request.user,
                type='task_assigned',
                title='Задача переделана',
                description=f'Задача "{task.text[:50]}..." для проекта "{task.project.title}" переделана и доступна для выполнения.',
                project=task.project
            )

            logger.info(f"Task {task_id} retried by user {request.user.username}")

            return Response(
                {
                    'message': 'Задача переделана и доступна для выполнения.',
                    'task_status': task.status,
                    'task': {
                        'id': task.id,
                        'status': task.status,
                        'status_display': task.get_status_display(),
                    }
                },
                status=status.HTTP_200_OK,
            )
        except ValueError as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(f"Error retrying task {task_id}: {e}")
            return Response(
                {'detail': 'Произошла ошибка при переделке задачи.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerProjectsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        catalog = get_projects_catalog(request.user, request=request)
        logger.info(f"[DEBUG] VolunteerProjectsAPIView: catalog has {len(catalog['projects'])} projects, summary={catalog['summary']}")
        
        # Логируем названия всех проектов для отладки
        project_titles = [p.get('title', 'N/A') for p in catalog['projects']]
        logger.info(f"[DEBUG] VolunteerProjectsAPIView: Project titles: {project_titles}")
        
        serializer = VolunteerProjectCatalogSerializer(catalog['projects'], many=True)
        response_data = {'projects': serializer.data, 'summary': catalog['summary']}
        logger.info(f"[DEBUG] VolunteerProjectsAPIView: returning {len(serializer.data)} serialized projects")
        return Response(
            response_data,
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerProjectJoinAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, project_id: int, *args, **kwargs):
        try:
            project = Project.objects.select_related('creator').get(
                id=project_id,
                is_deleted=False,
                status='approved',
            )
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден или недоступен.'}, status=status.HTTP_404_NOT_FOUND)

        current_trust_factor = getattr(request.user, 'trust_factor', 0)
        if not request.user.can_join_projects():  # type: ignore[attr-defined]
            return Response(
                {
                    'detail': 'При Trust Factor 0 присоединиться к проекту нельзя.',
                    'trust_factor': current_trust_factor,
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        birqadam_project, created = VolunteerProject.objects.get_or_create(
            volunteer=request.user,
            project=project,
            defaults={'is_active': True},
        )

        if not created and not birqadam_project.is_active:
            birqadam_project.is_active = True
            birqadam_project.save(update_fields=['is_active'])

        Activity.objects.create(
            user=request.user,
            type='project_joined',
            title='Участие в проекте',
            description=f'Вы присоединились к проекту \"{project.title}\"',
            project=project,
        )

        catalog = get_projects_catalog(request.user, request=request)
        serializer = VolunteerProjectCatalogSerializer(catalog['projects'], many=True)

        return Response(
            {
                'message': 'Вы успешно присоединились к проекту.',
                'projects': serializer.data,
                'summary': catalog['summary'],
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerProjectLeaveAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, project_id: int, *args, **kwargs):
        """Выход волонтера из проекта"""
        from api.projects.models import VolunteerProject
        from api.tasks.models import TaskAssignment, Task
        from api.models import Activity
        from django.db import transaction
        from django.utils import timezone
        
        # Получаем причину выхода из запроса
        leave_reason = request.data.get('reason', '').strip()
        
        if not leave_reason:
            return Response({
                'error': 'Необходимо указать причину выхода из проекта'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            birqadam_project = VolunteerProject.objects.select_related('project').get(
                volunteer=request.user,
                project_id=project_id,
                is_active=True
            )
            project = birqadam_project.project
            
            # Проверяем, не отменен ли проект организатором
            # Если проект отменен, штраф не начисляется
            should_penalize = project.status != 'cancelled'
            
            # Деактивируем участие вместо удаления (для истории)
            birqadam_project.is_active = False
            birqadam_project.save(update_fields=['is_active'])
            
            # Обрабатываем задачи волонтера при выходе из проекта
            incomplete_assignments = TaskAssignment.objects.filter(
                volunteer=request.user,
                task__project=project,
                task__is_deleted=False,
                completed=False
            ).select_related('task')
            
            # Отменяем все невыполненные назначения
            for assignment in incomplete_assignments:
                task = assignment.task
                was_accepted = assignment.accepted
                
                # Отменяем назначение
                assignment.accepted = False
                assignment.completed = False
                assignment.completed_at = None
                assignment.save(update_fields=['accepted', 'completed', 'completed_at'])
                
                # Если задача была принята этим волонтером и больше нет принятых назначений,
                # возвращаем задачу в статус 'open'
                if was_accepted:
                    has_other_accepted = TaskAssignment.objects.filter(
                        task=task,
                        accepted=True,
                        completed=False
                    ).exclude(volunteer=request.user).exists()
                    
                    if not has_other_accepted and task.status == 'in_progress':
                        task.status = 'open'
                        task.save(update_fields=['status'])
            
            # Начисляем штраф -5 TF, если проект не отменен
            updated_trust_factor = None
            if should_penalize:
                with transaction.atomic():
                    # Получаем пользователя с блокировкой
                    user = request.user.__class__.objects.select_for_update().get(pk=request.user.pk)
                    # Изменяем TF (метод сам сохранит историю)
                    user._change_trust_factor(-5, 'project_leave', 'project', project_id)
                
                # Обновляем request.user для ответа
                request.user.refresh_from_db()
                updated_trust_factor = request.user.trust_factor  # type: ignore[attr-defined]
            else:
                updated_trust_factor = request.user.trust_factor  # type: ignore[attr-defined]
            
            # Создаём активность
            Activity.objects.create(
                user=request.user,
                type='project_left',
                title='Покинули проект',
                description=f'Вы покинули проект "{project.title}". Причина: {leave_reason}',
                project=project
            )

            return Response({
                'message': 'Вы успешно покинули проект.',
                'trust_factor': updated_trust_factor,
                'penalty_applied': should_penalize,
            }, status=status.HTTP_200_OK)
        except VolunteerProject.DoesNotExist:
            return Response({
                'error': 'Вы не участвуете в этом проекте'
            }, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f'Error leaving project: {e}', exc_info=True)
            return Response({
                'error': 'Произошла ошибка при выходе из проекта'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerNotificationsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        from api.users.models import Activity
        
        limit_param = request.query_params.get('limit')
        try:
            limit = max(1, min(int(limit_param or 50), 200))
        except (TypeError, ValueError):
            limit = 50

        # Получаем уведомления из NotificationRecipient (исключаем delivered, opened, clicked - они уже прочитаны)
        notifications_qs = (
            NotificationRecipient.objects.select_related('notification')
            .filter(user=request.user)
            .exclude(status__in=['delivered', 'opened', 'clicked'])  # Исключаем прочитанные статусы
            .order_by('-created_at')[:limit]
        )

        # Получаем и непрочитанные Activity записи
        activities_qs = (
            Activity.objects.select_related('project')
            .filter(user=request.user)
            .order_by('-created_at')[:limit]
        )

        # Объединяем уведомления и активности
        all_notifications = []
        
        # Добавляем Activity записи как уведомления
        for activity in activities_qs:
            all_notifications.append({
                'id': activity.id,
                'subject': activity.title,
                'message': activity.description,
                'notification_type': activity.type,
                'status': 'opened' if activity.is_read else 'pending',
                'sent_at': activity.created_at.isoformat() if activity.created_at else None,
                'delivered_at': activity.created_at.isoformat() if activity.created_at else None,
                'opened_at': None,
                'created_at': activity.created_at.isoformat() if activity.created_at else None,
                'activity_id': activity.id,
                'project_id': activity.project.id if activity.project else None,
                'project_title': activity.project.title if activity.project else None,
            })

        # Добавляем обычные уведомления
        serializer = VolunteerNotificationSerializer(
            notifications_qs,
            many=True,
            context={'request': request},
        )
        all_notifications.extend(serializer.data)

        # Сортируем по дате создания (новые первыми)
        all_notifications.sort(key=lambda x: x.get('created_at', ''), reverse=True)
        
        # Берем только нужное количество
        all_notifications = all_notifications[:limit]

        unread_count = (
            NotificationRecipient.objects.filter(
                user=request.user,
                status__in=['pending', 'sent'],
            ).count() +
            Activity.objects.filter(user=request.user, is_read=False).count()
        )

        return Response(
            {
                'notifications': all_notifications,
                'summary': {
                    'count': len(all_notifications),
                    'unread_count': unread_count,
                },
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerNotificationReadAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, notification_id: int, *args, **kwargs):
        # Проверяем, является ли это Activity записью (по activity_id в query params)
        activity_id = request.data.get('activity_id') or request.query_params.get('activity_id')
        
        if activity_id:
            # Это Activity запись - помечаем как прочитанную (просто удаляем из непрочитанных)
            try:
                activity = Activity.objects.get(
                    id=activity_id,
                    user=request.user,
                )
                activity.is_read = True
                activity.save(update_fields=['is_read'])
                return Response({'message': 'Уведомление отмечено прочитанным.'}, status=status.HTTP_200_OK)
            except Activity.DoesNotExist:  # type: ignore[attr-defined]
                return Response({'detail': 'Уведомление не найдено.'}, status=status.HTTP_404_NOT_FOUND)
        
        # Обычное уведомление из NotificationRecipient
        try:
            recipient = NotificationRecipient.objects.get(
                id=notification_id,
                user=request.user,
            )
        except NotificationRecipient.DoesNotExist:
            return Response({'detail': 'Уведомление не найдено.'}, status=status.HTTP_404_NOT_FOUND)

        if recipient.status not in ['opened', 'clicked']:
            recipient.status = 'opened'
            recipient.opened_at = timezone.now()
            recipient.save(update_fields=['status', 'opened_at'])

        return Response({'message': 'Уведомление отмечено прочитанным.'}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerNotificationReadAllAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        # Помечаем все NotificationRecipient как прочитанные
        updated = NotificationRecipient.objects.filter(
            user=request.user,
            status__in=['pending', 'sent'],
        ).update(status='opened', opened_at=timezone.now())

        # Помечаем все Activity записи как прочитанные
        Activity.objects.filter(user=request.user, is_read=False).update(is_read=True)
        
        return Response(
            {
                'message': 'Все уведомления отмечены прочитанными.',
                'updated_count': updated,
            },
            status=status.HTTP_200_OK,
        )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerStatsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        try:
            stats = get_volunteer_stats(request.user)
            
            # Логируем для отладки ДО сериализации
            logger.info(f'Stats for user {request.user.username}: achievements count = {len(stats.get("achievements", []))}')
            if stats.get("achievements"):
                logger.info(f'First achievement sample: {stats.get("achievements", [])[0] if stats.get("achievements") else None}')
            
            # Гарантируем, что achievements всегда является списком
            if 'achievements' not in stats or stats['achievements'] is None:
                stats['achievements'] = []
            
            # ВРЕМЕННО: возвращаем данные напрямую для диагностики
            # TODO: Включить сериализацию после исправления проблемы
            logger.warning('WARNING: TEMPORARY: Returning raw stats data without serializer for debugging')
            return Response(stats, status=status.HTTP_200_OK)
            
            # Закомментировано для диагностики:
            # try:
            #     # Для Serializer (не ModelSerializer) данные передаются в конструктор
            #     serializer = VolunteerStatsSerializer(instance=stats)
            #     
            #     # Проверяем сериализованные данные
            #     serialized_data = serializer.data
            #     logger.info(f'Serialized achievements count: {len(serialized_data.get("achievements", []))}')
            #     if serialized_data.get("achievements"):
            #         logger.info(f'First serialized achievement: {serialized_data.get("achievements", [])[0]}')
            #     
            #     return Response(serialized_data, status=status.HTTP_200_OK)
            # except Exception as ser_error:
            #     logger.error(f'Serializer error: {ser_error}')
            #     import traceback
            #     logger.error(traceback.format_exc())
            #     # Если сериализация не удалась, возвращаем данные напрямую
            #     logger.warning('Returning raw stats data due to serializer error')
            #     return Response(stats, status=status.HTTP_200_OK)
        except Exception as e:
            import traceback
            logger.error(f'Error in VolunteerStatsAPIView: {e}')
            logger.error(traceback.format_exc())
            return Response(
                {'detail': f'Ошибка при загрузке статистики: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerActivityAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        activity = get_volunteer_activity(request.user, start_date_str=start_date, end_date_str=end_date)
        serializer = VolunteerActivitySeriesSerializer(activity)
        return Response(serializer.data, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerProfileAPIView(APIView):
    """
    API для получения и обновления профиля организатора (включая портфолио)
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)
    parser_classes = (MultiPartParser, FormParser)

    def get(self, request, *args, **kwargs):
        """Получить профиль организатора"""
        user = request.user
        if not (user.is_organizer or user.role == 'organizer'):
            return Response({'detail': 'Доступ запрещен. Только для организаторов.'}, status=status.HTTP_403_FORBIDDEN)
        
        portfolio_photo_url = None
        if user.portfolio_photo and user.portfolio_photo.url:
            try:
                portfolio_photo_url = self._get_full_image_url(request, user.portfolio_photo)
                # Убеждаемся, что это полный URL и используем https
                if not portfolio_photo_url.startswith('http'):
                    scheme = 'https'  # Всегда используем https
                    host = request.get_host() if hasattr(request, 'get_host') else ''
                    if host:
                        portfolio_photo_url = f'{scheme}://{host}{user.portfolio_photo.url}'
                # Заменяем http на https, если есть
                elif portfolio_photo_url.startswith('http://'):
                    portfolio_photo_url = portfolio_photo_url.replace('http://', 'https://')
            except Exception:
                # Fallback на относительный путь, если не удалось построить абсолютный
                portfolio_photo_url = user.portfolio_photo.url
        
        return Response({
            'id': user.id,
            'username': user.username,
            'full_name': user.name,
            'email': user.email,
            'phone_number': user.phone_number,
            'organization_name': user.organization_name,
            'portfolio': {
                'age': user.age,
                'gender': user.gender,
                'bio': user.bio,
                'work_experience_years': user.work_experience_years,
                'work_history': user.work_history,
                'portfolio_photo_url': portfolio_photo_url,
            },
        }, status=status.HTTP_200_OK)

    def patch(self, request, *args, **kwargs):
        """Обновить профиль организатора"""
        user = request.user
        if not (user.is_organizer or user.role == 'organizer'):
            return Response({'detail': 'Доступ запрещен. Только для организаторов.'}, status=status.HTTP_403_FORBIDDEN)
        
        # Обновляем основные поля
        if 'full_name' in request.data:
            user.name = request.data['full_name']
        
        # Обновляем название организации
        if 'organization_name' in request.data:
            user.organization_name = request.data['organization_name']
        
        # Обновляем портфолио
        if 'age' in request.data:
            age = request.data.get('age')
            user.age = int(age) if age else None
        if 'gender' in request.data:
            user.gender = request.data.get('gender') or None
        if 'bio' in request.data:
            user.bio = request.data.get('bio') or None
        if 'work_experience_years' in request.data:
            exp = request.data.get('work_experience_years')
            user.work_experience_years = int(exp) if exp else None
        if 'work_history' in request.data:
            user.work_history = request.data.get('work_history') or None
        
        # Обновляем фото портфолио
        if 'portfolio_photo' in request.FILES:
            user.portfolio_photo = request.FILES['portfolio_photo']
        
        user.save()
        
        portfolio_photo_url = None
        if user.portfolio_photo and user.portfolio_photo.url:
            try:
                portfolio_photo_url = self._get_full_image_url(request, user.portfolio_photo)
                # Убеждаемся, что это полный URL и используем https
                if not portfolio_photo_url.startswith('http'):
                    scheme = 'https'  # Всегда используем https
                    host = request.get_host() if hasattr(request, 'get_host') else ''
                    if host:
                        portfolio_photo_url = f'{scheme}://{host}{user.portfolio_photo.url}'
                # Заменяем http на https, если есть
                elif portfolio_photo_url.startswith('http://'):
                    portfolio_photo_url = portfolio_photo_url.replace('http://', 'https://')
            except Exception:
                # Fallback на относительный путь, если не удалось построить абсолютный
                portfolio_photo_url = user.portfolio_photo.url
        
        return Response({
            'id': user.id,
            'username': user.username,
            'full_name': user.name,
            'email': user.email,
            'phone_number': user.phone_number,
            'organization_name': user.organization_name,
            'portfolio': {
                'age': user.age,
                'gender': user.gender,
                'bio': user.bio,
                'work_experience_years': user.work_experience_years,
                'work_history': user.work_history,
                'portfolio_photo_url': portfolio_photo_url,
            },
        }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerPortfolioAPIView(APIView):
    """
    API для получения портфолио организатора по ID (для волонтеров)
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def _get_full_image_url(self, request, image_field):
        """Вспомогательный метод для получения полного URL изображения"""
        if not image_field or not image_field.url:
            return None
        try:
            url = request.build_absolute_uri(image_field.url)
            # Заменяем http на https, если есть
            if url.startswith('http://'):
                url = url.replace('http://', 'https://')
            return url
        except Exception:
            return image_field.url if image_field.url else None

    def get(self, request, organizer_id: int, *args, **kwargs):
        """Получить портфолио организатора"""
        try:
            organizer = User.objects.get(
                id=organizer_id,
                is_organizer=True,
                is_active=True,
            )
        except User.DoesNotExist:
            return Response({'detail': 'Организатор не найден.'}, status=status.HTTP_404_NOT_FOUND)
        
        portfolio_photo_url = None
        if organizer.portfolio_photo and organizer.portfolio_photo.url:
            try:
                portfolio_photo_url = self._get_full_image_url(request, organizer.portfolio_photo)
            except Exception:
                # Fallback на относительный путь, если не удалось построить абсолютный
                portfolio_photo_url = organizer.portfolio_photo.url
        
        return Response({
            'id': organizer.id,
            'username': organizer.username,
            'full_name': organizer.name,
            'organization_name': organizer.organization_name,
            'portfolio': {
                'age': organizer.age,
                'gender': organizer.gender,
                'gender_display': organizer.get_gender_display() if organizer.gender else None,
                'bio': organizer.bio,
                'work_experience_years': organizer.work_experience_years,
                'work_history': organizer.work_history,
                'portfolio_photo_url': portfolio_photo_url,
            },
        }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerProjectDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def _get_full_image_url(self, request, image_field):
        """Вспомогательный метод для получения полного URL изображения"""
        if not image_field or not image_field.url:
            return None
        try:
            url = request.build_absolute_uri(image_field.url)
            # Убеждаемся, что это полный URL и используем https
            if not url.startswith('http'):
                scheme = 'https'  # Всегда используем https
                host = request.get_host() if hasattr(request, 'get_host') else ''
                if host:
                    url = f'{scheme}://{host}{image_field.url}'
            # Заменяем http на https, если есть
            elif url.startswith('http://'):
                url = url.replace('http://', 'https://')
            return url
        except Exception:
            # Fallback на относительный путь, если не удалось построить абсолютный
            return image_field.url if image_field.url else None

    def get(self, request, project_id: int, *args, **kwargs):
        """Получить детальную информацию о проекте"""
        try:
            from api.projects.models import VolunteerProject
            from django.db.models import Count, Q
            from datetime import date
            
            project = Project.objects.select_related('creator').prefetch_related('tags').get(
                id=project_id,
                is_deleted=False,
                status='approved',
            )
            
            # Для волонтеров: проверяем, что проект не закончился
            # Организаторы видят все свои проекты (включая архивные)
            is_organizer = hasattr(request.user, 'is_organizer') and request.user.is_organizer
            is_project_creator = project.creator == request.user
            
            if not is_organizer and not is_project_creator:
                # Для волонтеров: если проект закончился, возвращаем 404
                if project.end_date and project.end_date < date.today():
                    return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)
            
            # Проверяем, присоединен ли волонтер к проекту
            birqadam_project = VolunteerProject.objects.filter(
                volunteer=request.user,
                project=project,
                is_active=True,
            ).first()
            
            # Получаем статистику (используем distinct для правильного подсчета)
            tasks_count = Task.objects.select_related('project', 'project__creator').filter(project=project, is_deleted=False).distinct().count()
            active_members = VolunteerProject.objects.select_related('project', 'volunteer').filter(project=project, is_active=True).distinct().count()
            
            # Получаем список участников проекта (все активные участники)
            active_volunteers = VolunteerProject.objects.filter(
                project=project,
                is_active=True
            ).select_related('volunteer').order_by('-joined_at')
            
            participants_list = []
            for vp in active_volunteers:
                volunteer = vp.volunteer
                avatar_url = None
                if hasattr(volunteer, 'avatar') and volunteer.avatar:
                    avatar_url = self._get_full_image_url(request, volunteer.avatar)
                participants_list.append({
                    'id': volunteer.id,
                    'name': volunteer.name or volunteer.username,
                    'avatar_url': avatar_url,
                    'joined_at': vp.joined_at.isoformat() if vp.joined_at else None,
                })
            
            # Получаем информацию об организаторе
            creator = project.creator
            organizer_info = {
                'id': creator.id,
                'name': creator.name or creator.username,
                'organization_name': creator.organization_name,
                'has_portfolio': bool(creator.age or creator.bio or creator.work_experience_years or creator.work_history or creator.portfolio_photo),
            }
            
            return Response(
                {
                    'id': project.id,
                    'project_id': project.id,
                    'title': project.title,
                    'description': project.description,
                    'city': project.city,
                    'volunteer_type': project.volunteer_type,
                    'start_date': project.start_date.isoformat() if project.start_date else None,
                    'end_date': project.end_date.isoformat() if project.end_date else None,
                    'status': project.status,
                    'joined': bool(birqadam_project),
                    'joined_at': birqadam_project.joined_at.isoformat() if birqadam_project and birqadam_project.joined_at else None,
                    'active_members': active_members,
                    'participants': participants_list,
                    'tasks_count': tasks_count,
                    'organizer_name': project.creator.name or project.creator.username,
                    'organizer_id': creator.id,
                    'organizer': organizer_info,
                    'address': project.address,
                    'latitude': float(project.latitude) if project.latitude else None,
                    'longitude': float(project.longitude) if project.longitude else None,
                    'contact_person': project.contact_person,
                    'contact_phone': project.contact_phone,
                    'contact_email': project.contact_email,
                    'contact_telegram': project.contact_telegram,
                    'info_url': project.info_url,
                    'gis2_url': project.gis2_url,
                    'tags': list(project.tags.names()),
                    'cover_image_url': self._get_full_image_url(request, project.cover_image) if project.cover_image else None,
                    'created_at': project.created_at.isoformat() if project.created_at else None,
                },
                status=status.HTTP_200_OK,
            )
        except Project.DoesNotExist:
            return Response({'detail': 'Проект не найден.'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            logger.error(f"Error getting project detail: {e}", exc_info=True)
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerProjectsAPIView(APIView):
    """
    API для получения и управления проектами организатора
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)
    parser_classes = (MultiPartParser, FormParser)

    def _get_full_image_url(self, request, image_field):
        """Вспомогательный метод для получения полного URL изображения"""
        if not image_field or not image_field.url:
            return None
        try:
            url = request.build_absolute_uri(image_field.url)
            if not url.startswith('http'):
                scheme = 'https'
                host = request.get_host() if hasattr(request, 'get_host') else ''
                if host:
                    url = f'{scheme}://{host}{image_field.url}'
            elif url.startswith('http://'):
                url = url.replace('http://', 'https://')
            return url
        except Exception:
            return image_field.url if image_field.url else None

    def get(self, request, *args, **kwargs):
        """Получить список проектов организатора"""
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        from django.db.models import Count, Q
        
        projects_qs = (
            Project.objects.select_related('creator').filter(creator=request.user, is_deleted=False)
            .annotate(
                volunteer_count=Count(
                    'volunteer_projects',
                    filter=Q(volunteer_projects__is_active=True),
                    distinct=True
                ),
                task_count=Count('tasks', filter=Q(tasks__is_deleted=False), distinct=True),
            )
            .prefetch_related('tags')
            .order_by('-created_at')
        )

        projects = []
        for project in projects_qs:
            projects.append({
                'id': project.id,
                'title': project.title,
                'description': project.description,
                'city': project.city,
                'status': project.status,
                'volunteer_type': project.volunteer_type,
                'start_date': project.start_date.isoformat() if project.start_date else None,
                'end_date': project.end_date.isoformat() if project.end_date else None,
                'created_at': project.created_at.isoformat() if project.created_at else None,
                'volunteer_count': project.volunteer_count,
                'task_count': project.task_count,
                'address': project.address,
                'latitude': float(project.latitude) if project.latitude else None,
                'longitude': float(project.longitude) if project.longitude else None,
                'contact_person': project.contact_person,
                'contact_phone': project.contact_phone,
                'contact_email': project.contact_email,
                'contact_telegram': project.contact_telegram,
                'info_url': project.info_url,
                'gis2_url': project.gis2_url,
                'tags': list(project.tags.names()),
                'cover_image_url': self._get_full_image_url(request, project.cover_image) if project.cover_image else None,
            })

        return Response(projects, status=status.HTTP_200_OK)

    def _parse_tags(self, raw_tags):
        """Парсит теги из различных форматов"""
        import json
        if not raw_tags:
            return []
        if isinstance(raw_tags, list):
            return [str(tag).strip() for tag in raw_tags if str(tag).strip()]
        if isinstance(raw_tags, str):
            raw_tags = raw_tags.strip()
            if not raw_tags:
                return []
            try:
                parsed = json.loads(raw_tags)
                if isinstance(parsed, list):
                    return [str(tag).strip() for tag in parsed if str(tag).strip()]
            except json.JSONDecodeError:
                pass
            return [tag.strip() for tag in raw_tags.split(',') if tag.strip()]
        return []

    def _parse_date(self, value):
        """Парсит дату из различных форматов"""
        from datetime import datetime
        if not value:
            return None
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, (list, tuple)):
            value = value[0]
        if isinstance(value, str):
            value = value.strip()
            if not value:
                return None
            # Поддерживаем форматы: YYYY-MM-DD, YYYY-MM-DDTHH:mm, YYYY-MM-DDTHH:mm:ss, DD.MM.YYYY
            if 'T' in value:
                value = value.split('T')[0]
            for fmt in ('%Y-%m-%d', '%d.%m.%Y'):
                try:
                    return datetime.strptime(value, fmt).date()
                except ValueError:
                    continue
        return None

    def _parse_float(self, value):
        """Парсит float значение"""
        if value in (None, '', 'null'):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def post(self, request, *args, **kwargs):
        """Создать новый проект"""
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data
        
        logger.info(f"[OrganizerProjectsAPIView] POST request data keys: {list(data.keys())}")
        logger.info(f"[OrganizerProjectsAPIView] gis2_url value: {data.get('gis2_url')}")
        logger.info(f"[OrganizerProjectsAPIView] end_date value: {data.get('end_date')}")

        from datetime import datetime

        title = data.get('title')
        description = data.get('description')
        city = data.get('city')
        volunteer_type = data.get('volunteer_type', 'any')

        if not all([title, description, city]):
            logger.warning(f"[OrganizerProjectsAPIView] Missing required fields: title={bool(title)}, description={bool(description)}, city={bool(city)}")
            return Response({'error': 'Missing required fields'}, status=status.HTTP_400_BAD_REQUEST)

        # Дата начала автоматически устанавливается на сегодня, если не указана
        start_date = self._parse_date(data.get('start_date')) or datetime.now().date()
        
        # Дата окончания обязательна
        end_date = self._parse_date(data.get('end_date'))
        if not end_date:
            logger.warning(f"[OrganizerProjectsAPIView] End date validation failed. Received: {data.get('end_date')}")
            return Response({'error': 'Дата завершения проекта обязательна'}, status=status.HTTP_400_BAD_REQUEST)

        # Ссылка на 2ГИС обязательна
        gis2_url = data.get('gis2_url', '').strip()
        if not gis2_url:
            logger.warning(f"[OrganizerProjectsAPIView] gis2_url is empty or missing. Received: {repr(data.get('gis2_url'))}")
            return Response({'error': 'Ссылка на 2ГИС обязательна'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Валидация формата ссылки 2ГИС
        import re
        gis2_pattern = re.compile(r'^https?://(go\.)?2gis\.(com|kz|ru)(/.+)?$', re.IGNORECASE)
        if not gis2_pattern.match(gis2_url):
            logger.warning(f"[OrganizerProjectsAPIView] gis2_url format validation failed. Received: {gis2_url}")
            return Response({'error': 'Введите корректную ссылку на 2ГИС (например: https://go.2gis.com/vOZEO или https://2gis.kz/...)'}, status=status.HTTP_400_BAD_REQUEST)

        latitude = self._parse_float(data.get('latitude'))
        longitude = self._parse_float(data.get('longitude'))
        tags = self._parse_tags(data.get('tags'))

        project = Project.objects.create(
            title=title,
            description=description,
            city=city,
            start_date=start_date,
            end_date=end_date,
            volunteer_type=volunteer_type,
            creator=request.user,
            status='pending',
            latitude=latitude,
            longitude=longitude,
            address=data.get('address', ''),
            contact_person=data.get('contact_person', ''),
            contact_phone=data.get('contact_phone', ''),
            contact_email=data.get('contact_email'),
            contact_telegram=data.get('contact_telegram', ''),
            info_url=data.get('info_url'),
            gis2_url=gis2_url,
        )

        cover_image = request.FILES.get('cover_image')
        if cover_image:
            project.cover_image = cover_image
            project.save(update_fields=['cover_image'])

        if tags:
            project.tags.set(tags)

        return Response({
            'id': project.id,
            'title': project.title,
            'description': project.description,
            'city': project.city,
            'status': project.status,
            'volunteer_count': 0,
            'task_count': 0,
            'created_at': project.created_at.isoformat() if project.created_at else None,
            'volunteer_type': project.volunteer_type,
            'start_date': project.start_date.isoformat() if project.start_date else None,
            'end_date': project.end_date.isoformat() if project.end_date else None,
            'address': project.address,
            'latitude': float(project.latitude) if project.latitude else None,
            'longitude': float(project.longitude) if project.longitude else None,
            'contact_person': project.contact_person,
            'contact_phone': project.contact_phone,
            'contact_email': project.contact_email,
            'contact_telegram': project.contact_telegram,
            'info_url': project.info_url,
            'gis2_url': project.gis2_url,
            'tags': tags,
            'cover_image_url': self._get_full_image_url(request, project.cover_image) if project.cover_image else None,
        }, status=status.HTTP_201_CREATED)

    def patch(self, request, project_id: int = None, *args, **kwargs):
        """Редактирование проекта"""
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        # Получаем project_id из kwargs (из URL)
        if project_id is None:
            project_id = kwargs.get('project_id')
        if project_id is None:
            return Response({'error': 'Project ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            project = Project.objects.get(id=project_id, creator=request.user, is_deleted=False)
        except Project.DoesNotExist:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

        # Проверяем наличие участников в проекте
        from api.projects.models import VolunteerProject
        participants_count = VolunteerProject.objects.filter(
            project=project,
            is_active=True
        ).count()
        
        if participants_count > 0:
            return Response({
                'error': 'Редактирование проекта запрещено, так как в проекте уже есть участники. Удалите всех участников перед редактированием.'
            }, status=status.HTTP_400_BAD_REQUEST)

        data = request.data

        # Обновляем поля
        if 'title' in data:
            project.title = data.get('title')
        if 'description' in data:
            project.description = data.get('description')
        if 'city' in data:
            project.city = data.get('city')
        if 'volunteer_type' in data:
            project.volunteer_type = data.get('volunteer_type', 'any')
        if 'start_date' in data:
            parsed_start_date = self._parse_date(data.get('start_date'))
            if parsed_start_date is not None:
                project.start_date = parsed_start_date
        if 'end_date' in data:
            parsed_end_date = self._parse_date(data.get('end_date'))
            if parsed_end_date is not None:
                project.end_date = parsed_end_date
        if 'latitude' in data:
            project.latitude = self._parse_float(data.get('latitude'))
        if 'longitude' in data:
            project.longitude = self._parse_float(data.get('longitude'))
        if 'address' in data:
            project.address = data.get('address', '')
        if 'contact_person' in data:
            project.contact_person = data.get('contact_person', '')
        if 'contact_phone' in data:
            project.contact_phone = data.get('contact_phone', '')
        if 'contact_email' in data:
            project.contact_email = data.get('contact_email')
        if 'contact_telegram' in data:
            project.contact_telegram = data.get('contact_telegram', '')
        if 'info_url' in data:
            project.info_url = data.get('info_url')
        if 'gis2_url' in data:
            gis2_url_value = data.get('gis2_url', '').strip()
            if not gis2_url_value:
                return Response({'error': 'Ссылка на 2ГИС обязательна'}, status=status.HTTP_400_BAD_REQUEST)
            import re
            gis2_pattern = re.compile(r'^https?://(go\.)?2gis\.(com|kz|ru)(/.+)?$', re.IGNORECASE)
            if not gis2_pattern.match(gis2_url_value):
                return Response({'error': 'Введите корректную ссылку на 2ГИС (например: https://go.2gis.com/vOZEO или https://2gis.kz/...)'}, status=status.HTTP_400_BAD_REQUEST)
            project.gis2_url = gis2_url_value

        # Обновляем обложку
        cover_image = request.FILES.get('cover_image')
        if cover_image:
            project.cover_image = cover_image

        # Обновляем теги
        if 'tags' in data:
            tags = self._parse_tags(data.get('tags'))
            project.tags.set(tags)

        # При редактировании проекта отправляем его на модерацию заново
        project.status = 'pending'
        project.save()

        from django.db.models import Count, Q
        project.refresh_from_db()
        
        return Response({
            'id': project.id,
            'title': project.title,
            'description': project.description,
            'city': project.city,
            'status': project.status,
            'volunteer_count': VolunteerProject.objects.select_related('project', 'volunteer').filter(project=project, is_active=True).count(),
            'task_count': project.tasks.filter(is_deleted=False).count(),
            'start_date': project.start_date.isoformat() if project.start_date else None,
            'end_date': project.end_date.isoformat() if project.end_date else None,
            'created_at': project.created_at.isoformat() if project.created_at else None,
            'volunteer_type': project.volunteer_type,
            'address': project.address,
            'latitude': float(project.latitude) if project.latitude else None,
            'longitude': float(project.longitude) if project.longitude else None,
            'contact_person': project.contact_person,
            'contact_phone': project.contact_phone,
            'contact_email': project.contact_email,
            'contact_telegram': project.contact_telegram,
            'info_url': project.info_url,
            'gis2_url': project.gis2_url,
            'tags': list(project.tags.names()),
            'cover_image_url': self._get_full_image_url(request, project.cover_image) if project.cover_image else None,
        }, status=status.HTTP_200_OK)

    def delete(self, request, project_id: int = None, *args, **kwargs):
        """Удаление проекта"""
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        # Получаем project_id из kwargs (из URL)
        if project_id is None:
            project_id = kwargs.get('project_id')
        if project_id is None:
            return Response({'error': 'Project ID is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            project = Project.objects.get(id=project_id, creator=request.user, is_deleted=False)
        except Project.DoesNotExist:
            return Response({'error': 'Project not found'}, status=status.HTTP_404_NOT_FOUND)

        # Мягкое удаление проекта
        project.delete()

        return Response({'message': 'Проект успешно удалён'}, status=status.HTTP_200_OK)


class AIAssistantAPIView(APIView):
    """
    API для вопросов к AI ассистенту BirQadam
    """
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        """
        Задать вопрос AI ассистенту
        """
        question = request.data.get('question')
        
        if not question:
            return Response(
                {'detail': 'Поле "question" обязательно.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if len(question.strip()) == 0:
            return Response(
                {'detail': 'Вопрос не может быть пустым.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            from shared.ai.agent_service import AIAgentService
            
            service = AIAgentService()
            # Передаем пользователя для доступа к инструментам, max_turns=3 для работы с инструментами
            answer = service.ask_question(question, max_turns=3, user=request.user)
            
            return Response({
                'question': question,
                'answer': answer
            }, status=status.HTTP_200_OK)
        except ValueError as e:
            logger.error(f"AI Agent configuration error: {e}")
            return Response(
                {'detail': 'AI ассистент временно недоступен. Обратитесь к администратору.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        except Exception as e:
            logger.error(f"Error asking AI assistant: {e}", exc_info=True)
            return Response(
                {'detail': f'Ошибка при обработке запроса: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

class VolunteerTasksAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        user = request.user
        today = timezone.localdate()
        archive_finished_project_tasks(today=today)
        active_project_ids = get_active_volunteer_project_ids(user, today=today)

        # Показываем и доступные задачи из активных проектов, и уже связанные с
        # волонтёром задачи, чтобы "Ближайшая задача" и раздел "Мои задачи"
        # использовали совместимую выборку.
        # Важно: фильтр с OR по assignments даёт JOIN и при нескольких назначениях
        # на одну задачу строки Task дублируются. Сначала получаем уникальные id,
        # затем загружаем задачи с нужным order_by.
        task_scope = Task.objects.filter(
            Q(project_id__in=active_project_ids) | Q(assignments__volunteer=user),
            is_deleted=False,
        ).exclude(
            Q(project_id__in=active_project_ids)
            & Q(status__in=['completed', 'archived', 'failed', 'closed'])
            & ~Q(assignments__volunteer=user)
        )
        visible_ids = task_scope.order_by().values_list('id', flat=True).distinct()
        tasks = (
            Task.objects.select_related('project', 'project__creator')
            .filter(id__in=visible_ids)
            .order_by('deadline_date', '-created_at')
        )

        serializer = VolunteerTaskSummarySerializer(tasks, many=True, context={'request': request})
        return Response({'tasks': serializer.data})

class VolunteerTaskDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request, task_id):
        task = get_object_or_404(Task, id=task_id, is_deleted=False)
        serializer = VolunteerTaskSummarySerializer(task, context={'request': request})
        return Response(serializer.data)

@method_decorator(csrf_exempt, name='dispatch')
class VolunteerTaskAcceptAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)
    def post(self, request, task_id):
        task = get_object_or_404(Task, id=task_id, is_deleted=False)
        assignment, created = TaskAssignment.objects.get_or_create(task=task, volunteer=request.user)
        assignment.accepted = True
        assignment.accepted_at = timezone.now()
        assignment.save()
        
        # Обновляем статус задачи
        if task.status == 'open':
            task.status = 'in_progress'
            task.save(update_fields=['status'])
            
        return Response({'message': 'Задача успешно принята'})

@method_decorator(csrf_exempt, name='dispatch')
class VolunteerTaskDeclineAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)
    def post(self, request, task_id):
        task = get_object_or_404(Task, id=task_id, is_deleted=False)
        assignment, created = TaskAssignment.objects.get_or_create(task=task, volunteer=request.user)
        assignment.accepted = False
        assignment.save()
        return Response({'message': 'Задача отклонена и перенесена в архив'})

@method_decorator(csrf_exempt, name='dispatch')
class VolunteerTaskArchiveAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)
    def post(self, request, task_id):
        task = get_object_or_404(Task, id=task_id, is_deleted=False)
        if task.status in ['completed', 'failed', 'closed']:
            task.status = 'archived'
            task.save(update_fields=['status'])
            return Response({'message': 'Задача перенесена в архив'})
        return Response({'error': 'Можно архивировать только завершенные или закрытые задачи'}, status=400)


@method_decorator(csrf_exempt, name='dispatch')
class VolunteerCalendarAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def _get_full_image_url(self, request, image_field):
        if not image_field:
            return None

        try:
            image_url = image_field.url
        except Exception:
            return None

        if not image_url:
            return None

        try:
            return request.build_absolute_uri(image_url)
        except Exception:
            return image_url

    def _serialize_participant(self, request, volunteer):
        return {
            'id': volunteer.id,
            'name': volunteer.name or volunteer.username,
            'avatar': self._get_full_image_url(request, getattr(volunteer, 'avatar', None)),
        }

    def _parse_month_bounds(self, month_value):
        if not month_value:
            month_start = timezone.localdate().replace(day=1)
        else:
            month_start = datetime.strptime(month_value, '%Y-%m').date().replace(day=1)

        next_month = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1)
        month_end = next_month - timedelta(days=1)
        return month_start, month_end

    def get(self, request, *args, **kwargs):
        try:
            month_start, month_end = self._parse_month_bounds(request.query_params.get('month'))
        except ValueError:
            return Response(
                {'detail': 'Параметр month должен быть в формате YYYY-MM.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        month_key = month_start.strftime('%Y-%m')

        joined_project_ids = get_active_volunteer_project_ids(
            request.user,
            today=timezone.localdate(),
        )

        if not joined_project_ids:
            return Response({'month': month_key, 'events': []}, status=status.HTTP_200_OK)

        projects = list(
            Project.objects.select_related('creator').filter(id__in=joined_project_ids,
                is_deleted=False,
                status='approved',
            )
            .select_related('creator')
            .prefetch_related('volunteer_projects__volunteer')
        )

        tasks = list(
            Task.objects.select_related('project', 'project__creator').filter(project_id__in=joined_project_ids,
                is_deleted=False,
                status='open',
            )
            .filter(
                Q(deadline_date__range=(month_start, month_end))
                | Q(deadline_date__isnull=True, start_date__range=(month_start, month_end))
            )
            .select_related('project', 'project__creator', 'creator')
            .prefetch_related('assignments__volunteer')
        )

        events = []

        for project in projects:
            active_memberships = [
                membership
                for membership in project.volunteer_projects.all()
                if membership.is_active
            ]
            participants_preview = [
                self._serialize_participant(request, membership.volunteer)
                for membership in active_memberships[:4]
            ]
            participants_count = len(active_memberships)
            project_location = project.address or project.city
            project_image = self._get_full_image_url(request, getattr(project, 'cover_image', None))
            organizer_name = project.creator.name or project.creator.username

            if project.start_date and month_start <= project.start_date <= month_end:
                events.append({
                    'id': f'project-{project.id}-start-{project.start_date.isoformat()}',
                    'source_type': 'project',
                    'source_id': project.id,
                    'type': 'project_start',
                    'title': project.title,
                    'subtitle': project.city or project.get_volunteer_type_display(),
                    'description': project.description,
                    'date': project.start_date.isoformat(),
                    'end_date': project.end_date.isoformat() if project.end_date else None,
                    'start_time': None,
                    'end_time': None,
                    'is_all_day': True,
                    'location': project_location,
                    'status': None,
                    'image': project_image,
                    'project_id': project.id,
                    'project_title': project.title,
                    'project_type': project.volunteer_type,
                    'project_city': project.city,
                    'project_address': project.address,
                    'project_latitude': project.latitude,
                    'project_longitude': project.longitude,
                    'project_gis2_url': project.gis2_url,
                    'task_id': None,
                    'organizer_name': organizer_name,
                    'participants_count': participants_count,
                    'participants_preview': participants_preview,
                })

            if project.end_date and month_start <= project.end_date <= month_end:
                events.append({
                    'id': f'project-{project.id}-end-{project.end_date.isoformat()}',
                    'source_type': 'project',
                    'source_id': project.id,
                    'type': 'project_end',
                    'title': project.title,
                    'subtitle': project.city or project.get_volunteer_type_display(),
                    'description': project.description,
                    'date': project.end_date.isoformat(),
                    'end_date': project.end_date.isoformat(),
                    'start_time': None,
                    'end_time': None,
                    'is_all_day': True,
                    'location': project_location,
                    'status': None,
                    'image': project_image,
                    'project_id': project.id,
                    'project_title': project.title,
                    'project_type': project.volunteer_type,
                    'project_city': project.city,
                    'project_address': project.address,
                    'project_latitude': project.latitude,
                    'project_longitude': project.longitude,
                    'project_gis2_url': project.gis2_url,
                    'task_id': None,
                    'organizer_name': organizer_name,
                    'participants_count': participants_count,
                    'participants_preview': participants_preview,
                })

        for task in tasks:
            task_date = task.deadline_date or task.start_date
            if not task_date:
                continue

            accepted_assignments = [
                assignment
                for assignment in task.assignments.all()
                if assignment.accepted
            ]
            task_participants_preview = [
                self._serialize_participant(request, assignment.volunteer)
                for assignment in accepted_assignments[:4]
            ]
            task_image = (
                self._get_full_image_url(request, getattr(task, 'task_image', None))
                or self._get_full_image_url(request, getattr(task.project, 'cover_image', None))
            )

            events.append({
                'id': f'task-{task.id}-{task_date.isoformat()}',
                'source_type': 'task',
                'source_id': task.id,
                'type': 'task_deadline',
                'title': task.text,
                'subtitle': task.project.city or task.project.title,
                'description': task.text,
                'date': task_date.isoformat(),
                'end_date': task.deadline_date.isoformat() if task.deadline_date else None,
                'start_time': task.start_time.isoformat() if task.start_time else None,
                'end_time': task.end_time.isoformat() if task.end_time else None,
                'is_all_day': not bool(task.start_time or task.end_time),
                'location': task.project.address or task.project.city,
                'status': task.status,
                'image': task_image,
                'project_id': task.project_id,
                'project_title': task.project.title,
                'project_type': task.project.volunteer_type,
                'project_city': task.project.city,
                'project_address': task.project.address,
                'project_latitude': task.project.latitude,
                'project_longitude': task.project.longitude,
                'project_gis2_url': task.project.gis2_url,
                'task_id': task.id,
                'organizer_name': task.project.creator.name or task.project.creator.username,
                'participants_count': len(accepted_assignments),
                'participants_preview': task_participants_preview,
            })

        events.sort(key=lambda item: (item['date'], item['start_time'] or '00:00', item['title']))

        return Response({'month': month_key, 'events': events}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerDashboardAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        projects_qs = Project.objects.filter(creator=request.user, is_deleted=False)
        tasks_qs = Task.objects.filter(project__creator=request.user, project__is_deleted=False, is_deleted=False)
        photos_qs = Photo.objects.select_related('task', 'volunteer').filter(project__creator=request.user, project__is_deleted=False, is_deleted=False)
        volunteers_count = User.objects.filter(
            is_organizer=False,
            volunteer_projects__project__creator=request.user,
            volunteer_projects__project__is_deleted=False,
            volunteer_projects__is_active=True,
        ).distinct().count()

        summary = {
            'total_projects': projects_qs.count(),
            'approved_projects': projects_qs.filter(status='approved').count(),
            'pending_projects': projects_qs.filter(status='pending').count(),
            'total_tasks': tasks_qs.count(),
            'open_tasks': tasks_qs.filter(status='open').count(),
            'in_progress_tasks': tasks_qs.filter(status='in_progress').count(),
            'revision_tasks': tasks_qs.filter(status='revision').count(),
            'completed_tasks': tasks_qs.filter(status='completed').count(),
            'total_volunteers': volunteers_count,
            'pending_photos': photos_qs.filter(status='pending').count(),
            'approved_photos': photos_qs.filter(status='approved').count(),
            'rejected_photos': photos_qs.filter(status='rejected').count(),
        }

        recent_projects = [
            {
                'id': project.id,
                'title': project.title,
                'status': project.status,
                'status_display': project.get_status_display(),
                'city': project.city,
                'created_at': project.created_at.isoformat() if project.created_at else None,
            }
            for project in projects_qs.order_by('-created_at')[:5]
        ]

        recent_tasks_qs = tasks_qs.select_related('project').annotate(
            accepted_count=Count('assignments', filter=Q(assignments__accepted=True), distinct=True),
            completed_count=Count('assignments', filter=Q(assignments__completed=True), distinct=True),
            photo_reports_count=Count('task_photos', filter=Q(task_photos__is_deleted=False), distinct=True),).order_by('-created_at')[:5]

        return Response({
            'summary': summary,
            'recent_projects': recent_projects,
            'recent_tasks': [_serialize_task_for_organizer(request, task) for task in recent_tasks_qs],
        }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerVolunteersAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        volunteers_qs = User.objects.filter(
            is_organizer=False,
            volunteer_projects__project__creator=request.user,
            volunteer_projects__project__is_deleted=False,
            volunteer_projects__is_active=True,
        ).distinct().annotate(
            project_count=Count(
                'volunteer_projects__project',
                filter=Q(
                    volunteer_projects__project__creator=request.user,
                    volunteer_projects__project__is_deleted=False,
                    volunteer_projects__is_active=True,
                ),
                distinct=True,
            ),
            accepted_tasks=Count(
                'assignments',
                filter=Q(
                    assignments__task__project__creator=request.user,
                    assignments__task__project__is_deleted=False,
                    assignments__task__is_deleted=False,
                    assignments__accepted=True,
                ),
                distinct=True,
            ),
            completed_assignments=Count(
                'assignments',
                filter=Q(
                    assignments__task__project__creator=request.user,
                    assignments__task__project__is_deleted=False,
                    assignments__task__is_deleted=False,
                    assignments__completed=True,
                ),
                distinct=True,
            ),
            approved_photos=Count(
                'photos',
                filter=Q(
                    photos__project__creator=request.user,
                    photos__project__is_deleted=False,
                    photos__is_deleted=False,
                    photos__status='approved',
                ),
                distinct=True,
            ),
        ).order_by('name', 'username')

        volunteers = []
        for volunteer in volunteers_qs:
            volunteers.append({
                'id': volunteer.id,
                'name': volunteer.name or volunteer.username,
                'username': volunteer.username,
                'email': volunteer.email,
                'phone_number': volunteer.phone_number,
                'avatar_url': _get_full_image_url(request, getattr(volunteer, 'avatar', None)),
                'project_count': volunteer.project_count,
                'accepted_tasks': volunteer.accepted_tasks,
                'completed_tasks': volunteer.completed_assignments,
                'approved_photos': volunteer.approved_photos,
                'rating': volunteer.rating,
                'average_rating': volunteer.average_rating,
                'trust_factor': volunteer.trust_factor,
            })

        return Response({'volunteers': volunteers, 'count': len(volunteers)}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerVolunteerDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, volunteer_id, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        volunteer = get_object_or_404(User, id=volunteer_id, is_organizer=False)
        participates = VolunteerProject.objects.select_related('creator').filter(volunteer=volunteer,
            project__creator=request.user,
            project__is_deleted=False,
            is_active=True,
        ).exists()
        if not participates:
            return Response({'error': 'Volunteer not found'}, status=status.HTTP_404_NOT_FOUND)

        organizer_projects = Project.objects.filter(
            creator=request.user,
            is_deleted=False,
            volunteer_projects__volunteer=volunteer,
            volunteer_projects__is_active=True,
        ).distinct().order_by('-created_at')

        assignments_qs = TaskAssignment.objects.filter(
            volunteer=volunteer,
            task__project__creator=request.user,
            task__project__is_deleted=False,
            task__is_deleted=False,
        ).select_related('task', 'task__project').order_by('-task__created_at')

        photos_qs = Photo.objects.filter(
            volunteer=volunteer,
            project__creator=request.user,
            project__is_deleted=False,
            is_deleted=False,
        ).select_related('project', 'task').order_by('-uploaded_at')

        completed_task_ids = set(assignments_qs.filter(completed=True).values_list('task_id', flat=True))
        approved_photo_task_ids = set(photos_qs.filter(status='approved', task__isnull=False).values_list('task_id', flat=True))

        recent_tasks = []
        recent_tasks_qs = assignments_qs.annotate(
            accepted_count=Count('task__assignments', filter=Q(task__assignments__accepted=True), distinct=True),
            completed_count=Count('task__assignments', filter=Q(task__assignments__completed=True), distinct=True),
            photo_reports_count=Count('task__task_photos', filter=Q(task__task_photos__is_deleted=False), distinct=True),
        )[:10]
        for assignment in recent_tasks_qs:
            task = assignment.task
            task.accepted_count = getattr(assignment, 'accepted_count', 0)
            task.completed_count = getattr(assignment, 'completed_count', 0)
            task.photo_reports_count = getattr(assignment, 'photo_reports_count', 0)
            task_data = _serialize_task_for_organizer(request, task)
            task_data['assignment'] = {
                'accepted': assignment.accepted,
                'accepted_at': assignment.accepted_at.isoformat() if assignment.accepted_at else None,
                'completed': assignment.completed,
                'completed_at': assignment.completed_at.isoformat() if assignment.completed_at else None,
                'rating': assignment.rating,
                'feedback': assignment.feedback,
            }
            recent_tasks.append(task_data)

        recent_photos = [
            {
                'id': photo.id,
                'status': photo.status,
                'rating': photo.rating,
                'uploaded_at': photo.uploaded_at.isoformat() if photo.uploaded_at else None,
                'moderated_at': photo.moderated_at.isoformat() if photo.moderated_at else None,
                'image_url': _get_full_image_url(request, photo.image),
                'project_title': photo.project.title if photo.project else None,
                'task_id': photo.task.id if photo.task else None,
                'task_text': photo.task.text if photo.task else None,
                'volunteer_comment': photo.volunteer_comment,
                'organizer_comment': photo.organizer_comment,
                'rejection_reason': photo.rejection_reason,
            }
            for photo in photos_qs[:12]
        ]

        return Response({
            'id': volunteer.id,
            'name': volunteer.name or volunteer.username,
            'username': volunteer.username,
            'email': volunteer.email,
            'phone_number': volunteer.phone_number,
            'avatar_url': _get_full_image_url(request, getattr(volunteer, 'avatar', None)),
            'rating': volunteer.rating,
            'average_rating': volunteer.average_rating,
            'trust_factor': volunteer.trust_factor,
            'summary': {
                'project_count': organizer_projects.count(),
                'accepted_tasks': assignments_qs.filter(accepted=True).count(),
                'completed_tasks': len(completed_task_ids | approved_photo_task_ids),
                'approved_photos': photos_qs.filter(status='approved').count(),
                'pending_photos': photos_qs.filter(status='pending').count(),
            },
            'projects': [
                {
                    'id': project.id,
                    'title': project.title,
                    'city': project.city,
                    'status': project.status,
                    'status_display': project.get_status_display(),
                }
                for project in organizer_projects[:10]
            ],
            'recent_tasks': recent_tasks,
            'recent_photos': recent_photos,
        }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerTasksAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        tasks_qs = Task.objects.select_related('project', 'project__creator').filter(project__creator=request.user,
            project__is_deleted=False,
            is_deleted=False,
        ).select_related('project').annotate(
            accepted_count=Count('assignments', filter=Q(assignments__accepted=True), distinct=True),
            completed_count=Count('assignments', filter=Q(assignments__completed=True), distinct=True),
            photo_reports_count=Count('task_photos', filter=Q(task_photos__is_deleted=False), distinct=True),).order_by('-created_at')

        project_id = request.query_params.get('project_id') or request.query_params.get('project')
        status_filter = request.query_params.get('status')
        query = request.query_params.get('q') or request.query_params.get('search')

        if project_id:
            tasks_qs = tasks_qs.filter(project_id=project_id)
        if status_filter:
            tasks_qs = tasks_qs.filter(status=status_filter)
        if query:
            tasks_qs = tasks_qs.filter(Q(text__icontains=query) | Q(project__title__icontains=query))

        tasks = [_serialize_task_for_organizer(request, task) for task in tasks_qs]
        return Response({'tasks': tasks, 'count': len(tasks)}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerProjectTasksAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def get(self, request, project_id, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        project = get_object_or_404(Project, id=project_id, creator=request.user, is_deleted=False)
        tasks_qs = Task.objects.select_related('project', 'project__creator').filter(project=project, is_deleted=False).select_related('project').annotate(
            accepted_count=Count('assignments', filter=Q(assignments__accepted=True), distinct=True),
            completed_count=Count('assignments', filter=Q(assignments__completed=True), distinct=True),
            photo_reports_count=Count('task_photos', filter=Q(task_photos__is_deleted=False), distinct=True),).order_by('-created_at')

        tasks = [_serialize_task_for_organizer(request, task) for task in tasks_qs]
        return Response({'project_id': project.id, 'tasks': tasks, 'count': len(tasks)}, status=status.HTTP_200_OK)

    def post(self, request, project_id, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        project = get_object_or_404(Project, id=project_id, creator=request.user, is_deleted=False)
        text = request.data.get('text')
        if not text:
            return Response({'error': 'Task text is required'}, status=status.HTTP_400_BAD_REQUEST)

        task = Task.objects.create(
            project=project,
            creator=request.user,
            text=text,
            start_date=_parse_optional_date(request.data.get('start_date')),
            deadline_date=_parse_optional_date(request.data.get('deadline_date')),
            start_time=_parse_optional_time(request.data.get('start_time')),
            end_time=_parse_optional_time(request.data.get('end_time')),
            task_image=request.FILES.get('task_image'),
            status='open',
        )
        task.accepted_count = 0
        task.completed_count = 0
        task.photo_reports_count = 0
        return Response(_serialize_task_for_organizer(request, task), status=status.HTTP_201_CREATED)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerTaskDetailAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def _get_task(self, request, task_id):
        return get_object_or_404(
            Task.objects.select_related('project').annotate(
                accepted_count=Count('assignments', filter=Q(assignments__accepted=True), distinct=True),
                completed_count=Count('assignments', filter=Q(assignments__completed=True), distinct=True),
                photo_reports_count=Count('task_photos', filter=Q(task_photos__is_deleted=False), distinct=True),
            ),
            id=task_id,
            project__creator=request.user,
            project__is_deleted=False,
            is_deleted=False,
        )

    def get(self, request, task_id, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
        task = self._get_task(request, task_id)
        return Response(_serialize_task_for_organizer(request, task), status=status.HTTP_200_OK)

    def patch(self, request, task_id, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        task = self._get_task(request, task_id)
        if task.accepted_count > 0 or task.status != 'open':
            return Response(
                {'error': 'Task can be edited only before volunteers accept it and while it is open'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if 'text' in request.data:
            task.text = request.data.get('text') or task.text
        if 'start_date' in request.data:
            task.start_date = _parse_optional_date(request.data.get('start_date'))
        if 'deadline_date' in request.data:
            task.deadline_date = _parse_optional_date(request.data.get('deadline_date'))
        if 'start_time' in request.data:
            task.start_time = _parse_optional_time(request.data.get('start_time'))
        if 'end_time' in request.data:
            task.end_time = _parse_optional_time(request.data.get('end_time'))
        if 'task_image' in request.FILES:
            task.task_image = request.FILES.get('task_image')

        task.save()
        return Response(_serialize_task_for_organizer(request, task), status=status.HTTP_200_OK)

    def delete(self, request, task_id, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        task = self._get_task(request, task_id)
        task.is_deleted = True
        task.deleted_at = timezone.now()
        task.save(update_fields=['is_deleted', 'deleted_at'])
        return Response({'message': 'Task deleted successfully'}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerPhotoModerationAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        base_qs = Photo.objects.filter(
            project__creator=request.user,
            project__is_deleted=False,
            is_deleted=False,
        ).select_related('volunteer', 'project', 'task')

        status_filter = request.query_params.get('status')
        project_id = request.query_params.get('project_id') or request.query_params.get('project')
        photos_qs = base_qs.order_by('-uploaded_at')
        if status_filter:
            photos_qs = photos_qs.filter(status=status_filter)
        if project_id:
            photos_qs = photos_qs.filter(project_id=project_id)

        counters = {
            'pending': base_qs.filter(status='pending').count(),
            'approved': base_qs.filter(status='approved').count(),
            'rejected': base_qs.filter(status='rejected').count(),
        }
        counters['total'] = counters['pending'] + counters['approved'] + counters['rejected']

        photos = []
        for photo in photos_qs:
            photos.append({
                'id': photo.id,
                'status': photo.status,
                'rating': photo.rating,
                'uploaded_at': photo.uploaded_at.isoformat() if photo.uploaded_at else None,
                'moderated_at': photo.moderated_at.isoformat() if photo.moderated_at else None,
                'image_url': _get_full_image_url(request, photo.image),
                'volunteer_comment': photo.volunteer_comment or '',
                'organizer_comment': photo.organizer_comment or '',
                'rejection_reason': photo.rejection_reason or '',
                'project': {
                    'id': photo.project.id if photo.project else None,
                    'title': photo.project.title if photo.project else None,
                    'city': photo.project.city if photo.project else None,
                },
                'task': {
                    'id': photo.task.id if photo.task else None,
                    'text': photo.task.text if photo.task else None,
                },
                'volunteer': {
                    'id': photo.volunteer.id if photo.volunteer else None,
                    'name': (photo.volunteer.name or photo.volunteer.username) if photo.volunteer else None,
                    'username': photo.volunteer.username if photo.volunteer else None,
                },
            })

        return Response({'photos': photos, 'count': len(photos), 'counters': counters}, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerPhotoApproveAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, photo_id, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        photo = get_object_or_404(
            Photo.objects.select_related('volunteer', 'project', 'task'),
            id=photo_id,
            project__creator=request.user,
            project__is_deleted=False,
            is_deleted=False,
        )
        if photo.status != 'pending':
            return Response({'error': 'Photo already moderated'}, status=status.HTTP_400_BAD_REQUEST)

        rating_value = request.data.get('rating')
        try:
            rating = int(rating_value) if rating_value not in (None, '', False) else None
        except (TypeError, ValueError):
            return Response({'error': 'Rating must be a number from 1 to 5'}, status=status.HTTP_400_BAD_REQUEST)
        if rating is not None and (rating < 1 or rating > 5):
            return Response({'error': 'Rating must be a number from 1 to 5'}, status=status.HTTP_400_BAD_REQUEST)

        photo.approve(rating=rating, feedback=request.data.get('feedback') or None)
        photo.refresh_from_db()
        return Response({
            'message': 'Photo approved successfully',
            'photo': {
                'id': photo.id,
                'status': photo.status,
                'rating': photo.rating,
                'moderated_at': photo.moderated_at.isoformat() if photo.moderated_at else None,
            },
        }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerPhotoRejectAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, photo_id, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        photo = get_object_or_404(
            Photo.objects.select_related('volunteer', 'project', 'task'),
            id=photo_id,
            project__creator=request.user,
            project__is_deleted=False,
            is_deleted=False,
        )
        if photo.status != 'pending':
            return Response({'error': 'Photo already moderated'}, status=status.HTTP_400_BAD_REQUEST)

        reason = (request.data.get('reason') or request.data.get('feedback') or '').strip()
        if not reason:
            return Response({'error': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        photo.reject(feedback=reason)
        photo.refresh_from_db()
        return Response({
            'message': 'Photo rejected successfully',
            'photo': {
                'id': photo.id,
                'status': photo.status,
                'rejection_reason': photo.rejection_reason,
                'moderated_at': photo.moderated_at.isoformat() if photo.moderated_at else None,
            },
        }, status=status.HTTP_200_OK)


@method_decorator(csrf_exempt, name='dispatch')
class OrganizerAnalyticsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        if not is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        projects_qs = Project.objects.select_related('creator').filter(creator=request.user, is_deleted=False)
        tasks_qs = Task.objects.select_related('project', 'project__creator').filter(project__creator=request.user, project__is_deleted=False, is_deleted=False)
        photos_qs = Photo.objects.select_related('task', 'volunteer').filter(project__creator=request.user, project__is_deleted=False, is_deleted=False)

        projects_by_status = [
            {'status': status_key, 'label': label, 'count': projects_qs.filter(status=status_key).count()}
            for status_key, label in Project.STATUS_CHOICES
        ]
        tasks_by_status = [
            {'status': status_key, 'label': label, 'count': tasks_qs.filter(status=status_key).count()}
            for status_key, label in Task.STATUS_CHOICES
        ]
        photos_by_status = [
            {'status': status_key, 'label': label, 'count': photos_qs.filter(status=status_key).count()}
            for status_key, label in Photo.STATUS_CHOICES
        ]

        volunteer_ids = list(VolunteerProject.objects.filter(
            project__creator=request.user,
            project__is_deleted=False,
            is_active=True,
        ).values_list('volunteer_id', flat=True).distinct())

        top_volunteers = []
        for volunteer in User.objects.filter(id__in=volunteer_ids, is_organizer=False):
            completed_task_ids = set(TaskAssignment.objects.filter(
                volunteer=volunteer,
                task__project__creator=request.user,
                task__project__is_deleted=False,
                task__is_deleted=False,
                completed=True,
            ).values_list('task_id', flat=True))
            approved_photo_task_ids = set(Photo.objects.filter(
                volunteer=volunteer,
                project__creator=request.user,
                project__is_deleted=False,
                is_deleted=False,
                status='approved',
                task__isnull=False,
            ).values_list('task_id', flat=True))
            top_volunteers.append({
                'id': volunteer.id,
                'name': volunteer.name or volunteer.username,
                'username': volunteer.username,
                'completed_tasks': len(completed_task_ids | approved_photo_task_ids),
                'average_rating': volunteer.average_rating,
                'trust_factor': volunteer.trust_factor,
            })

        top_volunteers.sort(key=lambda item: (-item['completed_tasks'], -item['average_rating'], item['name']))

        return Response({
            'summary': {
                'total_projects': projects_qs.count(),
                'approved_projects': projects_qs.filter(status='approved').count(),
                'total_tasks': tasks_qs.count(),
                'completed_tasks': tasks_qs.filter(status='completed').count(),
                'total_photos': photos_qs.count(),
                'approved_photos': photos_qs.filter(status='approved').count(),
                'volunteers_count': len(volunteer_ids),
            },
            'projects_by_status': projects_by_status,
            'tasks_by_status': tasks_by_status,
            'photos_by_status': photos_by_status,
            'top_volunteers': top_volunteers[:10],
        }, status=status.HTTP_200_OK)


urlpatterns = [
    path('register/volunteer/', VolunteerRegistrationAPIView.as_view(), name='register_volunteer'),
    path('register/organizer/', OrganizerRegistrationAPIView.as_view(), name='register_organizer'),
    path('verify-email/', EmailVerificationAPIView.as_view(), name='verify_email'),
    path('resend-verification-code/', ResendVerificationCodeAPIView.as_view(), name='resend_verification_code'),
    path('cancel-registration/', CancelRegistrationAPIView.as_view(), name='cancel_registration'),
    path('password-reset/', PasswordResetRequestAPIView.as_view(), name='password_reset_request'),
    # Совместимость со старым фронтом (dist без пересборки) — раньше вызывали .../password-reset/request/
    path('password-reset/request/', PasswordResetRequestAPIView.as_view(), name='password_reset_request_legacy'),
    path('password-reset/confirm/', PasswordResetConfirmAPIView.as_view(), name='password_reset_confirm'),
    path('login/', VolunteerLoginAPIView.as_view(), name='login'),
    path('logout/', VolunteerLogoutAPIView.as_view(), name='logout'),
    path('change-password/', ChangePasswordAPIView.as_view(), name='change_password'),
    path('me/', VolunteerMeAPIView.as_view(), name='me'),
    path('volunteer/profile/', VolunteerProfileAPIView.as_view(), name='volunteer_profile'),
    path('organizer/dashboard/', OrganizerDashboardAPIView.as_view(), name='organizer_dashboard'),
    path('organizer/profile/', OrganizerProfileAPIView.as_view(), name='organizer_profile'),
    path('organizer/<int:organizer_id>/portfolio/', OrganizerPortfolioAPIView.as_view(), name='organizer_portfolio'),
    path('organizer/projects/', OrganizerProjectsAPIView.as_view(), name='organizer_projects'),
    path('organizer/projects/<int:project_id>/', OrganizerProjectsAPIView.as_view(), name='organizer_project_detail'),
    path('organizer/volunteers/', OrganizerVolunteersAPIView.as_view(), name='organizer_volunteers'),
    path('organizer/volunteers/<int:volunteer_id>/', OrganizerVolunteerDetailAPIView.as_view(), name='organizer_volunteer_detail'),
    path('organizer/tasks/', OrganizerTasksAPIView.as_view(), name='organizer_tasks'),
    path('organizer/projects/<int:project_id>/tasks/', OrganizerProjectTasksAPIView.as_view(), name='organizer_project_tasks'),
    path('organizer/tasks/<int:task_id>/', OrganizerTaskDetailAPIView.as_view(), name='organizer_task_detail'),
    path('organizer/photo-moderation/', OrganizerPhotoModerationAPIView.as_view(), name='organizer_photo_moderation'),
    path('organizer/photos/<int:photo_id>/approve/', OrganizerPhotoApproveAPIView.as_view(), name='organizer_photo_approve'),
    path('organizer/photos/<int:photo_id>/reject/', OrganizerPhotoRejectAPIView.as_view(), name='organizer_photo_reject'),
    path('organizer/analytics/', OrganizerAnalyticsAPIView.as_view(), name='organizer_analytics'),
    path('volunteer/dashboard/', VolunteerDashboardAPIView.as_view(), name='volunteer_dashboard'),
    path('volunteer/calendar/', VolunteerCalendarAPIView.as_view(), name='volunteer_calendar'),
    path('volunteer/tasks/<int:task_id>/photo-reports/', VolunteerTaskPhotoReportAPIView.as_view(), name='volunteer_task_photo_reports'),
    path('volunteer/photo-reports/', VolunteerPhotoReportsAPIView.as_view(), name='volunteer_photo_reports'),
    path('volunteer/tasks/<int:task_id>/accept/', VolunteerTaskAcceptAPIView.as_view(), name='volunteer_task_accept'),
    path('volunteer/tasks/<int:task_id>/decline/', VolunteerTaskDeclineAPIView.as_view(), name='volunteer_task_decline'),
    path('volunteer/tasks/<int:task_id>/retry/', VolunteerTaskRetryAPIView.as_view(), name='volunteer_task_retry'),
    path('volunteer/tasks/<int:task_id>/complete/', VolunteerTaskCompleteAPIView.as_view(), name='volunteer_task_complete'),
    path('volunteer/projects/', VolunteerProjectsAPIView.as_view(), name='volunteer_projects'),
    path('volunteer/projects/<int:project_id>/', VolunteerProjectDetailAPIView.as_view(), name='volunteer_project_detail'),
    path('volunteer/projects/<int:project_id>/join/', VolunteerProjectJoinAPIView.as_view(), name='volunteer_project_join'),
    path('volunteer/projects/<int:project_id>/leave/', VolunteerProjectLeaveAPIView.as_view(), name='volunteer_project_leave'),
    path('volunteer/notifications/', VolunteerNotificationsAPIView.as_view(), name='volunteer_notifications'),
    path('volunteer/notifications/read-all/', VolunteerNotificationReadAllAPIView.as_view(), name='volunteer_notifications_read_all'),
    path('volunteer/notifications/<int:notification_id>/read/', VolunteerNotificationReadAPIView.as_view(), name='volunteer_notification_read'),
    path('volunteer/stats/', VolunteerStatsAPIView.as_view(), name='volunteer_stats'),
    path('volunteer/activity/', VolunteerActivityAPIView.as_view(), name='volunteer_activity'),
    path('telegram/sync/', TelegramSyncAPIView.as_view(), name='telegram_sync'),
    path('ai/ask/', AIAssistantAPIView.as_view(), name='ai_assistant'),
    path('volunteer/tasks/', VolunteerTasksAPIView.as_view(), name='volunteer_tasks_list'),
    path('volunteer/tasks/<int:task_id>/', VolunteerTaskDetailAPIView.as_view(), name='volunteer_task_detail'),
    path('volunteer/tasks/<int:task_id>/archive/', VolunteerTaskArchiveAPIView.as_view(), name='volunteer_task_archive'),
]

# --- Chat API Views ---

# --- Chat API Views ---
from api.chat.models import Chat, Message

@method_decorator(csrf_exempt, name='dispatch')
class VolunteerChatsListAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        today = timezone.localdate()
        cleanup_archived_project_chats(today=today)
        chats = Chat.objects.filter(
            Q(chat_type__in=['direct', 'group']) | _active_project_chat_filter(today),
            participants=request.user,
            is_active=True
        ).select_related('project').prefetch_related('participants', 'messages')
        
        chat_list = []
        for chat in chats:
            # Get last message
            last_message = chat.messages.filter(is_deleted=False).order_by('-created_at').first()
            last_message_data = None
            if last_message:
                last_message_data = {
                    'text': last_message.text or 'Вложение',
                    'sender_name': last_message.sender.name or last_message.sender.username,
                    'is_read': last_message.is_read,
                    'created_at': last_message.created_at.isoformat()
                }
                last_message_data['text'] = _build_chat_message_preview(last_message)

            # Unread count
            unread_count = chat.get_unread_count(request.user)

            # Title and Avatar logic
            title = chat.name
            avatar = None
            if chat.chat_type == 'project' and chat.project:
                title = f"{chat.project.title}"
                avatar = self.get_project_avatar(request, chat.project)
            elif chat.chat_type == 'direct':
                # Find the other user
                other_user = chat.participants.exclude(id=request.user.id).first()
                if other_user:
                    title = other_user.name or other_user.username
                    avatar = self.get_user_avatar(request, other_user)
            
            chat_list.append({
                'id': chat.id,
                'title': title,
                'avatar': avatar,
                'chat_type': chat.chat_type,
                'project_id': chat.project_id if chat.chat_type == 'project' else None,
                'unread_count': unread_count,
                'last_message': last_message_data,
                'updated_at': chat.updated_at.isoformat()
            })
            
        # Sort by latest activity
        chat_list.sort(key=lambda x: x['last_message']['created_at'] if x['last_message'] else x['updated_at'], reverse=True)
        return Response({'chats': chat_list}, status=status.HTTP_200_OK)

    def get_project_avatar(self, request, project):
        if hasattr(project, 'cover_image') and project.cover_image:
            return request.build_absolute_uri(project.cover_image.url)
        return None

    def get_user_avatar(self, request, user):
        if hasattr(user, 'avatar') and user.avatar:
            return request.build_absolute_uri(user.avatar.url)
        return None

@method_decorator(csrf_exempt, name='dispatch')
class VolunteerChatMessagesAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, chat_id, *args, **kwargs):
        chat = _get_volunteer_chat_for_user(request.user, chat_id)
        
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))
        
        # Получаем список ID заблокированных пользователей
        from api.support.models import Block
        blocked_user_ids = Block.objects.filter(blocker=request.user).values_list('blocked_id', flat=True)
        
        messages_qs = chat.messages.filter(is_deleted=False).exclude(sender_id__in=blocked_user_ids).select_related('sender').order_by('-created_at')[offset:offset + limit]
        
        # Also mark these fetched messages as read if unread
        unread_messages = [msg for msg in messages_qs if not msg.is_read and msg.sender != request.user]
        if unread_messages:
            for msg in unread_messages:
                msg.is_read = True
                msg.read_at = timezone.now()
            Message.objects.bulk_update(unread_messages, ['is_read', 'read_at'])

        messages = []
        for msg in reversed(list(messages_qs)):
            image_url = request.build_absolute_uri(msg.image.url) if msg.image else None
            messages.append({
                'id': msg.id,
                'text': msg.text,
                'sender_id': msg.sender.id,
                'sender_name': msg.sender.name or msg.sender.username,
                'avatar': request.build_absolute_uri(msg.sender.avatar.url) if getattr(msg.sender, 'avatar', None) else None,
                'message_type': 'photo' if image_url else msg.message_type,
                'image_url': image_url,
                'photo_url': image_url,
                'file_url': request.build_absolute_uri(msg.file.url) if msg.file else None,
                'is_read': msg.is_read,
                'created_at': msg.created_at.isoformat(),
            })
            
        return Response({'messages': messages, 'count': len(messages)}, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class VolunteerSendMessageAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)
    parser_classes = (JSONParser, MultiPartParser, FormParser)

    def post(self, request, chat_id, *args, **kwargs):
        chat = _get_volunteer_chat_for_user(request.user, chat_id)
        
        text = request.data.get('text', '').strip()
        image = request.FILES.get('image')
        file = request.FILES.get('file')
        
        if not text and not image and not file:
            return Response({'error': 'Сообщение не может быть пустым'}, status=status.HTTP_400_BAD_REQUEST)
        
        msg_type = 'text'
        if image:
            msg_type = 'image'
        elif file:
            msg_type = 'file'
            
        message = Message.objects.create(
            chat=chat,
            sender=request.user,
            text=text,
            message_type=msg_type,
            image=image,
            file=file,
            is_delivered=True,
            delivered_at=timezone.now(),
        )
        
        chat.updated_at = timezone.now()
        chat.save(update_fields=['updated_at'])

        image_url = request.build_absolute_uri(message.image.url) if message.image else None
        
        return Response({
            'id': message.id,
            'text': message.text,
            'sender_id': message.sender.id,
            'sender_name': message.sender.name or message.sender.username,
            'avatar': request.build_absolute_uri(message.sender.avatar.url) if getattr(message.sender, 'avatar', None) else None,
            'message_type': 'photo' if image_url else message.message_type,
            'image_url': image_url,
            'photo_url': image_url,
            'file_url': request.build_absolute_uri(message.file.url) if message.file else None,
            'created_at': message.created_at.isoformat(),
        }, status=status.HTTP_201_CREATED)

@method_decorator(csrf_exempt, name='dispatch')
class VolunteerMarkMessagesReadAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, chat_id, *args, **kwargs):
        chat = _get_volunteer_chat_for_user(request.user, chat_id)
        
        updated = chat.messages.filter(
            is_read=False,
            is_deleted=False
        ).exclude(sender=request.user).update(
            is_read=True,
            read_at=timezone.now()
        )
        
        return Response({'message': 'Сообщения отмечены как прочитанные', 'updated_count': updated}, status=status.HTTP_200_OK)

urlpatterns += [
    path('volunteer/chats/', VolunteerChatsListAPIView.as_view(), name='volunteer_chats_list'),
    path('volunteer/chats/<int:chat_id>/messages/', VolunteerChatMessagesAPIView.as_view(), name='volunteer_chat_messages'),
    path('volunteer/chats/<int:chat_id>/send/', VolunteerSendMessageAPIView.as_view(), name='volunteer_send_message'),
    path('volunteer/chats/<int:chat_id>/read/', VolunteerMarkMessagesReadAPIView.as_view(), name='volunteer_mark_messages_read'),
]

# ============================================================================
# МОДЕРАЦИЯ И БЕЗОПАСНОСТЬ (БЛОКИРОВКИ И ЖАЛОБЫ)
# ============================================================================

from api.serializers.web_portal import BlockSerializer, ReportSerializer
from api.support.models import Block, Report

@method_decorator(csrf_exempt, name='dispatch')
class BlockListCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        blocks = Block.objects.filter(blocker=request.user)
        serializer = BlockSerializer(blocks, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        blocked_user_id = request.data.get('blocked_user_id')
        if not blocked_user_id:
            return Response({'error': 'blocked_user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        if int(blocked_user_id) == request.user.id:
            return Response({'error': 'You cannot block yourself'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            blocked_user = User.objects.get(id=blocked_user_id)
        except User.DoesNotExist:
            return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

        block, created = Block.objects.get_or_create(blocker=request.user, blocked=blocked_user)
        
        if created:
            # Скрываем все сообщения в чатах
            pass

        serializer = BlockSerializer(block)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class BlockDestroyAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def delete(self, request, pk, *args, **kwargs):
        try:
            block = Block.objects.get(id=pk, blocker=request.user)
            block.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Block.DoesNotExist:
            return Response({'error': 'Block not found'}, status=status.HTTP_404_NOT_FOUND)

@method_decorator(csrf_exempt, name='dispatch')
class ReportCreateAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def post(self, request, *args, **kwargs):
        reported_user_id = request.data.get('reported_user_id')
        content_type = request.data.get('content_type')
        content_id = request.data.get('content_id')
        reason = request.data.get('reason')
        details = request.data.get('details', '')

        if not content_type or not reason:
            return Response({'error': 'content_type and reason are required'}, status=status.HTTP_400_BAD_REQUEST)

        reported_user = None
        if reported_user_id:
            try:
                reported_user = User.objects.get(id=reported_user_id)
            except User.DoesNotExist:
                return Response({'error': 'Reported user not found'}, status=status.HTTP_404_NOT_FOUND)

        report = Report.objects.create(
            reporter=request.user,
            reported_user=reported_user,
            content_type=content_type,
            content_id=content_id,
            reason=reason,
            details=details
        )
        
        serializer = ReportSerializer(report)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

urlpatterns += [
    path('blocks/', BlockListCreateAPIView.as_view(), name='blocks_list_create'),
    path('blocks/<int:pk>/', BlockDestroyAPIView.as_view(), name='block_destroy'),
    path('reports/', ReportCreateAPIView.as_view(), name='report_create'),
]

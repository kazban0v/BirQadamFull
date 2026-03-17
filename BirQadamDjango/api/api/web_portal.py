from __future__ import annotations

import logging

from django.conf import settings
from django.contrib.auth import get_user_model, login, logout
from django.urls import path
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from asgiref.sync import async_to_sync
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

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
from api.users.services.profile import get_volunteer_stats, get_volunteer_activity
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
from api.users.models import Activity
from api.projects.models import Project, VolunteerProject
from api.notifications.models import NotificationRecipient
from shared.notifications.utils import notify_organizer_new_photo
from .authentication import CsrfExemptSessionAuthentication

logger = logging.getLogger(__name__)
app_name = 'web_portal'
User = get_user_model()


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
                'temporary_password': result.temporary_password,
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
                'temporary_password': result.temporary_password,
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
            
            # Удаляем все коды подтверждения для этого email (включая старые)
            from api.models import VerificationCode
            VerificationCode.objects.filter(
                email=email,
                verification_type='email_verification'
            ).delete()
            
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
            from api.users.models import VerificationCode
            from datetime import timedelta
            import secrets
            
            # Деактивируем все предыдущие неиспользованные коды для этого email
            VerificationCode.objects.filter(
                email=email,
                verification_type='email_verification',
                is_used=False
            ).update(is_used=True)
            
            # Генерируем уникальный 6-значный код
            max_attempts = 10
            code = None
            for attempt in range(max_attempts):
                code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
                if not VerificationCode.objects.filter(
                    code=code,
                    email=email,
                    verification_type='email_verification',
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
                verification_type='email_verification',
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
                logger.info(f"Password reset code sent to email: {email}, code: {code}")
            except Exception as email_error:
                logger.error(f"Failed to send password reset email to {email}: {str(email_error)}")
                logger.error(f"Email settings: FROM={settings.DEFAULT_FROM_EMAIL}, HOST={getattr(settings, 'EMAIL_HOST', 'N/A')}")
                raise  # Пробрасываем ошибку дальше
            
            logger.info(f"Password reset code sent to email: {email}")
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
        
        # Проверяем код
        from api.users.models import VerificationCode
        verification_code = VerificationCode.objects.filter(
            user=user,
            email=email,
            code=code,
            verification_type='email_verification',
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
        # Проверяем, что пользователь организатор И одобрен администратором
        is_organizer = (getattr(user, 'role', None) == 'organizer' or getattr(user, 'is_organizer', False)) and \
                       getattr(user, 'organizer_status', None) == 'approved'
        dashboard_url = '/organizer/dashboard' if is_organizer else '/volunteer/dashboard'
        return Response(
            {
                'message': 'Вход выполнен успешно.',
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
                },
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

    def get(self, request, *args, **kwargs):
        serializer = VolunteerProfileSerializer(request.user)
        data = serializer.data
        logger.info(f"VolunteerProfileAPIView: Returning profile data for user {request.user.username}, trust_factor={data.get('trust_factor')}, average_rating={data.get('average_rating')}")
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

        if Photo.objects.filter(task=task, volunteer=request.user, is_deleted=False).exists():
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
        if task.status == 'in_progress':
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

        is_participant = VolunteerProject.objects.filter(
            volunteer=request.user,
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

            if not TaskAssignment.objects.filter(task=task, accepted=True).exists():
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

        # Получаем только непрочитанные Activity записи (без фильтрации по is_read, так как у Activity нет такого поля)
        # Для отслеживания прочитанных Activity используем отдельный механизм или фильтруем на фронтенде
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
                'status': 'pending',  # Activity записи показываются как pending (непрочитанные)
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

        # Подсчитываем непрочитанные уведомления (без Activity, так как они отслеживаются на фронтенде)
        unread_count = (
            NotificationRecipient.objects.filter(
                user=request.user,
                status__in=['pending', 'sent'],
            ).count() +
            activities_qs.count()  # Все Activity записи считаются непрочитанными (будут фильтроваться на фронтенде)
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
                # Для Activity записей можно пометить как прочитанные, удалив их из активных
                # или просто вернуть успех (так как они не учитываются в непрочитанных после отметки)
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

        # Activity записи не помечаем как прочитанные, так как у них нет поля is_read
        # Они будут исключаться из непрочитанных на фронтенде после отметки
        
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
        try:
            months = int(request.query_params.get('months', 6))
        except ValueError:
            return Response({'detail': 'Параметр months должен быть числом.'}, status=status.HTTP_400_BAD_REQUEST)

        activity = get_volunteer_activity(request.user, months=months)
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
            tasks_count = Task.objects.filter(project=project, is_deleted=False).distinct().count()
            active_members = VolunteerProject.objects.filter(project=project, is_active=True).distinct().count()
            
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

    def _is_approved_organizer(self, user):
        """Проверяет, является ли пользователь одобренным организатором"""
        is_organizer = getattr(user, 'is_organizer', False) or getattr(user, 'role', None) == 'organizer'
        organizer_status = getattr(user, 'organizer_status', None)
        return bool(is_organizer and organizer_status == 'approved')

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
        if not self._is_approved_organizer(request.user):
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

        from django.db.models import Count, Q
        
        projects_qs = (
            Project.objects.filter(creator=request.user, is_deleted=False)
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
        if not self._is_approved_organizer(request.user):
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
        if not self._is_approved_organizer(request.user):
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
            'volunteer_count': VolunteerProject.objects.filter(project=project, is_active=True).count(),
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
        if not self._is_approved_organizer(request.user):
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


urlpatterns = [
    path('register/volunteer/', VolunteerRegistrationAPIView.as_view(), name='register_volunteer'),
    path('register/organizer/', OrganizerRegistrationAPIView.as_view(), name='register_organizer'),
    path('login/', VolunteerLoginAPIView.as_view(), name='login'),
    path('logout/', VolunteerLogoutAPIView.as_view(), name='logout'),
    path('me/', VolunteerMeAPIView.as_view(), name='me'),
    path('volunteer/profile/', VolunteerProfileAPIView.as_view(), name='volunteer_profile'),
    path('organizer/profile/', OrganizerProfileAPIView.as_view(), name='organizer_profile'),
    path('organizer/<int:organizer_id>/portfolio/', OrganizerPortfolioAPIView.as_view(), name='organizer_portfolio'),
    path('organizer/projects/', OrganizerProjectsAPIView.as_view(), name='organizer_projects'),
    path('organizer/projects/<int:project_id>/', OrganizerProjectsAPIView.as_view(), name='organizer_project_detail'),
    path('volunteer/dashboard/', VolunteerDashboardAPIView.as_view(), name='volunteer_dashboard'),
    path('volunteer/tasks/<int:task_id>/photo-reports/', VolunteerTaskPhotoReportAPIView.as_view(), name='volunteer_task_photo_reports'),
    path('volunteer/photo-reports/', VolunteerPhotoReportsAPIView.as_view(), name='volunteer_photo_reports'),
    path('volunteer/tasks/<int:task_id>/accept/', VolunteerTaskAcceptAPIView.as_view(), name='volunteer_task_accept'),
    path('volunteer/tasks/<int:task_id>/decline/', VolunteerTaskDeclineAPIView.as_view(), name='volunteer_task_decline'),
    path('volunteer/tasks/<int:task_id>/retry/', VolunteerTaskRetryAPIView.as_view(), name='volunteer_task_retry'),
    path('volunteer/tasks/<int:task_id>/complete/', VolunteerTaskCompleteAPIView.as_view(), name='volunteer_task_complete'),
    path('volunteer/tasks/<int:task_id>/retry/', VolunteerTaskRetryAPIView.as_view(), name='volunteer_task_retry'),
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
    path('verify-email/', EmailVerificationAPIView.as_view(), name='verify_email'),
    path('resend-verification-code/', ResendVerificationCodeAPIView.as_view(), name='resend_verification_code'),
    path('cancel-registration/', CancelRegistrationAPIView.as_view(), name='cancel_registration'),
    path('password-reset/request/', PasswordResetRequestAPIView.as_view(), name='password_reset_request'),
    path('password-reset/confirm/', PasswordResetConfirmAPIView.as_view(), name='password_reset_confirm'),
    path('change-password/', ChangePasswordAPIView.as_view(), name='change_password'),
    path('ai/ask/', AIAssistantAPIView.as_view(), name='ai_assistant'),
]


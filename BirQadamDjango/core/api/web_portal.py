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

from core.serializers import (
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
from core.services import (
    RegistrationError,
    register_organizer,
    register_volunteer,
)
from core.services.web_portal_dashboard import get_volunteer_dashboard_data
from core.services.web_portal_projects import get_projects_catalog
from core.services.web_portal_profile import get_volunteer_stats, get_volunteer_activity
from core.services.telegram_sync import (
    generate_link_code,
    get_user_link_code,
    is_telegram_linked,
)
from core.services.email_verification import (
    verify_email_code,
    generate_verification_code,
    get_user_verification_code,
)
from core.utils.utils import normalize_phone
from core.models import Task, Photo, Activity, Project, VolunteerProject, TaskAssignment, NotificationRecipient
from core.services.notification_utils import notify_organizer_new_photo
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
        serializer = VolunteerRegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

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
        
        if not email:
            return Response(
                {'detail': 'Email обязателен.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            # Ищем только неактивных пользователей (не подтвержденных)
            user = User.objects.get(email__iexact=email, is_active=False)
            
            # Удаляем все коды подтверждения для этого email (включая старые)
            from core.models import EmailVerificationCode
            EmailVerificationCode.objects.filter(email=email).delete()
            
            # Удаляем пользователя
            user.delete()
            
            logger.info(f"Регистрация отменена, пользователь удален: {email}")
            return Response(
                {'message': 'Регистрация отменена.'},
                status=status.HTTP_200_OK
            )
        except User.DoesNotExist:
            # Пользователь не найден или уже активирован - это нормально
            logger.info(f"Попытка отменить регистрацию для несуществующего или активного пользователя: {email}")
            return Response(
                {'message': 'Регистрация не найдена или уже завершена.'},
                status=status.HTTP_200_OK
            )
        except Exception as e:
            logger.error(f"Ошибка при отмене регистрации для {email}: {str(e)}")
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
            user = User.objects.get(email__iexact=email, is_active=True)
        except User.DoesNotExist:
            # Не раскрываем информацию о том, существует ли пользователь
            logger.warning(f"Password reset requested for non-existent email: {email}")
            return Response(
                {
                    'message': 'Если аккаунт с таким email существует, на него будет отправлен код для сброса пароля.'
                },
                status=status.HTTP_200_OK
            )
        
        try:
            # Генерируем код для сброса пароля
            from core.services.email_verification import EmailVerificationCode
            from datetime import timedelta
            import secrets
            
            # Деактивируем все предыдущие неиспользованные коды для этого email
            EmailVerificationCode.objects.filter(
                email=email,
                is_used=False
            ).update(is_used=True)
            
            # Генерируем уникальный 6-значный код
            max_attempts = 10
            code = None
            for attempt in range(max_attempts):
                code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])
                if not EmailVerificationCode.objects.filter(
                    code=code,
                    email=email,
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
            verification_code = EmailVerificationCode.objects.create(
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
            send_mail(
                subject=subject,
                message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
            
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
        from core.services.email_verification import EmailVerificationCode
        verification_code = EmailVerificationCode.objects.filter(
            user=user,
            email=email,
            code=code,
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

        return Response(
            {
                'message': 'Задача скрыта из ваших активных.',
                'task_status': task.status,
            },
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
class VolunteerProjectsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        catalog = get_projects_catalog(request.user, request=request)
        serializer = VolunteerProjectCatalogSerializer(catalog['projects'], many=True)
        return Response(
            {'projects': serializer.data, 'summary': catalog['summary']},
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

        volunteer_project, created = VolunteerProject.objects.get_or_create(
            volunteer=request.user,
            project=project,
            defaults={'is_active': True},
        )

        if not created and not volunteer_project.is_active:
            volunteer_project.is_active = True
            volunteer_project.save(update_fields=['is_active'])

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
class VolunteerNotificationsAPIView(APIView):
    permission_classes = [IsAuthenticated]
    authentication_classes = (CsrfExemptSessionAuthentication,)

    def get(self, request, *args, **kwargs):
        from core.models import Activity
        
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
            logger.warning('⚠️ TEMPORARY: Returning raw stats data without serializer for debugging')
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
            from core.models import VolunteerProject
            from django.db.models import Count, Q
            
            project = Project.objects.select_related('creator').prefetch_related('tags').get(
                id=project_id,
                is_deleted=False,
                status='approved',
            )
            
            # Проверяем, присоединен ли волонтер к проекту
            volunteer_project = VolunteerProject.objects.filter(
                volunteer=request.user,
                project=project,
                is_active=True,
            ).first()
            
            # Получаем статистику (используем distinct для правильного подсчета)
            tasks_count = Task.objects.filter(project=project, is_deleted=False).distinct().count()
            active_members = VolunteerProject.objects.filter(project=project, is_active=True).distinct().count()
            
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
                    'joined': bool(volunteer_project),
                    'joined_at': volunteer_project.joined_at.isoformat() if volunteer_project and volunteer_project.joined_at else None,
                    'active_members': active_members,
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
            from core.services.ai_agent_service import AIAgentService
            
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
    path('volunteer/dashboard/', VolunteerDashboardAPIView.as_view(), name='volunteer_dashboard'),
    path('volunteer/tasks/<int:task_id>/photo-reports/', VolunteerTaskPhotoReportAPIView.as_view(), name='volunteer_task_photo_reports'),
    path('volunteer/photo-reports/', VolunteerPhotoReportsAPIView.as_view(), name='volunteer_photo_reports'),
    path('volunteer/tasks/<int:task_id>/accept/', VolunteerTaskAcceptAPIView.as_view(), name='volunteer_task_accept'),
    path('volunteer/tasks/<int:task_id>/decline/', VolunteerTaskDeclineAPIView.as_view(), name='volunteer_task_decline'),
    path('volunteer/tasks/<int:task_id>/complete/', VolunteerTaskCompleteAPIView.as_view(), name='volunteer_task_complete'),
    path('volunteer/projects/', VolunteerProjectsAPIView.as_view(), name='volunteer_projects'),
    path('volunteer/projects/<int:project_id>/', VolunteerProjectDetailAPIView.as_view(), name='volunteer_project_detail'),
    path('volunteer/projects/<int:project_id>/join/', VolunteerProjectJoinAPIView.as_view(), name='volunteer_project_join'),
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


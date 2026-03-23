import os
from typing import Any, Dict, Optional
import firebase_admin  # type: ignore[reportMissingTypeStubs]
from firebase_admin import credentials, messaging  # type: ignore[reportMissingTypeStubs]
from django.conf import settings
from core.models import DeviceToken, User

class FCMService:
    _app: Optional[Any] = None

    @classmethod
    def _initialize_firebase(cls) -> bool:
        """Инициализация Firebase Admin SDK"""
        if cls._app is None:
            try:
                credentials_path = getattr(settings, 'FIREBASE_CREDENTIALS_PATH', None)

                if credentials_path and os.path.exists(credentials_path):
                    cred = credentials.Certificate(credentials_path)
                    cls._app = firebase_admin.initialize_app(cred)
                    print("Firebase Admin SDK инициализирован успешно")
                    return True
                else:
                    print(f"Firebase credentials файл не найден: {credentials_path}")
                    return False

            except ValueError as e:
                if "already exists" in str(e):
                    print("Firebase уже инициализирован")
                    return True
                else:
                    print(f"Ошибка инициализации Firebase: {e}")
                    return False
            except Exception as e:
                print(f"Ошибка инициализации Firebase: {e}")
                return False

        return True

    @classmethod
    def send_notification_to_user(cls, user: User, title: str, body: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Отправка уведомления пользователю через Firebase Admin SDK"""
        if not cls._initialize_firebase():
            return {'success': False, 'error': 'Firebase не инициализирован'}

        # Получить активные токены пользователя
        device_tokens = DeviceToken.objects.filter(user=user, is_active=True)

        if not device_tokens.exists():
            print(f"У пользователя {user.username} нет активных токенов")
            return {'success': False, 'error': 'У пользователя нет активных токенов'}

        results = {'success': True, 'success_count': 0, 'failure_count': 0, 'responses': []}

        for device_token in device_tokens:
            token = device_token.token

            # Проверка на тестовые токены
            if token.startswith('test_'):
                print(f"Пропускаем тестовый токен: {token[:30]}...")
                device_token.is_active = False
                device_token.save()
                results['failure_count'] += 1
                results['responses'].append("Test token deactivated")
                continue

            try:
                message = messaging.Message(
                    notification=messaging.Notification(title=title, body=body),
                    data=data or {},
                    token=token,
                )

                response = messaging.send(message)
                results['success_count'] += 1
                results['responses'].append(f"Success: {response}")
                print(f"Сообщение отправлено пользователю {user.username}: {response}")

            except messaging.UnregisteredError:
                # Токен недействителен, деактивируем его
                device_token.is_active = False
                device_token.save()
                results['failure_count'] += 1
                results['responses'].append("Token unregistered - deactivated")
                print(f"Токен деактивирован для {user.username}")

            except Exception as e:
                # Неверный формат токена или другие ошибки
                if "invalid" in str(e).lower() or "argument" in str(e).lower():
                    device_token.is_active = False
                    device_token.save()
                    results['failure_count'] += 1
                    results['responses'].append("Invalid token format - deactivated")
                    print(f"Неверный формат токена для {user.username}")
                else:
                    results['failure_count'] += 1
                    results['responses'].append(f"Error: {str(e)}")
                    print(f"Ошибка отправки для {user.username}: {e}")

        return results

    @classmethod
    def send_notification_to_multiple_users(cls, users: Any, title: str, body: str, data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Отправка уведомления нескольким пользователям"""
        results = {'success': True, 'success_count': 0, 'failure_count': 0, 'responses': []}

        for user in users:
            user_result = cls.send_notification_to_user(user, title, body, data)
            results['success_count'] += user_result.get('success_count', 0)
            results['failure_count'] += user_result.get('failure_count', 0)
            results['responses'].extend(user_result.get('responses', []))

        return results

    @staticmethod
    def save_device_token(user: User, token: str, platform: str = 'android') -> Dict[str, Any]:
        """Сохранение device token пользователя"""
        try:
            device_token, created = DeviceToken.objects.update_or_create(
                user=user,
                platform=platform,
                defaults={
                    'token': token,
                    'is_active': True
                }
            )

            action = "создан" if created else "обновлен"
            print(f"Device token для {user.username} {action}")
            return {'success': True, 'created': created}

        except Exception as e:
            print(f"Ошибка сохранения device token: {e}")
            return {'success': False, 'error': str(e)}

    @staticmethod
    def deactivate_device_token(user: User, platform: str = 'android') -> Dict[str, Any]:
        """Деактивация device token пользователя"""
        try:
            updated = DeviceToken.objects.filter(
                user=user,
                platform=platform
            ).update(is_active=False)

            print(f"Деактивировано {updated} device tokens для {user.username}")
            return {'success': True, 'updated_count': updated}

        except Exception as e:
            print(f"Ошибка деактивации device token: {e}")
            return {'success': False, 'error': str(e)}


# Функции для удобного использования в коде

def notify_task_assigned(task: Any) -> Dict[str, Any]:
    """Уведомление волонтеров о новом задании"""
    from core.models import VolunteerProject, User

    # Находим всех волонтеров проекта
    volunteer_users = User.objects.filter(
        volunteer_projects__project=task.project,
        volunteer_projects__is_active=True
    ).distinct()

    if volunteer_users.exists():
        title = "Новое задание!"
        body = f"Проект: {task.project.title}\nЗадание: {task.text[:100]}..."

        data = {
            'type': 'task_assigned',
            'project_id': str(task.project.id),
            'task_id': str(task.id),
            'project_title': task.project.title,
            'task_text': task.text
        }

        return FCMService.send_notification_to_multiple_users(
            volunteer_users, title, body, data
        )

    return {'error': 'No volunteers found'}


def notify_project_approved(project: Any) -> Dict[str, Any]:
    """Уведомление организатора об одобрении проекта"""
    title = "Проект одобрен!"
    body = f"Ваш проект '{project.title}' был одобрен администратором."

    data = {
        'type': 'project_approved',
        'project_id': str(project.id),
        'project_title': project.title
    }

    return FCMService.send_notification_to_user(project.creator, title, body, data)


def notify_project_deleted(project: Any) -> Dict[str, Any]:
    """Уведомление участников о удалении проекта"""
    from core.models import VolunteerProject, User

    # Находим всех участников проекта
    participants = User.objects.filter(
        volunteer_projects__project=project,
        volunteer_projects__is_active=True
    ).distinct()

    # Добавляем организатора
    all_users = list(participants) + [project.creator]
    all_users = list(set(all_users))  # Убираем дубликаты

    title = "Проект удален"
    body = f"Проект '{project.title}' был удален организатором."

    data = {
        'type': 'project_deleted',
        'project_id': str(project.id),
        'project_title': project.title
    }

    return FCMService.send_notification_to_multiple_users(all_users, title, body, data)


def notify_photo_rejected(photo: Any) -> Dict[str, Any]:
    """Уведомление волонтера об отклонении фото"""
    title = "Фото отклонено"
    body = f"Ваше фото для проекта '{photo.project.title}' было отклонено."

    data = {
        'type': 'photo_rejected',
        'project_id': str(photo.project.id),
        'photo_id': str(photo.id),
        'project_title': photo.project.title
    }

    return FCMService.send_notification_to_user(photo.volunteer, title, body, data)
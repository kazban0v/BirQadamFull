"""
Modern FCM service using firebase-admin SDK (HTTP v1 API)
"""
import logging
import os
from typing import Any, Dict, List, Optional, Tuple
from django.conf import settings

logger = logging.getLogger(__name__)

# Глобальная переменная для инициализированного приложения
_firebase_app: Optional[Any] = None
_firebase_available: bool = False

def initialize_firebase() -> bool:
    """Инициализация Firebase Admin SDK"""
    global _firebase_app, _firebase_available

    if _firebase_app is not None:
        return True

    try:
        import firebase_admin  # type: ignore[reportMissingTypeStubs]
        from firebase_admin import credentials  # type: ignore[reportMissingTypeStubs]

        # Путь к service account файлу
        service_account_path = os.path.join(settings.BASE_DIR, 'firebase-service-account.json')

        if not os.path.exists(service_account_path):
            logger.warning(f"[FIREBASE] Service account file not found at {service_account_path}")
            logger.info("Please download it from Firebase Console:")
            logger.info("https://console.firebase.google.com/project/cleanupalmaty/settings/serviceaccounts/adminsdk")
            return False

        cred = credentials.Certificate(service_account_path)
        _firebase_app = firebase_admin.initialize_app(cred)
        _firebase_available = True

        logger.info("[FIREBASE] Admin SDK initialized successfully")
        return True

    except ImportError:
        logger.error("[FIREBASE] [ERROR] firebase-admin package not installed. Install it: pip install firebase-admin")
        return False
    except Exception as e:
        logger.error(f"[FIREBASE] [ERROR] Failed to initialize Firebase Admin SDK: {e}")
        return False


def send_fcm_push(device_tokens: List[str], title: str, body: str, data: Optional[Dict[str, Any]] = None) -> Tuple[int, int]:
    """
    Отправка FCM уведомления с использованием Firebase Admin SDK (HTTP v1 API)

    Args:
        device_tokens: список FCM токенов
        title: заголовок уведомления
        body: текст уведомления
        data: дополнительные данные (dict)

    Returns:
        tuple: (success_count, failure_count)
    """
    print("=" * 80)
    print("[FCM] Push Notification (Modern HTTP v1 API)")
    print(f"[FCM] Device tokens count: {len(device_tokens)}")
    print(f"[FCM] Title: {title}")
    print(f"[FCM] Body: {body[:100]}...")
    print("=" * 80)

    if not initialize_firebase():
        logger.warning("[FIREBASE] Not initialized, cannot send notifications")
        print("[FCM] [ERROR] Firebase not initialized")
        return (0, len(device_tokens))

    try:
        from firebase_admin import messaging  # type: ignore[reportMissingTypeStubs]

        # Конвертируем все значения data в строки (Firebase требует только строки)
        string_data = {}
        if data:
            for key, value in data.items():
                string_data[key] = str(value)

        print(f"[FCM] Data payload: {string_data}")

        # Создаем сообщения для каждого токена
        messages = []
        for token in device_tokens:
            message = messaging.Message(
                notification=messaging.Notification(
                    title=title,
                    body=body,
                ),
                data=string_data,
                token=token,
                android=messaging.AndroidConfig(
                    priority='high',
                    notification=messaging.AndroidNotification(
                        sound='default',
                        channel_id='cleanup_channel',
                    ),
                ),
            )
            messages.append(message)

        # Отправляем пакетно
        if len(messages) == 1:
            # Для одного сообщения используем send
            try:
                response = messaging.send(messages[0])
                print(f"[FCM] Success: 1, Failure: 0")
                print(f"[FCM] Message ID: {response}")
                logger.info(f"FCM notification sent successfully: {response}")
                return (1, 0)
            except Exception as e:
                print(f"[FCM] [ERROR] Failure: {e}")
                logger.error(f"Failed to send FCM notification: {e}")
                return (0, 1)
        else:
            # Для множества сообщений используем send_all
            response = messaging.send_all(messages)  # type: ignore[attr-defined]

            print(f"[FCM] Success: {response.success_count}, Failure: {response.failure_count}")
            logger.info(
                f"FCM notifications sent: "
                f"success={response.success_count}, "
                f"failure={response.failure_count}"
            )

            # Логируем ошибки
            if response.failure_count > 0:
                for idx, resp in enumerate(response.responses):
                    if not resp.success:
                        print(f"[FCM] [ERROR] Failed to send to token {device_tokens[idx][:20]}...: {resp.exception}")
                        logger.error(
                            f"Failed to send to token {device_tokens[idx][:20]}...: "
                            f"{resp.exception}"
                        )

            return (response.success_count, response.failure_count)

    except Exception as e:
        print(f"[FCM] [ERROR] Error sending FCM notification: {e}")
        logger.error(f"Error sending FCM notification: {e}")
        return (0, len(device_tokens))

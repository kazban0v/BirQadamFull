import logging
import json
from typing import Any, Dict, List, Optional
from django.conf import settings
from django.utils import timezone
from api.models import User, DeviceToken
import asyncio
from asgiref.sync import sync_to_async

# Безопасный импорт requests
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False
    logging.warning("Модуль requests не установлен. Push-уведомления будут отключены.")

logger = logging.getLogger(__name__)

def remove_emoji(text: str) -> str:
    """Удаляет эмодзи из текста для безопасного логирования"""
    import re
    # Удаляет все emoji и другие Unicode символы, которые не входят в ASCII
    emoji_pattern = re.compile("["
        u"\U0001F600-\U0001F64F"  # emoticons
        u"\U0001F300-\U0001F5FF"  # symbols & pictographs
        u"\U0001F680-\U0001F6FF"  # transport & map symbols
        u"\U0001F1E0-\U0001F1FF"  # flags (iOS)
        u"\U00002702-\U000027B0"
        u"\U000024C2-\U0001F251"
        "]+", flags=re.UNICODE)
    return emoji_pattern.sub(r'', text)

class NotificationService:
    """Централизованный сервис для управления уведомлениями"""

    @staticmethod
    async def send_telegram_message(chat_id: str, text: str) -> bool:
        """Отправка сообщения в Telegram (через прямой HTTP запрос)"""
        try:
            import os
            import aiohttp  # type: ignore[reportMissingImports]
            
            token = os.getenv('TELEGRAM_BOT_TOKEN')
            if not token:
                logger.warning("TELEGRAM_BOT_TOKEN не установлен")
                return False
            
            url = f"https://api.telegram.org/bot{token}/sendMessage"
            payload = {
                'chat_id': chat_id,
                'text': text,
                'parse_mode': 'HTML'
            }
            
            # Используем aiohttp для асинхронного HTTP запроса
            async with aiohttp.ClientSession() as session:
                async with session.post(url, json=payload, timeout=10) as response:
                    if response.status == 200:
                        logger.info(f"[TELEGRAM] Сообщение отправлено пользователю {chat_id}")
                        return True
                    else:
                        error_text = await response.text()
                        logger.error(f"[TELEGRAM] [ERROR] Ошибка {response.status}: {error_text}")
                        return False
                        
        except Exception as e:
            logger.error(f"[TELEGRAM] [ERROR] Ошибка отправки пользователю {chat_id}: {e}")
            return False

    @staticmethod
    def send_push_notification(device_tokens: List[str], title: str, body: str, data: Optional[Dict[str, Any]] = None) -> bool:
        """Отправка push-уведомления через FCM (современный HTTP v1 API)"""

        # Пробуем использовать современный Firebase Admin SDK
        # ✅ Используем только Modern FCM API (Firebase Admin SDK)
        try:
            from admin_panel.services.fcm_modern import send_fcm_push
            
            logger.info(f"[FCM] Отправка FCM уведомления через Firebase Admin SDK...")
            logger.info(f"[FCM] Device tokens: {len(device_tokens)}")
            logger.info(f"[FCM] Title: {remove_emoji(title)}")
            logger.info(f"[FCM] Body: {remove_emoji(body[:100])}...")
            
            success_count, failure_count = send_fcm_push(device_tokens, title, body, data)
            
            logger.info(f"[FCM] Результат: успех={success_count}, неудача={failure_count}")
            
            return success_count > 0
            
        except ImportError as e:
            logger.error(f"[FCM] [ERROR] fcm_modern module not found: {e}")
            logger.error(f"[FCM] [ERROR] Убедитесь что установлен firebase-admin: pip install firebase-admin")
            return False
        except FileNotFoundError as e:
            logger.error(f"[FCM] [ERROR] Firebase service account file not found: {e}")
            logger.error(f"[FCM] [ERROR] Проверьте наличие файла firebase-service-account.json")
            return False
        except Exception as e:
            logger.error(f"[FCM] [ERROR] Ошибка отправки FCM через Firebase Admin SDK: {e}")
            import traceback
            logger.error(f"   Traceback: {traceback.format_exc()}")
            return False

    @staticmethod
    def get_user_device_tokens(user: User, platform: Optional[str] = None) -> List[str]:  # type: ignore[no-any-unimported]
        """Получение активных FCM токенов пользователя"""
        tokens = DeviceToken.objects.filter(
            user=user,
            is_active=True
        )

        if platform:
            tokens = tokens.filter(platform=platform)

        return list(tokens.values_list('token', flat=True))

    @staticmethod
    @sync_to_async
    def async_get_user_device_tokens(user: User, platform: Optional[str] = None) -> List[str]:  # type: ignore[no-any-unimported]
        """Асинхронное получение активных FCM токенов пользователя"""
        return NotificationService.get_user_device_tokens(user, platform)

    @staticmethod
    async def notify_user(user: User, title: str, message: str, notification_type: str = 'general', data: Optional[Dict[str, Any]] = None, telegram_message: Optional[str] = None) -> Dict[str, bool]:  # type: ignore[no-any-unimported]
        """
        Отправка уведомления пользователю всеми доступными способами

        Args:
            user: Пользователь
            title: Заголовок уведомления
            message: Текст для FCM (обычно короткий)
            notification_type: Тип уведомления
            data: Дополнительные данные
            telegram_message: Отдельное сообщение для Telegram (если нужно полное форматирование)
        """
        results = {
            'telegram': False,
            'push': False
        }

        # 1. Отправка в Telegram (с красивым HTML форматированием)
        if user.telegram_id:
            # Используем отдельное сообщение для Telegram если оно есть
            if telegram_message:
                tg_text = telegram_message
            else:
                # Красивое форматирование для Telegram
                from datetime import datetime
                
                tg_text = f"""╔═══════════════════════════════
<b>🔔 BirQadam</b>
╚═══════════════════════════════

<b>{title}</b>

{message}

─────────────────────────────
<i>📅 {datetime.now().strftime('%d.%m.%Y в %H:%M')}</i>
<i>👤 Получатель: {user.name or user.username}</i>"""

            telegram_result = await NotificationService.send_telegram_message(
                user.telegram_id,
                tg_text
            )
            results['telegram'] = telegram_result

        # 2. Отправка push-уведомления (используем async версию)
        device_tokens = await NotificationService.async_get_user_device_tokens(user)
        if device_tokens:
            push_data = {
                'type': notification_type,
                'user_id': user.id,  # type: ignore[attr-defined]
                'timestamp': timezone.now().isoformat()
            }
            if data:
                push_data.update(data)

            push_result = NotificationService.send_push_notification(
                device_tokens,
                title,
                message,
                push_data
            )
            results['push'] = push_result

        # Логируем результаты
        logger.info(f"Уведомление пользователю {user.username} (ID: {user.id if hasattr(user, 'id') else 'unknown'}): Telegram={results['telegram']}, Push={results['push']}")  # type: ignore[attr-defined]

        return results

    @staticmethod
    async def notify_project_approved(user: User, project: Any) -> Dict[str, bool]:  # type: ignore[no-any-unimported]
        """Уведомление об одобрении проекта"""
        title = "Проект одобрен! 🎉"
        message = f"Ваш проект '{project.title}' был одобрен администратором и теперь доступен для волонтёров."
        data = {
            'project_id': project.id,
            'action': 'project_approved'
        }

        return await NotificationService.notify_user(
            user, title, message, 'project_approved', data
        )

    @staticmethod
    async def notify_project_rejected(user: User, project: Any) -> Dict[str, bool]:  # type: ignore[no-any-unimported]
        """Уведомление об отклонении проекта"""
        title = "Проект отклонён ❌"
        message = f"К сожалению, ваш проект '{project.title}' был отклонён. Свяжитесь с администратором для получения дополнительной информации."
        data = {
            'project_id': project.id,
            'action': 'project_rejected'
        }

        return await NotificationService.notify_user(
            user, title, message, 'project_rejected', data
        )

    @staticmethod
    async def notify_task_assigned(user: User, task: Any, project: Any) -> Dict[str, bool]:  # type: ignore[no-any-unimported]
        """Уведомление о новом задании"""
        title = "Новое задание 📋"
        message = f"Вам назначено новое задание в проекте '{project.title}':\n\n{task.text}"
        if task.deadline_date:
            message += f"\n\nСрок выполнения: {task.deadline_date.strftime('%d.%m.%Y')}"
            if task.start_time and task.end_time:
                message += f" {task.start_time.strftime('%H:%M')}-{task.end_time.strftime('%H:%M')}"

        data = {
            'task_id': task.id,
            'project_id': project.id,
            'action': 'task_assigned'
        }

        return await NotificationService.notify_user(
            user, title, message, 'task_assigned', data
        )

    @staticmethod
    async def notify_photo_approved(user: User, photo: Any, project: Any) -> Dict[str, bool]:  # type: ignore[no-any-unimported]
        """Уведомление об одобрении фото"""
        title = "Фото одобрено ✅"
        message = f"Ваше фото для проекта '{project.title}' было одобрено организатором!"
        if photo.rating:
            message += f"\n\nОценка: {photo.rating}/5 ⭐"

        data = {
            'photo_id': photo.id,
            'project_id': project.id,
            'action': 'photo_approved'
        }

        return await NotificationService.notify_user(
            user, title, message, 'photo_approved', data
        )

    @staticmethod
    async def notify_photo_rejected(user: User, photo: Any, project: Any) -> Dict[str, bool]:  # type: ignore[no-any-unimported]
        """Уведомление об отклонении фото"""
        title = "Фото отклонено ❌"
        message = f"Ваше фото для проекта '{project.title}' было отклонено организатором."
        if photo.feedback:
            message += f"\n\nКомментарий: {photo.feedback}"

        data = {
            'photo_id': photo.id,
            'project_id': project.id,
            'action': 'photo_rejected'
        }

        return await NotificationService.notify_user(
            user, title, message, 'photo_rejected', data
        )

    @staticmethod
    async def notify_project_deleted(user: User, project: Any) -> Dict[str, bool]:  # type: ignore[no-any-unimported]
        """Уведомление об удалении проекта"""
        title = "Проект удалён 🗑️"
        message = f"Проект '{project.title}', в котором вы участвовали, был удалён организатором."

        data = {
            'project_id': project.id,
            'action': 'project_deleted'
        }

        return await NotificationService.notify_user(
            user, title, message, 'project_deleted', data
        )

    @staticmethod
    async def notify_organizer_status_changed(user: User, is_approved: bool) -> Dict[str, bool]:  # type: ignore[no-any-unimported]
        """Уведомление об изменении статуса организатора"""
        if is_approved:
            title = "Статус организатора одобрен! 🎉"
            message = "Поздравляем! Ваш запрос на статус организатора был одобрен. Теперь вы можете создавать и управлять проектами."
        else:
            title = "Статус организатора отклонён ❌"
            message = "К сожалению, ваш запрос на статус организатора был отклонён."

        data = {
            'action': 'organizer_status_changed',
            'approved': is_approved
        }

        return await NotificationService.notify_user(
            user, title, message, 'organizer_status', data
        )

# Глобальная функция для удобства использования
async def notify_user(user: User, title: str, message: str, notification_type: str = 'general', data: Optional[Dict[str, Any]] = None) -> Dict[str, bool]:  # type: ignore[no-any-unimported]
    """Глобальная функция для отправки уведомлений"""
    return await NotificationService.notify_user(user, title, message, notification_type, data)


# ==================== МАССОВЫЕ РАССЫЛКИ ====================

class BulkNotificationService:
    """Сервис для массовых рассылок Email/Push"""
    
    @staticmethod
    async def send_bulk_notification(notification_id: int) -> Dict[str, Any]:
        """Отправка массовой рассылки"""
        from api.models import BulkNotification, NotificationRecipient
        
        try:
            logger.info(f"[BULK] Начало обработки рассылки ID={notification_id}")
            
            # Получаем рассылку
            notification = await sync_to_async(BulkNotification.objects.get)(id=notification_id)
            logger.info(f"[BULK] Рассылка получена: {notification.subject}")
            
            # Обновляем статус
            notification.status = 'sending'
            await sync_to_async(notification.save)()
            logger.info(f"[BULK] Начата отправка рассылки: {notification.subject}")
            
            # Получаем отфильтрованных получателей
            logger.info(f"[BULK] Получение списка получателей...")
            recipients = await sync_to_async(lambda: list(notification.get_filtered_recipients()))()
            notification.total_recipients = len(recipients)
            await sync_to_async(notification.save)()
            
            logger.info(f"[BULK] Найдено получателей: {len(recipients)}")
            
            # Создаем записи получателей
            recipient_objects = []
            for user in recipients:
                recipient_objects.append(
                    NotificationRecipient(
                        notification=notification,
                        user=user,
                        status='pending'
                    )
                )
            
            # Создаем записи в БД
            created_recipients = await sync_to_async(NotificationRecipient.objects.bulk_create)(
                recipient_objects, 
                ignore_conflicts=True
            )
            
            # Получаем созданные объекты с primary keys из БД
            recipient_ids = [r.id for r in created_recipients if hasattr(r, 'id') and r.id]  # type: ignore[attr-defined]
            if recipient_ids:
                recipient_objects = await sync_to_async(
                    lambda: list(NotificationRecipient.objects.filter(id__in=recipient_ids).select_related('user'))
                )()
            else:
                # Fallback: получаем по notification
                recipient_objects = await sync_to_async(
                    lambda: list(NotificationRecipient.objects.filter(notification=notification).select_related('user'))
                )()
            
            logger.info(f"[BULK] Создано {len(recipient_objects)} записей получателей")
            
            # Отправляем уведомления
            success_count = 0
            failed_count = 0
            
            logger.info(f"[BULK] Начинаем отправку {len(recipient_objects)} уведомлений...")
            
            for i, recipient_obj in enumerate(recipient_objects):
                try:
                    user = recipient_obj.user
                    logger.info(f"[BULK] Отправка {i+1}/{len(recipient_objects)} пользователю {user.username}")
                    
                    # Подставляем переменные в сообщение
                    subject = BulkNotificationService.replace_variables(notification.subject, user)
                    message = BulkNotificationService.replace_variables(notification.message, user)
                    
                    # Отправляем в зависимости от типа
                    if notification.notification_type in ['push', 'both']:
                        # Push уведомление с ПОЛНЫМ текстом (BigTextStyle для Android, правильная настройка для iOS)
                        logger.info(f"[BULK] Отправка Push уведомления...")
                        
                        # Красивое форматирование для Push
                        push_title = f"📢 {subject}"
                        push_body = f"{message}\n\n— BirQadam"
                        
                        await NotificationService.notify_user(
                            user, 
                            push_title, 
                            push_body, 
                            'bulk_notification',
                            {'notification_id': notification.id}  # type: ignore[attr-defined]
                        )
                    
                    if notification.notification_type in ['email', 'both']:
                        # Email уведомление
                        logger.info(f"[BULK] Отправка Email уведомления...")
                        await BulkNotificationService.send_email(user, subject, message)
                    
                    # Обновляем статус получателя (БЕЗ await - будем обновлять пакетом позже)
                    recipient_obj.status = 'sent'
                    recipient_obj.sent_at = timezone.now()
                    # НЕ сохраняем сразу - это блокирующая операция
                    
                    success_count += 1
                    logger.info(f"[BULK] [OK] Успешно отправлено пользователю {user.username}")
                    
                except Exception as e:
                    logger.error(f"[BULK] [ERROR] Ошибка отправки пользователю {user.username}: {e}")
                    recipient_obj.status = 'failed'
                    recipient_obj.error_message = str(e)[:500]  # Ограничиваем длину
                    failed_count += 1
            
            # Сохраняем все изменения получателей одним запросом
            logger.info(f"[BULK] Сохранение статусов получателей...")
            try:
                await sync_to_async(NotificationRecipient.objects.bulk_update)(
                    recipient_objects,
                    ['status', 'sent_at', 'error_message'],
                    batch_size=100
                )
            except Exception as bulk_error:
                logger.error(f"[BULK] Ошибка bulk_update: {bulk_error}")
            
            # ✅ ИСПРАВЛЕНИЕ: Обновляем статистику рассылки с правильным статусом
            notification.sent_count = success_count
            notification.failed_count = failed_count
            notification.status = 'completed' if failed_count == 0 else 'failed'
            notification.sent_at = timezone.now()
            await sync_to_async(notification.save)()
            
            logger.info(f"[BULK] [DONE] Рассылка завершена: {success_count} успешно, {failed_count} ошибок")
            return {'success': True, 'sent': success_count, 'failed': failed_count}  # type: ignore[return-value]
            
        except Exception as e:
            logger.error(f"[BULK] [CRITICAL] Критическая ошибка при отправке рассылки {notification_id}: {e}")
            import traceback
            logger.error(f"[BULK] Traceback: {traceback.format_exc()}")
            try:
                notification = await sync_to_async(BulkNotification.objects.get)(id=notification_id)
                notification.status = 'failed'
                await sync_to_async(notification.save)()
                logger.info(f"[BULK] Статус рассылки {notification_id} изменён на 'failed'")
            except Exception as save_error:
                logger.error(f"[BULK] Не удалось сохранить статус failed: {save_error}")
            return {'success': False, 'error': str(e)}  # type: ignore[return-value]
    
    @staticmethod
    def replace_variables(text, user):
        """Заменяет переменные в тексте на данные пользователя"""
        replacements = {
            '{{name}}': user.name or user.username,
            '{{username}}': user.username,
            '{{city}}': getattr(user, 'city', 'не указан'),
            '{{rating}}': str(user.rating),
        }
        
        result = text
        for variable, value in replacements.items():
            result = result.replace(variable, value)
        
        return result
    
    @staticmethod
    async def send_email(user, subject, message):
        """Отправка email уведомления с красивым форматированием"""
        from django.core.mail import send_mail
        from django.conf import settings
        from datetime import datetime
        
        try:
            if not user.email:
                logger.warning(f"У пользователя {user.username} нет email")
                return False
            
            # Красивое форматирование для Email
            email_body = f"""
╔═══════════════════════════════════════════════════════╗
   BirQadam - Уведомление
╚═══════════════════════════════════════════════════════╝

Здравствуйте, {user.name or user.username}!

{message}

─────────────────────────────────────────────────────────

📅 Дата отправки: {datetime.now().strftime('%d.%m.%Y в %H:%M')}
📧 Получатель: {user.email}

─────────────────────────────────────────────────────────
С уважением,
Команда BirQadam
🌱 Вместе делаем город чище!
"""
            
            await sync_to_async(send_mail)(
                subject=f"📧 BirQadam - {subject}",
                message=email_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            
            logger.info(f"[EMAIL] Email отправлен пользователю {user.username}")
            return True
            
        except Exception as e:
            logger.error(f"[EMAIL] [ERROR] Ошибка отправки email пользователю {user.username}: {e}")
            return False
"""
Celery tasks для BirQadam project

Асинхронные задачи:
- Массовые рассылки (email, push, telegram)
- Автоочистка FCM токенов
"""
from typing import Any
from celery import shared_task  # type: ignore[reportMissingImports]
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task(name='core.tasks.cleanup_old_device_tokens')
def cleanup_old_device_tokens(days: int = 90) -> str:
    """
    ✅ ИСПРАВЛЕНИЕ: Автоочистка старых FCM токенов
    Удаляет device tokens которые не использовались более N дней
    """
    from core.models import DeviceToken
    
    threshold = timezone.now() - timedelta(days=days)
    old_tokens = DeviceToken.objects.filter(last_used_at__lt=threshold)
    count = old_tokens.count()
    
    if count > 0:
        deleted_count, _ = old_tokens.delete()
        logger.info(f'✅ Celery: Удалено {deleted_count} старых FCM токенов (>{days} дней)')
        return f'Deleted {deleted_count} tokens'
    else:
        logger.info(f'✅ Celery: Старых FCM токенов не найдено')
        return 'No old tokens found'


@shared_task(name='core.tasks.send_bulk_notification_task')
def send_bulk_notification_task(notification_id: int) -> str:
    """
    ✅ ИСПРАВЛЕНИЕ: Асинхронная массовая рассылка
    Выполняется в фоновом режиме через Celery
    """
    from custom_admin.services.notification_service import BulkNotificationService  # ✅ Правильный класс
    from core.models import BulkNotification
    import asyncio
    
    try:
        notification = BulkNotification.objects.get(id=notification_id)
        notification.status = 'in_progress'
        notification.save()
        
        logger.info(f'[CELERY] Начало рассылки #{notification_id}')
        
        # Запускаем асинхронную функцию
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(
            BulkNotificationService.send_bulk_notification(notification_id)  # ✅ Передаём ID, а не объект
        )
        loop.close()
        
        # ✅ ИСПРАВЛЕНИЕ: Обновляем из БД и НЕ перезаписываем статус, который был установлен в send_bulk_notification
        notification.refresh_from_db()
        
        # Проверяем, что send_bulk_notification установил статус (sent или failed)
        # Если статус still 'in_progress', значит что-то пошло не так - меняем на 'completed'
        if notification.status == 'in_progress':
            notification.status = 'completed'
            notification.save()
        
        logger.info(f'[CELERY] Рассылка #{notification_id} завершена: отправлено={notification.sent_count}, ошибок={notification.failed_count}')
        return f'Notification {notification_id} sent: {notification.sent_count} success, {notification.failed_count} failed'
        
    except Exception as e:
        logger.error(f'[CELERY] [ERROR] Ошибка при рассылке #{notification_id}: {e}')
        if 'notification' in locals():
            notification.refresh_from_db()
            notification.status = 'failed'
            notification.save()
        raise



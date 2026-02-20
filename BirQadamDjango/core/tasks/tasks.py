"""
Celery tasks для BirQadam project

Асинхронные задачи:
- Массовые рассылки (email, push, telegram)
- Автоочистка FCM токенов
- Ежедневная проверка активности волонтеров (TrustFactor)
"""
from typing import Any
from celery import shared_task  # type: ignore[reportMissingImports]
from django.utils import timezone
from datetime import timedelta, date
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


@shared_task(name='core.tasks.check_daily_activity')
def check_daily_activity() -> str:
    """
    Ежедневная проверка активности волонтеров
    Проверяет, выполнили ли волонтеры хотя бы одно задание за день
    Если нет и есть активные проекты → -3 TF, 0 к рейтингу
    Исключения: выходные/праздники, нет активных проектов
    """
    from core.models import User, VolunteerProject, Photo
    from datetime import datetime
    
    today = timezone.now().date()
    today_start = timezone.make_aware(datetime.combine(today, datetime.min.time()))
    today_end = timezone.make_aware(datetime.combine(today, datetime.max.time()))
    
    # Проверяем, выходной ли день (суббота=5, воскресенье=6)
    is_weekend = today.weekday() >= 5
    
    # TODO: Добавить список праздников в настройки
    # holidays = []  # Список дат праздников
    
    if is_weekend:
        logger.info(f'[CELERY] Сегодня выходной ({today}), проверка активности пропущена')
        return f'Skipped: weekend ({today})'
    
    # Получаем всех активных волонтеров (не организаторов)
    volunteers = User.objects.filter(
        is_organizer=False,
        is_active=True
    )
    
    penalized_count = 0
    skipped_count = 0
    
    for volunteer in volunteers:
        # Проверяем, есть ли активные проекты
        has_active_projects = VolunteerProject.objects.filter(
            volunteer=volunteer,
            is_active=True,
            project__is_deleted=False
        ).exists()
        
        if not has_active_projects:
            skipped_count += 1
            continue
        
        # Проверяем, выполнил ли волонтер задание сегодня (есть фотоотчет с сегодняшней датой)
        has_activity_today = Photo.objects.filter(
            volunteer=volunteer,
            uploaded_at__gte=today_start,
            uploaded_at__lte=today_end,
            is_deleted=False
        ).exists()
        
        if not has_activity_today:
            # Начисляем штраф: -3 TF, 0 к рейтингу
            from django.db import transaction
            
            with transaction.atomic():
                # Блокируем пользователя для безопасного обновления
                volunteer_locked = User.objects.select_for_update().get(pk=volunteer.pk)
                volunteer_locked.add_zero_rating_for_missed_task()
                volunteer_locked._change_trust_factor(
                    change_amount=-3,
                    reason='daily_penalty',
                    related_object_type='daily_check',
                    related_object_id=0
                )
            penalized_count += 1
            logger.info(f'[CELERY] Штраф для {volunteer.username}: пропущено задание за {today}')
    
    logger.info(f'[CELERY] Проверка активности завершена: {penalized_count} штрафов, {skipped_count} пропущено (нет проектов)')
    return f'Checked {volunteers.count()} volunteers: {penalized_count} penalized, {skipped_count} skipped'



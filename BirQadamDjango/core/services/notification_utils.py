"""
Универсальная система уведомлений для всех волонтеров проекта
Отправляет уведомления как через Telegram, так и через FCM (Firebase Cloud Messaging)
"""
import logging
from typing import Any, Dict, List
from asgiref.sync import sync_to_async
from custom_admin.services.notification_service import NotificationService

logger = logging.getLogger(__name__)


@sync_to_async
def get_project_volunteers(project: Any) -> List[Any]:  # type: ignore[no-any-unimported]
    """Получить всех активных волонтеров проекта (из VolunteerProject)"""
    from core.models import VolunteerProject, User

    # ✅ Фильтруем только активных участников проекта
    volunteer_projects = VolunteerProject.objects.filter(
        project=project,
        is_active=True  # Только активные участники проекта
    ).select_related('volunteer')

    volunteers = [vp.volunteer for vp in volunteer_projects if vp.volunteer and vp.volunteer.is_active]
    logger.info(f"Found {len(volunteers)} active volunteers for project {project.title} (ID: {project.id})")
    return volunteers


async def notify_all_project_volunteers(project: Any, task: Any) -> Dict[str, int]:  # type: ignore[no-any-unimported]
    """
    Универсальная функция для отправки уведомлений о новой задаче
    ВСЕМ волонтерам проекта, независимо от того откуда создана задача (Flutter или Telegram)

    Args:
        project: Объект проекта
        task: Объект задачи

    Returns:
        dict: Статистика отправки {
            'total': общее количество волонтеров,
            'telegram_success': успешные отправки в Telegram,
            'push_success': успешные push-уведомления,
            'failed': неудачные отправки
        }
    """
    logger.info(f"[NOTIF] Starting universal notification for task {task.id} in project {project.title}")

    # Получаем всех волонтеров проекта
    volunteers = await get_project_volunteers(project)

    if not volunteers:
        logger.warning(f"No volunteers found for project {project.title} (ID: {project.id})")
        return {
            'total': 0,
            'telegram_success': 0,
            'push_success': 0,
            'failed': 0
        }

    stats = {
        'total': len(volunteers),
        'telegram_success': 0,
        'push_success': 0,
        'failed': 0
    }

    # Формируем красивое сообщение для волонтеров
    title = "🎯 Новое задание!"

    # Для Telegram и FCM разные форматы
    # FCM (короткое для push-уведомления)
    fcm_message = f"Проект: {project.title}\n{task.text[:80]}{'...' if len(task.text) > 80 else ''}"

    # Telegram (полное сообщение с emoji)
    telegram_message = (
        f"📋 <b>Новое задание в проекте</b>\n"
        f"🏷 <b>{project.title}</b>\n\n"
        f"📝 <b>Задание:</b>\n{task.text}\n"
    )

    if task.deadline_date:
        # ✅ ИСПРАВЛЕНИЕ: Конвертируем строку в datetime если нужно
        from django.utils.dateparse import parse_date
        from datetime import datetime
        
        if isinstance(task.deadline_date, str):
            deadline = parse_date(task.deadline_date)
        else:
            deadline = task.deadline_date
        
        if deadline:
            deadline_str = deadline.strftime('%d.%m.%Y')
            telegram_message += f"\n⏰ <b>Срок:</b> {deadline_str}"
            fcm_message += f"\n⏰ Срок: {deadline_str}"

            if task.start_time and task.end_time:
                # Конвертируем время если нужно
                from django.utils.dateparse import parse_time
                
                if isinstance(task.start_time, str):
                    start_time = parse_time(task.start_time)
                else:
                    start_time = task.start_time
                
                if isinstance(task.end_time, str):
                    end_time = parse_time(task.end_time)
                else:
                    end_time = task.end_time
                
                if start_time and end_time:
                    time_str = f"{start_time.strftime('%H:%M')}-{end_time.strftime('%H:%M')}"
                    telegram_message += f" ({time_str})"
                    fcm_message += f" {time_str}"

    # ✅ ИСПРАВЛЕНИЕ: Не добавляем сразу инструкцию - будет добавлено индивидуально для каждого волонтёра

    data = {
        'task_id': task.id,
        'project_id': project.id,
        'project_title': project.title,
        'task_text': task.text,
        'type': 'task_assigned'
    }

    # Отправляем уведомления каждому волонтеру
    for volunteer in volunteers:
        try:
            # ✅ ИСПРАВЛЕНИЕ: Адаптируем сообщение в зависимости от registration_source
            volunteer_telegram_message = telegram_message
            
            if volunteer.registration_source == 'telegram':
                # Только Telegram - НЕ упоминаем приложение
                volunteer_telegram_message += "\n\n📱 Для выполнения задания напишите /tasks в боте!"
            elif volunteer.registration_source in ['mobile_app', 'both']:
                # Есть мобильное приложение
                volunteer_telegram_message += "\n\n✅ Откройте приложение для выполнения задания!"
            else:
                # Неизвестный источник - нейтральное сообщение
                volunteer_telegram_message += "\n\n✅ Приступайте к выполнению задания!"
            
            # Отправляем с разными сообщениями для Telegram и FCM
            results = await NotificationService.notify_user(
                volunteer,
                title,
                fcm_message,  # Короткое для FCM
                'task_assigned',
                data,
                telegram_message=volunteer_telegram_message  # Адаптированное для Telegram
            )

            # Подсчитываем статистику
            if results.get('telegram'):
                stats['telegram_success'] += 1
            if results.get('push'):
                stats['push_success'] += 1

            # Если хотя бы один канал сработал - считаем успехом
            if results.get('telegram') or results.get('push'):
                logger.info(
                    f"[OK] Notified volunteer {volunteer.username} (ID: {volunteer.id}) - "
                    f"Telegram: {results.get('telegram')}, Push: {results.get('push')}"
                )
            else:
                stats['failed'] += 1
                logger.warning(
                    f"[WARN] Failed to notify volunteer {volunteer.username} (ID: {volunteer.id})"
                )

        except Exception as e:
            stats['failed'] += 1
            logger.error(
                f"[ERROR] Error notifying volunteer {volunteer.username} (ID: {volunteer.id}): {e}",
                exc_info=True
            )

    logger.info(
        f"[NOTIFY] Notification completed for task {task.id}: "
        f"Total={stats['total']}, Telegram={stats['telegram_success']}, "
        f"Push={stats['push_success']}, Failed={stats['failed']}"
    )

    return stats


async def notify_organizer_new_photo(organizer: Any, photo_report: Any, volunteer: Any, project: Any, task: Any) -> Dict[str, bool]:  # type: ignore[no-any-unimported]
    """
    Уведомление организатора о новом фотоотчете от волонтера

    Args:
        organizer: Объект организатора (User)
        photo_report: Объект фотоотчета
        volunteer: Объект волонтера (User)
        project: Объект проекта
        task: Объект задачи

    Returns:
        dict: Результаты отправки {'telegram': bool, 'push': bool}
    """
    logger.info(f"[PHOTO] Sending photo report notification to organizer {organizer.username}")

    # Формируем красивое уведомление для организатора
    title = "📸 Новый фотоотчет!"

    # FCM (короткое сообщение)
    fcm_message = f"Волонтер {volunteer.username} загрузил фото\nПроект: {project.title}"
    if task:
        fcm_message += f"\nЗадание: {task.text[:50]}{'...' if len(task.text) > 50 else ''}"

    # Telegram (полное сообщение с emoji)
    telegram_message = (
        f"📸 <b>Новый фотоотчет!</b>\n\n"
        f"👤 <b>Волонтер:</b> {volunteer.username}\n"
        f"🏷 <b>Проект:</b> {project.title}\n"
    )

    if task:
        telegram_message += f"📝 <b>Задание:</b> {task.text}\n"

    if photo_report.volunteer_comment or photo_report.feedback:
        comment = photo_report.volunteer_comment or photo_report.feedback
        telegram_message += f"\n💬 <b>Комментарий:</b>\n{comment}\n"

    # ✅ ИСПРАВЛЕНИЕ: Адаптируем сообщение в зависимости от registration_source организатора
    if organizer.registration_source == 'telegram':
        # Только Telegram - инструкция для бота
        telegram_message += "\n📋 Используйте команду /photos для проверки фотоотчетов!"
    elif organizer.registration_source in ['mobile_app', 'both']:
        # Есть мобильное приложение
        telegram_message += "\n✅ Проверьте фотоотчет в приложении!"
    else:
        # Неизвестный источник - нейтральное сообщение
        telegram_message += "\n✅ Фотоотчет получен и ожидает проверки!"

    data = {
        'photo_id': photo_report.id,
        'project_id': project.id,
        'volunteer_id': volunteer.id,
        'project_title': project.title,
        'volunteer_name': volunteer.username,
        'type': 'photo_report_submitted'
    }

    try:
        results = await NotificationService.notify_user(
            organizer,
            title,
            fcm_message,
            'photo_report_submitted',
            data,
            telegram_message=telegram_message
        )

        logger.info(
            f"[OK] Notified organizer {organizer.username} about photo from {volunteer.username} - "
            f"Telegram: {results.get('telegram')}, Push: {results.get('push')}"
        )

        return results

    except Exception as e:
        logger.error(
            f"[ERROR] Error notifying organizer {organizer.username} about photo report: {e}",
            exc_info=True
        )
        return {'telegram': False, 'push': False}

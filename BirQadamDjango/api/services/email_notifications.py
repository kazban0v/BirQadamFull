"""
Сервис для отправки email уведомлений организаторам и волонтерам
"""
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from datetime import datetime
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def send_email_notification(
    user,
    subject: str,
    message: str,
    fail_silently: bool = True
) -> bool:
    """
    Отправляет email уведомление пользователю
    
    Args:
        user: Объект User
        subject: Тема письма
        message: Текст сообщения
        fail_silently: Если True, не выбрасывает исключения при ошибках
    
    Returns:
        bool: True если отправлено успешно, False в противном случае
    """
    if not user or not user.email:
        logger.warning(f"У пользователя {user.username if user else 'None'} нет email для отправки уведомления")
        return False
    
    try:
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
        
        send_mail(
            subject=f"📧 BirQadam - {subject}",
            message=email_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=fail_silently,
        )
        
        logger.info(f"[EMAIL] Email отправлен пользователю {user.username} ({user.email})")
        return True
        
    except Exception as e:
        logger.error(f"[EMAIL] Ошибка отправки email пользователю {user.username}: {e}")
        if not fail_silently:
            raise
        return False


def notify_organizer_new_volunteer_application(organizer, volunteer, project):
    """
    Уведомление организатора о новой заявке волонтера на участие в проекте
    """
    if not organizer.email:
        return False
    
    subject = "Новая заявка волонтёра"
    message = f"""
Новый волонтёр хочет присоединиться к вашему проекту!

👤 Волонтёр: {volunteer.name or volunteer.username}
📋 Проект: "{project.title}"
📍 Город: {project.city}

Вы можете просмотреть заявку и принять решение в личном кабинете организатора.

Ссылка: https://birqadam.almau.edu.kz/organizer/projects
"""
    
    return send_email_notification(organizer, subject, message)


def notify_volunteer_new_task(volunteer, task, project):
    """
    Уведомление волонтера о новой задаче в проекте
    """
    if not volunteer.email:
        return False
    
    deadline_text = ""
    if task.deadline_date:
        deadline_text = f"\n⏰ Дедлайн: {task.deadline_date.strftime('%d.%m.%Y')}"
        if task.end_time:
            deadline_text += f" до {task.end_time.strftime('%H:%M')}"
    
    subject = "Новая задача в проекте"
    message = f"""
Вам назначена новая задача!

📋 Проект: "{project.title}"
📝 Задача: {task.text[:100]}{'...' if len(task.text) > 100 else ''}{deadline_text}

Вы можете просмотреть детали задачи и приступить к выполнению в личном кабинете.

Ссылка: https://birqadam.almau.edu.kz/volunteer/tasks
"""
    
    return send_email_notification(volunteer, subject, message)


def notify_organizer_new_photo_report(organizer, volunteer, photo, project):
    """
    Уведомление организатора о новом фотоотчете от волонтера
    """
    if not organizer.email:
        return False
    
    task_text = f" по задаче \"{photo.task.text[:50]}...\"" if photo.task else ""
    comment_text = f"\n💬 Комментарий: {photo.volunteer_comment}" if photo.volunteer_comment else ""
    
    subject = "Новый фотоотчёт от волонтёра"
    message = f"""
Волонтёр отправил новый фотоотчёт!

👤 Волонтёр: {volunteer.name or volunteer.username}
📋 Проект: "{project.title}"{task_text}{comment_text}

Фотоотчёт ожидает вашей проверки и одобрения.

Ссылка: https://birqadam.almau.edu.kz/organizer/photo-moderation
"""
    
    return send_email_notification(organizer, subject, message)


def notify_volunteers_project_updated(volunteers, project, changes: Optional[str] = None):
    """
    Уведомление волонтеров об обновлении проекта
    """
    if not volunteers:
        return 0
    
    subject = "Обновление проекта"
    changes_text = f"\n\nИзменения:\n{changes}" if changes else ""
    
    message = f"""
Проект, в котором вы участвуете, был обновлён!

📋 Проект: "{project.title}"
📍 Город: {project.city}{changes_text}

Вы можете просмотреть обновления в личном кабинете.

Ссылка: https://birqadam.almau.edu.kz/volunteer/projects
"""
    
    sent_count = 0
    for volunteer in volunteers:
        if volunteer.email:
            if send_email_notification(volunteer, subject, message):
                sent_count += 1
    
    return sent_count


def notify_organizer_application_status(organizer, status: str, reason: Optional[str] = None):
    """
    Уведомление организатора об изменении статуса заявки (одобрено/отклонено)
    """
    if not organizer.email:
        return False
    
    if status == 'approved':
        subject = "Заявка организатора одобрена"
        message = f"""
Поздравляем! Ваша заявка на регистрацию в качестве организатора одобрена! 🎉

Теперь вы можете:
✅ Создавать проекты
✅ Приглашать волонтёров
✅ Управлять задачами
✅ Модерировать фотоотчёты

Добро пожаловать в BirQadam!

Ссылка: https://birqadam.almau.edu.kz/organizer/dashboard
"""
    elif status == 'rejected':
        subject = "Заявка организатора требует доработки"
        reason_text = f"\n\nПричина: {reason}" if reason else ""
        message = f"""
Ваша заявка на регистрацию в качестве организатора требует доработки.{reason_text}

Пожалуйста, проверьте предоставленную информацию, обновите данные и отправьте заявку повторно.

Если у вас есть вопросы, напишите в поддержку BirQadam.

Ссылка: https://birqadam.almau.edu.kz/organizer/profile
"""
    else:
        return False
    
    return send_email_notification(organizer, subject, message)


def notify_volunteer_photo_approved(volunteer, photo, project, rating: Optional[int] = None, feedback: Optional[str] = None):
    """
    Уведомление волонтера об одобрении фотоотчета
    """
    if not volunteer.email:
        return False
    
    rating_text = f"\n⭐ Оценка: {rating}/5" if rating else ""
    feedback_text = f"\n💬 Комментарий организатора: {feedback}" if feedback else ""
    
    subject = "Фотоотчёт одобрен"
    message = f"""
Ваш фотоотчёт одобрен! 🎉

📋 Проект: "{project.title}"{rating_text}{feedback_text}

Спасибо за вашу активность и вклад в проект!

Ссылка: https://birqadam.almau.edu.kz/volunteer/projects
"""
    
    return send_email_notification(volunteer, subject, message)


def notify_volunteer_photo_rejected(volunteer, photo, project, reason: Optional[str] = None):
    """
    Уведомление волонтера об отклонении фотоотчета
    """
    if not volunteer.email:
        return False
    
    reason_text = f"\n\nПричина: {reason}" if reason else "\n\nПожалуйста, проверьте требования к фотоотчётам и отправьте новый."
    
    subject = "Фотоотчёт требует доработки"
    message = f"""
Ваш фотоотчёт требует доработки.

📋 Проект: "{project.title}"{reason_text}

Вы можете загрузить новый фотоотчёт в личном кабинете.

Ссылка: https://birqadam.almau.edu.kz/volunteer/projects
"""
    
    return send_email_notification(volunteer, subject, message)


from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.conf import settings
from django.utils.html import strip_tags
from core.models import NotificationRecipient
import logging

logger = logging.getLogger(__name__)


def notify_user_about_ticket_update(ticket, action='status_updated'):
    """
    Отправляет уведомление пользователю о обновлении статуса тикета
    
    Args:
        ticket: Объект SupportTicket
        action: Тип действия ('status_updated', 'resolved', 'closed', 'new_response')
    """
    try:
        subject = ''
        template_name = ''
        
        if action == 'status_updated':
            subject = f"Обновление статуса тикета #{ticket.id}"
            template_name = 'notifications/ticket_status_updated.html'
        elif action == 'resolved':
            subject = f"Ваш тикет #{ticket.id} решен"
            template_name = 'notifications/ticket_resolved.html'
        elif action == 'closed':
            subject = f"Ваш тикет #{ticket.id} закрыт"
            template_name = 'notifications/ticket_closed.html'
        elif action == 'new_response':
            subject = f"Новый ответ по тикету #{ticket.id}"
            template_name = 'notifications/ticket_new_response.html'
        else:
            subject = f"Обновление по тикету #{ticket.id}"
            template_name = 'notifications/ticket_updated.html'
        
        context = {
            'ticket': ticket,
            'user': ticket.user,
            'site_name': getattr(settings, 'SITE_NAME', 'BirQadam'),
        }
        
        html_message = render_to_string(template_name, context)
        plain_message = strip_tags(html_message)
        
        # Отправляем email
        if ticket.user.email:
            send_mail(
                subject=subject,
                message=plain_message,
                html_message=html_message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[ticket.user.email],
                fail_silently=False,
            )
            logger.info(f"Email уведомление отправлено пользователю {ticket.user.email} о тикете #{ticket.id}")
        
        # Отправляем уведомление в Telegram, если пользователь подключен
        send_telegram_notification(ticket, action)
        
        # Отправляем push-уведомление, если доступно
        send_push_notification(ticket, action)
        
    except Exception as e:
        logger.error(f"Ошибка при отправке уведомления о тикете #{ticket.id}: {str(e)}")


def send_telegram_notification(ticket, action):
    """
    Отправляет уведомление в Telegram
    """
    try:
        from core.services.telegram_sync import send_telegram_message
        
        if hasattr(ticket.user, 'telegramuser') and ticket.user.telegramuser.telegram_id:
            telegram_id = ticket.user.telegramuser.telegram_id
            
            status_messages = {
                'status_updated': f"Статус вашего тикета #{ticket.id} обновлен на '{ticket.get_status_display()}'.",
                'resolved': f"Ваш тикет #{ticket.id} был решен. Спасибо за обращение!",
                'closed': f"Ваш тикет #{ticket.id} был закрыт.",
                'new_response': f"Получен новый ответ по вашему тикету #{ticket.id}."
            }
            
            message = status_messages.get(action, f"Обновление по тикету #{ticket.id}: {ticket.get_status_display()}")
            
            if ticket.admin_response:
                message += f"\n\nОтвет администратора: {ticket.admin_response}"
            
            send_telegram_message(telegram_id, message)
            logger.info(f"Telegram уведомление отправлено пользователю {telegram_id} о тикете #{ticket.id}")
    except Exception as e:
        logger.error(f"Ошибка при отправке Telegram уведомления о тикете #{ticket.id}: {str(e)}")


def send_push_notification(ticket, action):
    """
    Отправляет push-уведомление через Firebase
    """
    try:
        from core.services.fcm_modern import send_push_notification_to_user
        
        # Отправляем push-уведомление пользователю
        title = f"Обновление тикета #{ticket.id}"
        
        status_messages = {
            'status_updated': f"Статус обновлен: {ticket.get_status_display()}",
            'resolved': "Ваш тикет был решен",
            'closed': "Ваш тикет был закрыт",
            'new_response': "Новый ответ по вашему тикету"
        }
        
        body = status_messages.get(action, f"Обновление по тикету #{ticket.id}")
        
        if ticket.admin_response:
            body += f"\n{ticket.admin_response}"
        
        send_push_notification_to_user(ticket.user, title, body)
        logger.info(f"Push уведомление отправлено пользователю {ticket.user.id} о тикете #{ticket.id}")
    except Exception as e:
        logger.error(f"Ошибка при отправке push уведомления о тикете #{ticket.id}: {str(e)}")


def create_ticket_signal_handler(sender, instance, created, **kwargs):
    """
    Сигнал для отправки уведомления при создании или обновлении тикета
    """
    if created:
        # При создании тикета отправляем подтверждение пользователю
        notify_user_about_ticket_update(instance, 'status_updated')
    elif instance.status != instance._state.fields_cache.get('status'):
        # При изменении статуса отправляем соответствующее уведомление
        status_actions = {
            'resolved': 'resolved',
            'closed': 'closed'
        }
        action = status_actions.get(instance.status, 'status_updated')
        notify_user_about_ticket_update(instance, action)
    elif instance.admin_response and instance.admin_response != instance._state.fields_cache.get('admin_response', ''):
        # При добавлении ответа администратора
        notify_user_about_ticket_update(instance, 'new_response')
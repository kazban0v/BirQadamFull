"""
Email notifications service
Сервис для отправки email уведомлений
"""
from .service import (
    send_email_notification,
    notify_organizer_new_volunteer_application,
    notify_volunteer_new_task,
    notify_organizer_new_photo_report,
    notify_volunteers_project_updated,
    notify_organizer_application_status,
    notify_volunteer_photo_approved,
    notify_volunteer_photo_rejected,
)

__all__ = [
    'send_email_notification',
    'notify_organizer_new_volunteer_application',
    'notify_volunteer_new_task',
    'notify_organizer_new_photo_report',
    'notify_volunteers_project_updated',
    'notify_organizer_application_status',
    'notify_volunteer_photo_approved',
    'notify_volunteer_photo_rejected',
]


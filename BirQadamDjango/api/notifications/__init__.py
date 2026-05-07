"""
Notifications domain module
Содержит модели и логику, связанную с уведомлениями
"""
from .models import (
    BulkNotification, 
    NotificationRecipient, 
    DeviceToken, 
    NotificationTemplate
)

__all__ = [
    'BulkNotification',
    'NotificationRecipient',
    'DeviceToken',
    'NotificationTemplate',
]


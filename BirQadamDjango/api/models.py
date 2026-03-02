"""
API models - обратная совместимость
Этот файл импортирует все модели из доменных модулей для обратной совместимости.
В будущем рекомендуется использовать прямые импорты из доменов:
    from api.users.models import User
    from api.projects.models import Project
    и т.д.
"""
# Users domain
from api.users.models import (
        User, 
    OrganizerApplication,
    TrustFactorHistory,
    VerificationCode,
    TelegramLinkCode,
    EmailVerificationCode,
    Activity,
)

# Projects domain
from api.projects.models import (
        Project, 
    VolunteerProject,
        Event, 
)

# Tasks domain
from api.tasks.models import (
    Task,
    TaskAssignment,
    Photo,
)

# Notifications domain
from api.notifications.models import (
    DeviceToken,
    NotificationTemplate,
    BulkNotification,
    NotificationRecipient,
)

# Chat domain
from api.chat.models import (
        Chat, 
        Message,
    ChatMember,
    PinnedMessage,
    TypingStatus,
)

# Achievements domain
from api.achievements.models import (
    Achievement,
    UserAchievement,
)

# Support domain
from api.support.models import (
    SupportTicket,
    FeedbackSession,
    FeedbackMessage,
    UserSearchFilter,
    GeofenceReminder,
)

# Экспорт всех моделей для обратной совместимости
__all__ = [
    # Users
    'User',
    'OrganizerApplication',
    'TrustFactorHistory',
    'VerificationCode',
    'TelegramLinkCode',
    'EmailVerificationCode',
    'Activity',
    # Projects
    'Project',
    'VolunteerProject',
    'Event',
    # Tasks
    'Task',
    'TaskAssignment',
    'Photo',
    # Notifications
    'DeviceToken',
    'NotificationTemplate',
    'BulkNotification',
    'NotificationRecipient',
    # Chat
    'Chat',
    'Message',
    'ChatMember',
    'PinnedMessage',
    'TypingStatus',
    # Achievements
    'Achievement',
    'UserAchievement',
    # Support
    'SupportTicket',
    'FeedbackSession',
    'FeedbackMessage',
    'UserSearchFilter',
    'GeofenceReminder',
]

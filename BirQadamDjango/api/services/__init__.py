"""
API services - обратная совместимость
Этот файл импортирует все сервисы из доменных модулей для обратной совместимости.
В будущем рекомендуется использовать прямые импорты из доменов:
    from api.users.services.registration import register_volunteer
    from api.projects.services.catalog import get_projects_catalog
    и т.д.
"""
# Users domain services
from api.users.services.registration import (
    RegistrationError,
    register_volunteer,
    register_organizer,
)

# Projects domain services
from api.projects.services.catalog import (
    get_projects_catalog,
)

# Support domain services
from api.support.services.notifications import (
    notify_user_about_ticket_update,
    create_ticket_signal_handler,
)

# Экспорт для обратной совместимости
__all__ = [
    # Registration
    'RegistrationError',
    'register_volunteer',
    'register_organizer',
    # Projects
    'get_projects_catalog',
    # Support
    'notify_user_about_ticket_update',
    'create_ticket_signal_handler',
]

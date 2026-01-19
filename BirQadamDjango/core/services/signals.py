# core/signals.py
from typing import Any
from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver
from core.models import User, VolunteerProject, Event, GeofenceReminder, Project, Chat
from bot.organization_handlers import notify_organizer_status
from asgiref.sync import async_to_sync
import logging

logger = logging.getLogger(__name__)

@receiver(post_save, sender=User)
def user_saved(sender: Any, instance: User, **kwargs: Any) -> None:  # type: ignore[no-any-unimported]
    if kwargs.get('created', False):
        logger.info(f"New user created: {instance.username}, skipping notification")
        return  # Не отправляем уведомления при создании пользователя
    # Проверяем, изменилось ли поле is_organizer
    if hasattr(instance, 'tracker') and hasattr(instance.tracker, 'has_changed') and instance.tracker.has_changed('is_organizer'):  # type: ignore[attr-defined]
        logger.info(f"is_organizer changed for user {instance.username} to {instance.is_organizer}")
        async_to_sync(notify_organizer_status)(instance)
    else:
        logger.info(f"No change in is_organizer for user {instance.username}, skipping notification")


@receiver(post_save, sender=Project)
def create_chat_for_project(sender: Any, instance: Project, created: bool, **kwargs: Any) -> None:  # type: ignore[no-any-unimported]
    """Автоматически создает чат для проекта"""
    if not created:
        return
    
    project = instance
    creator = project.creator
    
    try:
        # Создаем чат для проекта
        chat = Chat.objects.create(
            name=project.title,
            chat_type='project',
            project=project,
            is_active=True,
        )
        
        # Добавляем создателя (организатора) в чат
        chat.participants.add(creator)
        
        logger.info(f"Created chat {chat.id if hasattr(chat, 'id') else 'unknown'} for project {project.title} with creator {creator.username if hasattr(creator, 'username') else 'unknown'}")  # type: ignore[attr-defined]
    except Exception as e:
        logger.error(f"Error creating chat for project {project.id if hasattr(project, 'id') else 'unknown'}: {e}")  # type: ignore[attr-defined]


@receiver(post_save, sender=VolunteerProject)
def create_geofence_for_project(sender: Any, instance: VolunteerProject, created: bool, **kwargs: Any) -> None:  # type: ignore[no-any-unimported]
    """Автоматически создает геонапоминание и добавляет в чат когда волонтер присоединяется к проекту"""
    if not created:
        return
    
    project = instance.project
    volunteer = instance.volunteer
    
    # Добавляем волонтера в чат проекта
    try:
        chat = Chat.objects.filter(project=project, chat_type='project').first()
        if chat:
            chat.participants.add(volunteer)
            logger.info(f"Added volunteer {volunteer.username if hasattr(volunteer, 'username') else 'unknown'} to chat {chat.id if hasattr(chat, 'id') else 'unknown'} for project {project.title}")  # type: ignore[attr-defined]
        else:
            logger.warning(f"No chat found for project {project.id if hasattr(project, 'id') else 'unknown'}")  # type: ignore[attr-defined]
    except Exception as e:
        logger.error(f"Error adding volunteer to chat: {e}")
    
    # Проверяем что у проекта есть координаты
    if not project.latitude or not project.longitude:
        logger.info(f"Project {project.id} has no coordinates, skipping geofence creation")
        return
    
    # Проверяем что напоминание еще не создано
    existing = GeofenceReminder.objects.filter(
        user=volunteer,
        project=project,
    ).exists()
    
    if existing:
        logger.info(f"Geofence reminder already exists for user {volunteer.id} and project {project.id}")
        return
    
    # Создаем напоминание
    try:
        reminder = GeofenceReminder.objects.create(
            user=volunteer,
            project=project,
            title=project.title,
            message=f"Привет! 👋\nВы находитесь рядом с \"{project.title}\". "
                    f"Не забудьте подтвердить своё участие и приступайте к выполнению задания. "
                    f"Спасибо, что помогаете делать мир чище! 💚",
            latitude=project.latitude,
            longitude=project.longitude,
            radius=500,  # 500 метров по умолчанию
            is_active=True,
        )
        logger.info(f"✅ Created geofence reminder {reminder.id if hasattr(reminder, 'id') else 'unknown'} for user {volunteer.username if hasattr(volunteer, 'username') else 'unknown'} and project {project.title}")  # type: ignore[attr-defined]
    except Exception as e:
        logger.error(f"Error creating geofence reminder: {e}")


@receiver(m2m_changed, sender=Event.participants.through)
def create_geofence_for_event(sender, instance, action, pk_set, **kwargs):
    """Автоматически создает геонапоминание когда волонтер присоединяется к событию"""
    if action != 'post_add':
        return
    
    event = instance
    
    # Проверяем что у события есть координаты (из проекта или задачи)
    latitude = None
    longitude = None
    
    if event.project and event.project.latitude and event.project.longitude:
        latitude = event.project.latitude
        longitude = event.project.longitude
    elif event.task and event.task.project and event.task.project.latitude and event.task.project.longitude:
        latitude = event.task.project.latitude
        longitude = event.task.project.longitude
    
    if not latitude or not longitude:
        logger.info(f"Event {event.id} has no coordinates, skipping geofence creation")
        return
    
    # Создаем напоминание для каждого нового участника
    from core.models import User
    for user_id in pk_set:
        try:
            user = User.objects.get(id=user_id)
            
            # Проверяем что напоминание еще не создано
            existing = GeofenceReminder.objects.filter(
                user=user,
                event=event,
            ).exists()
            
            if existing:
                logger.info(f"Geofence reminder already exists for user {user.id if hasattr(user, 'id') else 'unknown'} and event {event.id if hasattr(event, 'id') else 'unknown'}")  # type: ignore[attr-defined]
                continue
            
            # Создаем напоминание
            reminder = GeofenceReminder.objects.create(
                user=user,
                event=event,
                project=event.project,
                title=event.title,
                message=f"Привет! 👋\nВы находитесь рядом с \"{event.title}\". "
                        f"Не забудьте подтвердить своё участие и приступайте к выполнению задания. "
                        f"Спасибо, что помогаете делать мир чище! 💚",
                latitude=latitude,
                longitude=longitude,
                radius=500,  # 500 метров по умолчанию
                is_active=True,
            )
            logger.info(f"✅ Created geofence reminder {reminder.id if hasattr(reminder, 'id') else 'unknown'} for user {user.username if hasattr(user, 'username') else 'unknown'} and event {event.title}")  # type: ignore[attr-defined]
        except Exception as e:
            logger.error(f"Error creating geofence reminder for user {user_id}: {e}")
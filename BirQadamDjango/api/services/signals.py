# core/signals.py
from typing import Any
from django.db.models.signals import post_save, m2m_changed, pre_save
from django.dispatch import receiver
from api.users.models import User
from api.projects.models import VolunteerProject, Event, Project
from api.support.models import GeofenceReminder
from api.chat.models import Chat
from api.support.models import SupportTicket
from api.tasks.models import Task, Photo
from telegram_bot.organization_handlers import notify_organizer_status
from asgiref.sync import async_to_sync
from shared.notifications.email.service import (
    notify_organizer_new_volunteer_application,
    notify_volunteer_new_task,
    notify_organizer_new_photo_report,
    notify_volunteers_project_updated,
    notify_organizer_application_status
)
import logging
# from api.services.ticket_notification_service import notify_user_about_ticket_update  # Временно отключено

logger = logging.getLogger(__name__)

# Хранилище для отслеживания изменений
_user_status_cache = {}
_project_changes_cache = {}

@receiver(pre_save, sender=User)
def user_pre_save(sender: Any, instance: User, **kwargs: Any) -> None:
    """Сохраняем старое значение organizer_status перед сохранением"""
    if instance.pk:
        try:
            old_instance = User.objects.get(pk=instance.pk)
            _user_status_cache[instance.pk] = old_instance.organizer_status
        except User.DoesNotExist:
            pass


@receiver(post_save, sender=User)
def user_saved(sender: Any, instance: User, **kwargs: Any) -> None:  # type: ignore[no-any-unimported]
    if kwargs.get('created', False):
        logger.info(f"New user created: {instance.username}, skipping notification")
        return  # Не отправляем уведомления при создании пользователя
    
    # Проверяем, изменилось ли поле is_organizer
    if hasattr(instance, 'tracker') and hasattr(instance.tracker, 'has_changed') and instance.tracker.has_changed('is_organizer'):  # type: ignore[attr-defined]
        logger.info(f"is_organizer changed for user {instance.username} to {instance.is_organizer}")
        async_to_sync(notify_organizer_status)(instance)
    
    # Проверяем, изменился ли статус организатора (для email уведомлений)
    old_status = _user_status_cache.get(instance.pk)
    if old_status and old_status != instance.organizer_status:
        logger.info(f"Organizer status changed for {instance.username}: {old_status} -> {instance.organizer_status}")
        if instance.organizer_status in ['approved', 'rejected']:
            notify_organizer_application_status(instance, instance.organizer_status)
        _user_status_cache.pop(instance.pk, None)


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


@receiver(pre_save, sender=Project)
def project_pre_save(sender: Any, instance: Project, **kwargs: Any) -> None:
    """Сохраняем изменения проекта перед сохранением"""
    if instance.pk:
        try:
            old_instance = Project.objects.get(pk=instance.pk)
            changes = []
            if old_instance.title != instance.title:
                changes.append(f"Название: {old_instance.title} → {instance.title}")
            if old_instance.description != instance.description:
                changes.append("Описание обновлено")
            if old_instance.status != instance.status:
                changes.append(f"Статус: {old_instance.get_status_display()} → {instance.get_status_display()}")
            if old_instance.start_date != instance.start_date:
                changes.append("Дата начала изменена")
            if old_instance.end_date != instance.end_date:
                changes.append("Дата окончания изменена")
            _project_changes_cache[instance.pk] = "\n".join(changes) if changes else None
        except Project.DoesNotExist:
            pass


@receiver(post_save, sender=Project)
def project_saved(sender: Any, instance: Project, created: bool, **kwargs: Any) -> None:
    """Отправляет email уведомления волонтерам при обновлении проекта"""
    if created:
        return  # Не отправляем при создании
    
    changes = _project_changes_cache.pop(instance.pk, None)
    if changes:
        # Получаем всех активных волонтеров проекта
        from api.projects.models import VolunteerProject
        volunteer_projects = VolunteerProject.objects.filter(
            project=instance,
            is_active=True
        ).select_related('volunteer')
        
        volunteers = [vp.volunteer for vp in volunteer_projects if vp.volunteer.email]
        if volunteers:
            notify_volunteers_project_updated(volunteers, instance, changes)
            logger.info(f"Sent project update emails to {len(volunteers)} volunteers for project {instance.title}")


@receiver(post_save, sender=VolunteerProject)
def create_geofence_for_project(sender: Any, instance: VolunteerProject, created: bool, **kwargs: Any) -> None:  # type: ignore[no-any-unimported]
    """Автоматически создает геонапоминание и добавляет в чат когда волонтер присоединяется к проекту"""
    if not created:
        return
    
    project = instance.project
    volunteer = instance.volunteer
    
    # Отправляем email уведомление организатору о новой заявке
    if project.creator and project.creator.email:
        notify_organizer_new_volunteer_application(project.creator, volunteer, project)
        logger.info(f"Sent email notification to organizer {project.creator.username} about new volunteer {volunteer.username}")
    
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
        logger.info(f"[OK] Created geofence reminder {reminder.id if hasattr(reminder, 'id') else 'unknown'} for user {volunteer.username if hasattr(volunteer, 'username') else 'unknown'} and project {project.title}")  # type: ignore[attr-defined]
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
    from api.users.models import User
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
            logger.info(f"[OK] Created geofence reminder {reminder.id if hasattr(reminder, 'id') else 'unknown'} for user {user.username if hasattr(user, 'username') else 'unknown'} and event {event.title}")  # type: ignore[attr-defined]
        except Exception as e:
            logger.error(f"Error creating geofence reminder for user {user_id}: {e}")


# Временно отключен сигнал для SupportTicket
# @receiver(post_save, sender=SupportTicket)
# def support_ticket_saved(sender, instance, created, **kwargs):
#     """
#     Сигнал для отправки уведомлений при создании или изменении тикета
#     """
#     try:
#         # Временно отключаем автоматические уведомления через сигнал
#         # Уведомления будут отправляться вручную в views
#         pass
        # if created:
        #     # При создании тикета отправляем подтверждение пользователю
        #     notify_user_about_ticket_update(instance, 'status_updated')
        # else:
        #     # При обновлении тикета проверяем, что изменилось
        #     # Для этого сравниваем текущее состояние с предыдущим
        #     # (предполагаем, что у модели есть механизм отслеживания изменений)

        #     # Отправляем уведомление, если изменился статус или добавлен ответ администратора
        #     if hasattr(instance, '_state') and hasattr(instance._state, 'fields_cache'):
        #         previous_state = instance._state.fields_cache
        #         if 'status' in previous_state and previous_state['status'] != instance.status:
        #             # Статус изменился
        #             status_actions = {
        #                 'resolved': 'resolved',
        #                 'closed': 'closed'
        #             }
        #             action = status_actions.get(instance.status, 'status_updated')
        #             notify_user_about_ticket_update(instance, action)

        #         if 'admin_response' in previous_state and previous_state['admin_response'] != instance.admin_response and instance.admin_response:
        #             # Добавлен ответ администратора
        #             notify_user_about_ticket_update(instance, 'new_response')
        #     else:
        #         # Если нет механизма отслеживания изменений, отправляем уведомление при любом обновлении
        #         if not created:
        #             notify_user_about_ticket_update(instance, 'status_updated')
        # except Exception as e:
        #     logger.error(f"Error in support_ticket_saved signal: {e}")


@receiver(post_save, sender=Task)
def task_created(sender: Any, instance: Task, created: bool, **kwargs: Any) -> None:
    """Отправляет email уведомления волонтерам при создании новой задачи"""
    if not created:
        return
    
    project = instance.project
    
    # Получаем всех активных волонтеров проекта
    from api.models import VolunteerProject
    volunteer_projects = VolunteerProject.objects.filter(
        project=project,
        is_active=True
    ).select_related('volunteer')
    
    volunteers = [vp.volunteer for vp in volunteer_projects if vp.volunteer.email]
    sent_count = 0
    for volunteer in volunteers:
        if notify_volunteer_new_task(volunteer, instance, project):
            sent_count += 1
    
    if sent_count > 0:
        logger.info(f"Sent email notifications to {sent_count} volunteers about new task {instance.id} in project {project.title}")


@receiver(post_save, sender=Photo)
def photo_created(sender: Any, instance: Photo, created: bool, **kwargs: Any) -> None:
    """Отправляет email уведомление организатору при загрузке нового фотоотчета"""
    if not created or instance.status != 'pending':
        return
    
    project = instance.project
    volunteer = instance.volunteer
    
    if project.creator and project.creator.email and volunteer:
        notify_organizer_new_photo_report(project.creator, volunteer, instance, project)
        logger.info(f"Sent email notification to organizer {project.creator.username} about new photo from {volunteer.username}")
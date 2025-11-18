# core/admin.py
from typing import Any
from django.contrib import admin
from django.db.models import Count, QuerySet
from django.http import HttpRequest
from .models import (
    User, Project, VolunteerProject, Photo, Task, TaskAssignment,
    FeedbackSession, FeedbackMessage, Achievement, UserAchievement,
    Activity, BulkNotification, NotificationTemplate, NotificationRecipient,
    Event, GeofenceReminder, Chat, Message, ChatMember, PinnedMessage, TypingStatus,
    OrganizerApplication, TelegramLinkCode, EmailVerificationCode,
)
from django.utils import timezone
from django.contrib import messages
from django.core.exceptions import ValidationError
from asgiref.sync import async_to_sync
from bot.organization_handlers import notify_project_status, notify_organizer_status
import logging
import asyncio

logger = logging.getLogger(__name__)

# Безопасная функция для вызова асинхронных уведомлений из Django Admin
def safe_async_call(coro: Any) -> Any:  # type: ignore[no-any-unimported]
    """
    Безопасно выполняет асинхронную функцию в новом event loop
    Решает проблему 'RuntimeError: Event loop is closed'
    """
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        result = loop.run_until_complete(coro)
        loop.close()
        return result
    except Exception as e:
        logger.error(f"Ошибка при выполнении асинхронной функции: {e}")
        return None

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'name', 'email', 'telegram_id', 'phone_number', 'role', 'organization_name', 'rating', 'is_admin', 'is_organizer', 'registration_source', 'date_joined')
    list_filter = ('is_admin', 'is_organizer', 'role', 'registration_source', 'is_active', 'organization_name')
    search_fields = ('username', 'name', 'email', 'telegram_id', 'phone_number', 'organization_name')
    fieldsets = (
        (None, {'fields': ('username', 'password')}),
        ('Personal info', {'fields': ('name', 'email', 'telegram_id', 'phone_number', 'organization_name', 'rating', 'role', 'registration_source')}),
        ('Permissions', {'fields': ('is_admin', 'is_organizer', 'is_approved', 'organizer_status', 'is_active', 'groups', 'user_permissions')}),
        ('Dates', {'fields': ('date_joined', 'last_login')}),
    )
    actions = ['approve_organizer', 'reject_organizer']

    def delete_queryset(self, request, queryset):
        """Переопределяем удаление queryset для мягкого удаления связанных Photo"""
        from core.models import Photo
        for user in queryset:
            # Мягко удаляем все связанные фото перед удалением пользователя
            Photo.objects.filter(volunteer=user, is_deleted=False).update(
                is_deleted=True,
                deleted_at=timezone.now()
            )
        # Вызываем стандартное удаление пользователя
        super().delete_queryset(request, queryset)

    def delete_model(self, request, obj):
        """Переопределяем удаление одной модели для мягкого удаления связанных Photo"""
        from core.models import Photo
        # Мягко удаляем все связанные фото перед удалением пользователя
        Photo.objects.filter(volunteer=obj, is_deleted=False).update(
            is_deleted=True,
            deleted_at=timezone.now()
        )
        # Вызываем стандартное удаление пользователя
        super().delete_model(request, obj)

    def save_model(self, request: HttpRequest, obj: User, form: Any, change: bool) -> None:  # type: ignore[override]
        if obj.is_admin and not obj.password:
            raise ValidationError("Администратор должен иметь пароль.")
        super().save_model(request, obj, form, change)

    def approve_organizer(self, request: HttpRequest, queryset: QuerySet[User]) -> None:  # type: ignore[override]
        updated = 0
        for user in queryset.select_related('organizer_application'):
            # Исправлено: устанавливаем все необходимые поля для организатора
            if not user.is_organizer:
                user.role = 'organizer'
                user.is_approved = True
                user.organizer_status = 'approved'
                # is_organizer будет установлен автоматически через save() метод модели
                user.save()
                updated += 1
                logger.info(f"User {user.username} approved as organizer (role={user.role}, is_approved={user.is_approved}, is_organizer={user.is_organizer})")

                # Обновляем связанную заявку организатора, если она есть
                organizer_application = getattr(user, 'organizer_application', None)
                if organizer_application and organizer_application.status != 'approved':
                    organizer_application.status = 'approved'
                    organizer_application.save(update_fields=['status', 'updated_at'])
                    logger.info(f"Organizer application for {user.username} marked as approved")
                
                # 📨 Отправляем уведомления (Telegram + FCM)
                try:
                    # 1. Telegram уведомление (безопасный вызов)
                    safe_async_call(notify_organizer_status(user))
                    logger.info(f"✅ Telegram уведомление об одобрении организатора {user.username} отправлено")
                except Exception as e:
                    logger.error(f"❌ Ошибка при отправке Telegram уведомления организатору {user.username}: {e}")
                
                try:
                    # 2. FCM уведомление в приложение
                    from custom_admin.services.notification_service import NotificationService
                    async_to_sync(NotificationService.notify_organizer_status_changed)(user, is_approved=True)
                    logger.info(f"✅ FCM уведомление об одобрении организатора {user.username} отправлено")
                except Exception as e:
                    logger.error(f"❌ Ошибка при отправке FCM уведомления организатору {user.username}: {e}")
        
        self.message_user(request, f"Одобрен статус организатора для {updated} пользователей.", messages.SUCCESS)
    approve_organizer.short_description = "Одобрить статус организатора"

    def reject_organizer(self, request: HttpRequest, queryset: QuerySet[User]) -> None:  # type: ignore[override]
        updated = 0
        for user in queryset.select_related('organizer_application'):
            if user.is_organizer or user.role == 'organizer' or user.organization_name:
                # Исправлено: очищаем все поля, связанные с организатором
                user.role = 'volunteer'  # Возвращаем роль волонтера
                user.is_approved = False
                user.organization_name = None
                user.organizer_status = 'rejected'
                # is_organizer будет установлен в False автоматически через save() метод
                user.save()
                updated += 1
                logger.info(f"User {user.username} rejected as organizer (role={user.role}, is_approved={user.is_approved}, is_organizer={user.is_organizer})")

                # Обновляем связанную заявку организатора, если она есть
                organizer_application = getattr(user, 'organizer_application', None)
                if organizer_application and organizer_application.status != 'rejected':
                    organizer_application.status = 'rejected'
                    organizer_application.save(update_fields=['status', 'updated_at'])
                    logger.info(f"Organizer application for {user.username} marked as rejected")
                
                # 📨 Отправляем уведомления (Telegram + FCM)
                try:
                    # 1. Telegram уведомление (безопасный вызов)
                    safe_async_call(notify_organizer_status(user))
                    logger.info(f"✅ Telegram уведомление об отклонении организатора {user.username} отправлено")
                except Exception as e:
                    logger.error(f"❌ Ошибка при отправке Telegram уведомления организатору {user.username}: {e}")
                
                try:
                    # 2. FCM уведомление в приложение
                    from custom_admin.services.notification_service import NotificationService
                    async_to_sync(NotificationService.notify_organizer_status_changed)(user, is_approved=False)
                    logger.info(f"✅ FCM уведомление об отклонении организатора {user.username} отправлено")
                except Exception as e:
                    logger.error(f"❌ Ошибка при отправке FCM уведомления организатору {user.username}: {e}")
        
        self.message_user(request, f"Отклонён статус организатора для {updated} пользователей.", messages.SUCCESS)
    reject_organizer.short_description = "Отклонить статус организатора"


@admin.register(OrganizerApplication)
class OrganizerApplicationAdmin(admin.ModelAdmin):
    list_display = ('organization_name', 'user', 'status', 'city', 'created_at')
    list_filter = ('status', 'city')
    search_fields = ('organization_name', 'user__username', 'user__email', 'user__phone_number')
    readonly_fields = ('created_at', 'updated_at')
    autocomplete_fields = ('user',)
    actions = ['approve_applications', 'reject_applications']

    def _update_application_status(self, request: HttpRequest, queryset: QuerySet[OrganizerApplication], *, status_value: str) -> int:
        updated = 0
        for application in queryset.select_related('user'):
            if application.status == status_value:
                continue

            application.status = status_value
            application.save(update_fields=['status', 'updated_at'])
            updated += 1

            user = application.user
            if status_value == 'approved':
                user.role = 'organizer'
                user.is_approved = True
                user.organizer_status = 'approved'
            else:
                user.role = 'volunteer'
                user.is_approved = False
                user.organizer_status = 'rejected'
            user.save()

            logger.info(
                "Organizer application %s set to %s; user %s role=%s is_approved=%s organizer_status=%s",
                application.id,
                status_value,
                user.username,
                user.role,
                user.is_approved,
                user.organizer_status,
            )

            try:
                safe_async_call(notify_organizer_status(user))
            except Exception as exc:
                logger.error("Failed to send Telegram notification for user %s: %s", user.username, exc)

            try:
                from custom_admin.services.notification_service import NotificationService
                async_to_sync(NotificationService.notify_organizer_status_changed)(
                    user,
                    is_approved=status_value == 'approved',
                )
            except Exception as exc:
                logger.error("Failed to send FCM notification for user %s: %s", user.username, exc)

        return updated

    def approve_applications(self, request: HttpRequest, queryset: QuerySet[OrganizerApplication]) -> None:  # type: ignore[override]
        updated = self._update_application_status(request, queryset, status_value='approved')
        self.message_user(request, f"Одобрено {updated} заявок организаторов.", messages.SUCCESS)
    approve_applications.short_description = "Одобрить выбранные заявки"

    def reject_applications(self, request: HttpRequest, queryset: QuerySet[OrganizerApplication]) -> None:  # type: ignore[override]
        updated = self._update_application_status(request, queryset, status_value='rejected')
        self.message_user(request, f"Отклонено {updated} заявок организаторов.", messages.SUCCESS)
    reject_applications.short_description = "Отклонить выбранные заявки"

@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ('title', 'city', 'status', 'creator', 'volunteer_count', 'latitude', 'longitude')
    list_filter = ('status', 'city')
    search_fields = ('title', 'city', 'creator__username')
    actions = ['approve_projects', 'reject_projects']
    fieldsets = (
        ('Основная информация', {
            'fields': ('title', 'description', 'city', 'creator', 'status', 'tags')
        }),
        ('Координаты', {
            'fields': ('latitude', 'longitude'),
            'classes': ('collapse',)
        }),
        ('Даты', {
            'fields': ('start_date', 'end_date', 'deleted_at'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        old_status = None
        if obj.pk:
            try:
                old_status = Project.objects.get(pk=obj.pk).status
            except Project.DoesNotExist:
                pass

        super().save_model(request, obj, form, change)

        if change and old_status and obj.status != old_status:
            if obj.status == 'approved':
                obj.approve()
            elif obj.status == 'rejected':
                obj.reject()

    def volunteer_count(self, obj):
        return obj.volunteer_projects.count()
    volunteer_count.short_description = "Количество волонтёров"

    def approve_projects(self, request, queryset):
        updated = 0
        for project in queryset:
            logger.info(f"Обработка проекта {project.title} со статусом {project.status}")
            if project.status != 'approved':
                old_status = project.status
                project.status = 'approved'
                project.save()
                updated += 1
                logger.info(f"Проект {project.title} изменен с '{old_status}' на 'approved'")
                logger.info(f"Создатель проекта: {project.creator.username}, telegram_id: {project.creator.telegram_id}")
                
                # 📨 Отправляем уведомления (Telegram + FCM)
                try:
                    # 1. Telegram уведомление (безопасный вызов)
                    safe_async_call(notify_project_status(project.creator, project, 'approved'))
                    logger.info(f"✅ Telegram уведомление об одобрении проекта {project.title} отправлено")
                except Exception as e:
                    logger.error(f"❌ Ошибка при отправке Telegram уведомления об одобрении проекта {project.title}: {e}")
                    import traceback
                    logger.error(f"Трассировка: {traceback.format_exc()}")
                
                try:
                    # 2. FCM уведомление в приложение
                    from custom_admin.services.notification_service import NotificationService
                    async_to_sync(NotificationService.notify_project_approved)(project.creator, project)
                    logger.info(f"✅ FCM уведомление об одобрении проекта {project.title} отправлено")
                except Exception as e:
                    logger.error(f"❌ Ошибка при отправке FCM уведомления об одобрении проекта {project.title}: {e}")
            else:
                logger.info(f"Проект {project.title} уже имеет статус 'approved', пропускаем")
        self.message_user(request, f"Одобрено {updated} проектов.", messages.SUCCESS)
    approve_projects.short_description = "Одобрить выбранные проекты"

    def reject_projects(self, request, queryset):
        updated = 0
        for project in queryset:
            logger.info(f"Обработка проекта {project.title} со статусом {project.status}")
            if project.status != 'rejected':
                old_status = project.status
                project.status = 'rejected'
                project.save()
                updated += 1
                logger.info(f"Проект {project.title} изменен с '{old_status}' на 'rejected'")
                logger.info(f"Создатель проекта: {project.creator.username}, telegram_id: {project.creator.telegram_id}")
                
                # 📨 Отправляем уведомления (Telegram + FCM)
                try:
                    # 1. Telegram уведомление (безопасный вызов)
                    safe_async_call(notify_project_status(project.creator, project, 'rejected'))
                    logger.info(f"✅ Telegram уведомление об отклонении проекта {project.title} отправлено")
                except Exception as e:
                    logger.error(f"❌ Ошибка при отправке Telegram уведомления об отклонении проекта {project.title}: {e}")
                    import traceback
                    logger.error(f"Трассировка: {traceback.format_exc()}")
                
                try:
                    # 2. FCM уведомление в приложение
                    from custom_admin.services.notification_service import NotificationService
                    async_to_sync(NotificationService.notify_project_rejected)(project.creator, project)
                    logger.info(f"✅ FCM уведомление об отклонении проекта {project.title} отправлено")
                except Exception as e:
                    logger.error(f"❌ Ошибка при отправке FCM уведомления об отклонении проекта {project.title}: {e}")
            else:
                logger.info(f"Проект {project.title} уже имеет статус 'rejected', пропускаем")
        self.message_user(request, f"Отклонено {updated} проектов.", messages.SUCCESS)
    reject_projects.short_description = "Отклонить выбранные проекты"

@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = ('volunteer', 'project', 'task', 'status', 'uploaded_at', 'image_preview', 'is_deleted')
    list_filter = ('status', 'uploaded_at', 'is_deleted')
    search_fields = ('volunteer__username', 'project__title', 'task__text')
    actions = ['approve_photos', 'reject_photos', 'soft_delete_photos', 'restore_photos']
    readonly_fields = ('image_preview',)

    def image_preview(self, obj):
        if obj.image and hasattr(obj.image, 'url'):
            return f'<img src="{obj.image.url}" width="100" height="100" />'
        return "No image"
    image_preview.allow_tags = True
    image_preview.short_description = "Превью"

    def approve_photos(self, request, queryset):
        updated = 0
        for photo in queryset:
            # Исправлено: используем метод approve() и проверяем статус
            if photo.status != 'approved':
                # Используем дефолтный рейтинг 3, если не указан
                photo.approve(rating=photo.rating or 3, feedback=photo.feedback)
                updated += 1
            else:
                logger.info(f"Photo {photo.id} already approved, skipping")
        self.message_user(request, f"Одобрено {updated} фото (пропущено: {queryset.count() - updated}).", messages.SUCCESS)
    approve_photos.short_description = "Одобрить выбранные фото"

    def reject_photos(self, request, queryset):
        updated = queryset.update(status='rejected', moderated_at=timezone.now())
        self.message_user(request, f"Отклонено {updated} фото.", messages.SUCCESS)
    reject_photos.short_description = "Отклонить выбранные фото"

    def soft_delete_photos(self, request, queryset):
        """Мягкое удаление фото"""
        count = 0
        for photo in queryset:
            if not photo.is_deleted:
                photo.delete()  # Используем метод delete модели, который делает мягкое удаление
                count += 1
        self.message_user(request, f"Удалено {count} фото (мягкое удаление).", messages.SUCCESS)
    soft_delete_photos.short_description = "Удалить выбранные фото (мягкое удаление)"

    def restore_photos(self, request, queryset):
        """Восстановление удаленных фото"""
        updated = queryset.filter(is_deleted=True).update(is_deleted=False, deleted_at=None)
        self.message_user(request, f"Восстановлено {updated} фото.", messages.SUCCESS)
    restore_photos.short_description = "Восстановить выбранные фото"

    def delete_model(self, request, obj):
        """Переопределяем удаление одной модели для использования мягкого удаления"""
        obj.delete()  # Используем метод delete модели, который делает мягкое удаление
        self.message_user(request, f"Фото '{obj}' удалено (мягкое удаление).", messages.SUCCESS)

    def delete_queryset(self, request, queryset):
        """Переопределяем удаление queryset для использования мягкого удаления"""
        count = 0
        for photo in queryset:
            if not photo.is_deleted:
                photo.delete()  # Используем метод delete модели, который делает мягкое удаление
                count += 1
        self.message_user(request, f"Удалено {count} фото (мягкое удаление).", messages.SUCCESS)

@admin.register(VolunteerProject)
class VolunteerProjectAdmin(admin.ModelAdmin):
    list_display = ('volunteer', 'project', 'is_active', 'joined_at')
    list_filter = ('is_active', 'joined_at')
    search_fields = ('volunteer__username', 'project__title')

@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ('id', 'project', 'creator', 'status', 'created_at', 'deadline_date', 'start_time', 'end_time', 'volunteer_count')
    list_filter = ('status', 'created_at')
    search_fields = ('project__title', 'creator__username', 'text')

    def get_queryset(self, request):
        return super().get_queryset(request).annotate(volunteer_count=Count('assignments'))

    def volunteer_count(self, obj):
        return obj.volunteer_count
    volunteer_count.short_description = 'Количество волонтёров'

@admin.register(TaskAssignment)
class TaskAssignmentAdmin(admin.ModelAdmin):
    list_display = ('task', 'volunteer', 'accepted', 'completed', 'completed_at', 'rating', 'feedback')
    list_filter = ('accepted', 'completed')
    search_fields = ('task__id', 'volunteer__username')

@admin.register(FeedbackSession)
class FeedbackSessionAdmin(admin.ModelAdmin):
    list_display = ('id', 'organizer', 'volunteer', 'project', 'rating', 'created_at', 'is_active', 'is_completed')
    list_filter = ('is_active', 'is_completed', 'rating', 'created_at')
    search_fields = ('organizer__username', 'volunteer__username', 'project__title')
    readonly_fields = ('created_at', 'completed_at')
    fieldsets = (
        ('Основная информация', {
            'fields': ('organizer', 'volunteer', 'project', 'task', 'photo', 'rating')
        }),
        ('Статус', {
            'fields': ('is_active', 'is_completed', 'created_at', 'completed_at')
        }),
    )

@admin.register(FeedbackMessage)
class FeedbackMessageAdmin(admin.ModelAdmin):
    list_display = ('id', 'session', 'sender', 'message_type', 'text_preview', 'timestamp')
    list_filter = ('message_type', 'timestamp', 'is_read')
    search_fields = ('session__id', 'sender__username', 'text')
    readonly_fields = ('timestamp',)

    def text_preview(self, obj):
        return obj.text[:50] + '...' if len(obj.text) > 50 else obj.text
    text_preview.short_description = 'Превью текста'

@admin.register(Achievement)
class AchievementAdmin(admin.ModelAdmin):
    list_display = ('name', 'required_rating', 'xp', 'icon', 'created_at')
    list_filter = ('required_rating', 'created_at')
    search_fields = ('name', 'description')
    ordering = ('required_rating',)
    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'description', 'icon')
        }),
        ('Требования', {
            'fields': ('required_rating', 'xp')
        }),
    )

@admin.register(UserAchievement)
class UserAchievementAdmin(admin.ModelAdmin):
    list_display = ('user', 'achievement', 'unlocked_at')
    list_filter = ('unlocked_at', 'achievement')
    search_fields = ('user__username', 'achievement__name')
    readonly_fields = ('unlocked_at',)
    ordering = ('-unlocked_at',)

@admin.register(Activity)
class ActivityAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'title', 'project', 'created_at')
    list_filter = ('type', 'created_at')
    search_fields = ('user__username', 'title', 'description')
    readonly_fields = ('created_at',)
    ordering = ('-created_at',)


# ==================== МАССОВЫЕ РАССЫЛКИ ====================

@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'template_type', 'subject', 'created_at', 'updated_at')
    list_filter = ('template_type', 'created_at')
    search_fields = ('name', 'subject', 'message')
    readonly_fields = ('created_at', 'updated_at')
    fieldsets = (
        ('Основная информация', {
            'fields': ('name', 'template_type', 'subject')
        }),
        ('Содержание', {
            'fields': ('message',),
            'description': 'Используйте переменные: {{name}}, {{city}}, {{rating}}'
        }),
        ('Метаданные', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


class NotificationRecipientInline(admin.TabularInline):
    model = NotificationRecipient
    extra = 0
    readonly_fields = ('user', 'status', 'sent_at', 'delivered_at', 'error_message')
    can_delete = False
    fields = ('user', 'status', 'sent_at', 'delivered_at', 'error_message')


@admin.register(BulkNotification)
class BulkNotificationAdmin(admin.ModelAdmin):
    list_display = ('subject', 'notification_type', 'status', 'total_recipients', 'sent_count', 'delivered_count', 'created_by', 'created_at', 'progress_bar')
    list_filter = ('notification_type', 'status', 'filter_role', 'created_at')
    search_fields = ('subject', 'message', 'created_by__username')
    readonly_fields = ('created_at', 'updated_at', 'sent_at', 'total_recipients', 'sent_count', 'delivered_count', 'opened_count', 'clicked_count', 'failed_count', 'progress_bar')
    inlines = [NotificationRecipientInline]
    actions = ['send_notifications', 'duplicate_notification']
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('created_by', 'notification_type', 'template', 'status')
        }),
        ('Содержание', {
            'fields': ('subject', 'message')
        }),
        ('Фильтры получателей', {
            'fields': ('filter_role', 'filter_city', 'filter_rating_min', 'filter_rating_max', 'filter_active_days'),
            'classes': ('collapse',)
        }),
        ('Статистика', {
            'fields': ('total_recipients', 'sent_count', 'delivered_count', 'opened_count', 'clicked_count', 'failed_count', 'progress_bar'),
            'classes': ('collapse',)
        }),
        ('Расписание', {
            'fields': ('scheduled_at', 'sent_at'),
            'classes': ('collapse',)
        }),
        ('Метаданные', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def progress_bar(self, obj):
        """Визуализация прогресса отправки"""
        if obj.total_recipients == 0:
            return "—"
        
        progress = int((obj.sent_count / obj.total_recipients) * 100)
        color = 'green' if progress == 100 else 'orange' if progress > 50 else 'red'
        
        return f'''
        <div style="width: 200px; background: #e0e0e0; border-radius: 4px; overflow: hidden;">
            <div style="width: {progress}%; background: {color}; height: 20px; line-height: 20px; text-align: center; color: white; font-size: 11px;">
                {progress}%
            </div>
        </div>
        '''
    progress_bar.allow_tags = True
    progress_bar.short_description = 'Прогресс'
    
    def send_notifications(self, request, queryset):
        """Action для отправки рассылок"""
        from custom_admin.services.notification_service import BulkNotificationService
        
        sent_count = 0
        for notification in queryset:
            if notification.status in ['draft', 'failed']:
                try:
                    # Запускаем отправку в фоновом режиме
                    async_to_sync(BulkNotificationService.send_bulk_notification)(notification.id)
                    sent_count += 1
                    self.message_user(request, f"✅ Рассылка '{notification.subject}' запущена", messages.SUCCESS)
                except Exception as e:
                    self.message_user(request, f"❌ Ошибка при отправке '{notification.subject}': {e}", messages.ERROR)
                    logger.error(f"Error sending bulk notification {notification.id}: {e}")
        
        if sent_count > 0:
            self.message_user(request, f"📨 Запущено {sent_count} рассылок", messages.SUCCESS)
    send_notifications.short_description = "📨 Отправить выбранные рассылки"
    
    def duplicate_notification(self, request, queryset):
        """Action для дублирования рассылки"""
        for notification in queryset:
            notification.pk = None
            notification.id = None
            notification.status = 'draft'
            notification.subject = f"Копия: {notification.subject}"
            notification.total_recipients = 0
            notification.sent_count = 0
            notification.delivered_count = 0
            notification.opened_count = 0
            notification.clicked_count = 0
            notification.failed_count = 0
            notification.sent_at = None
            notification.scheduled_at = None
            notification.save()
            self.message_user(request, f"✅ Создана копия рассылки '{notification.subject}'", messages.SUCCESS)
    duplicate_notification.short_description = "📋 Дублировать рассылку"


@admin.register(NotificationRecipient)
class NotificationRecipientAdmin(admin.ModelAdmin):
    list_display = ('user', 'notification_subject', 'status', 'sent_at', 'delivered_at', 'opened_at')
    list_filter = ('status', 'sent_at', 'delivered_at')
    search_fields = ('user__username', 'notification__subject')
    readonly_fields = ('notification', 'user', 'status', 'sent_at', 'delivered_at', 'opened_at', 'clicked_at', 'error_message', 'created_at')
    
    def notification_subject(self, obj):
        return obj.notification.subject
    notification_subject.short_description = 'Тема рассылки'


# ==================== КАЛЕНДАРЬ ====================

@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ('title', 'event_type', 'start_date', 'start_time', 'creator', 'project', 'visibility', 'participant_count')
    list_filter = ('event_type', 'visibility', 'start_date', 'is_all_day', 'is_deleted')
    search_fields = ('title', 'description', 'creator__username', 'project__title', 'location')
    readonly_fields = ('created_at', 'updated_at', 'reminder_sent')
    filter_horizontal = ('participants',)
    date_hierarchy = 'start_date'
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('title', 'description', 'event_type', 'creator')
        }),
        ('Дата и время', {
            'fields': ('start_date', 'start_time', 'end_date', 'end_time', 'is_all_day')
        }),
        ('Связи', {
            'fields': ('project', 'task', 'participants')
        }),
        ('Настройки', {
            'fields': ('visibility', 'location')
        }),
        ('Напоминания', {
            'fields': ('reminder_minutes', 'reminder_sent'),
            'classes': ('collapse',)
        }),
        ('Служебное', {
            'fields': ('is_deleted', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    def participant_count(self, obj):
        """Количество участников"""
        return obj.participants.count()
    participant_count.short_description = 'Участников'
    
    actions = ['mark_as_deleted', 'restore_events']
    
    def mark_as_deleted(self, request, queryset):
        """Пометить события как удаленные"""
        updated = queryset.update(is_deleted=True)
        self.message_user(request, f"Помечено как удаленные: {updated} событий.", messages.SUCCESS)
    mark_as_deleted.short_description = "🗑️ Пометить как удаленные"
    
    def restore_events(self, request, queryset):
        """Восстановить события"""
        updated = queryset.update(is_deleted=False)
        self.message_user(request, f"Восстановлено: {updated} событий.", messages.SUCCESS)
    restore_events.short_description = "♻️ Восстановить события"


# ==================== ГЕОЛОКАЦИОННЫЕ НАПОМИНАНИЯ ====================

@admin.register(GeofenceReminder)
class GeofenceReminderAdmin(admin.ModelAdmin):
    list_display = ('user', 'get_location_name', 'radius', 'is_active', 'is_triggered', 'created_at')
    list_filter = ('is_active', 'is_triggered', 'radius', 'created_at')
    search_fields = ('user__username', 'title', 'project__title', 'event__title')
    readonly_fields = ('created_at', 'updated_at', 'triggered_at')
    
    fieldsets = (
        ('Основная информация', {
            'fields': ('user', 'title', 'message')
        }),
        ('Связи', {
            'fields': ('project', 'event'),
            'description': 'Выберите проект или событие для привязки напоминания'
        }),
        ('Геолокация', {
            'fields': ('latitude', 'longitude', 'radius'),
            'description': 'Координаты и радиус зоны уведомления'
        }),
        ('Статус', {
            'fields': ('is_active', 'is_triggered', 'triggered_at')
        }),
        ('Служебное', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
    
    actions = ['activate_reminders', 'deactivate_reminders', 'reset_triggered']
    
    def activate_reminders(self, request, queryset):
        """Активировать напоминания"""
        updated = queryset.update(is_active=True)
        self.message_user(request, f"Активировано: {updated} напоминаний.", messages.SUCCESS)
    activate_reminders.short_description = "✅ Активировать"
    
    def deactivate_reminders(self, request, queryset):
        """Деактивировать напоминания"""
        updated = queryset.update(is_active=False)
        self.message_user(request, f"Деактивировано: {updated} напоминаний.", messages.SUCCESS)
    deactivate_reminders.short_description = "❌ Деактивировать"
    
    def reset_triggered(self, request, queryset):
        """Сбросить статус срабатывания"""
        updated = queryset.update(is_triggered=False, triggered_at=None)
        self.message_user(request, f"Сброшен статус: {updated} напоминаний.", messages.SUCCESS)
    reset_triggered.short_description = "🔄 Сбросить срабатывание"


# ==================== CHAT ADMIN ====================

@admin.register(Chat)
class ChatAdmin(admin.ModelAdmin):
    """Админ-панель для чатов"""
    list_display = ('id', 'name', 'chat_type', 'project', 'participant_count', 'is_active', 'created_at')
    list_filter = ('chat_type', 'is_active', 'created_at')
    search_fields = ('name', 'project__title')
    readonly_fields = ('created_at', 'updated_at')
    filter_horizontal = ('participants',)
    
    def participant_count(self, obj):
        return obj.participants.count()
    participant_count.short_description = 'Участников'


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    """Админ-панель для сообщений"""
    list_display = ('id', 'chat', 'sender', 'message_type', 'text_preview', 'is_delivered', 'is_read', 'created_at')
    list_filter = ('message_type', 'is_delivered', 'is_read', 'is_deleted', 'created_at')
    search_fields = ('text', 'sender__username', 'chat__name')
    readonly_fields = ('created_at', 'updated_at', 'delivered_at', 'read_at')
    
    def text_preview(self, obj):
        return obj.text[:50] if obj.text else f"[{obj.get_message_type_display()}]"
    text_preview.short_description = 'Текст'


@admin.register(ChatMember)
class ChatMemberAdmin(admin.ModelAdmin):
    """Админ-панель для участников чата"""
    list_display = ('user', 'chat', 'notifications_enabled', 'joined_at', 'last_read_at')
    list_filter = ('notifications_enabled', 'joined_at')
    search_fields = ('user__username', 'chat__name')
    readonly_fields = ('joined_at',)


@admin.register(PinnedMessage)
class PinnedMessageAdmin(admin.ModelAdmin):
    """Админ-панель для закрепленных сообщений"""
    list_display = ('chat', 'message_preview', 'pinned_by', 'pinned_at')
    list_filter = ('pinned_at',)
    search_fields = ('chat__name', 'message__text', 'pinned_by__username')
    readonly_fields = ('pinned_at',)
    
    def message_preview(self, obj):
        return obj.message.text[:50] if obj.message.text else f"[{obj.message.get_message_type_display()}]"
    message_preview.short_description = 'Сообщение'


@admin.register(TypingStatus)
class TypingStatusAdmin(admin.ModelAdmin):
    """Админ-панель для статусов печати"""
    list_display = ('user', 'chat', 'typing_type', 'started_at', 'is_active_status')
    list_filter = ('typing_type', 'started_at')
    search_fields = ('user__username', 'chat__name')
    readonly_fields = ('started_at',)
    
    def is_active_status(self, obj):
        return obj.is_active()
    is_active_status.short_description = 'Активен'
    is_active_status.boolean = True


@admin.register(TelegramLinkCode)
class TelegramLinkCodeAdmin(admin.ModelAdmin):
    """Админ-панель для кодов привязки Telegram"""
    list_display = ('code', 'user', 'is_used', 'created_at', 'expires_at', 'used_at', 'is_valid_display')
    list_filter = ('is_used', 'created_at', 'expires_at')
    search_fields = ('code', 'user__username', 'user__email')
    readonly_fields = ('created_at',)
    
    def is_valid_display(self, obj):
        """Отображение валидности кода"""
        if obj.is_used:
            return "Использован"
        if obj.is_expired():
            return "Истек"
        return "Действителен"
    is_valid_display.short_description = 'Статус'


@admin.register(EmailVerificationCode)
class EmailVerificationCodeAdmin(admin.ModelAdmin):
    """Админ-панель для кодов подтверждения email"""
    list_display = ('code', 'email', 'user', 'is_used', 'created_at', 'expires_at', 'used_at', 'is_valid_display')
    list_filter = ('is_used', 'created_at', 'expires_at')
    search_fields = ('code', 'email', 'user__username', 'user__email')
    readonly_fields = ('created_at',)
    
    def is_valid_display(self, obj):
        """Отображение валидности кода"""
        if obj.is_used:
            return "Использован"
        if obj.is_expired():
            return "Истек"
        return "Действителен"
    is_valid_display.short_description = 'Статус'
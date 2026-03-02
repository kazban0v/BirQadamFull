from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User as DjangoUser
from django.utils.html import format_html
from django.urls import reverse
from api.models import (
    User, Project, Task, Photo, Activity, VolunteerProject,
    TaskAssignment, FeedbackSession, FeedbackMessage, Achievement,
    UserAchievement, OrganizerApplication, TrustFactorHistory,
    DeviceToken, NotificationTemplate, BulkNotification, NotificationRecipient,
    UserSearchFilter, Event, GeofenceReminder, Chat, Message, ChatMember,
    PinnedMessage, TypingStatus, VerificationCode, TelegramLinkCode, EmailVerificationCode,
    SupportTicket
)

# Отменяем регистрацию стандартной модели User Django, если она была зарегистрирована
try:
    admin.site.unregister(DjangoUser)
except admin.sites.NotRegistered:
    pass

# Настройка заголовков админ-панели
admin.site.site_header = "BirQadam - Администрирование"
admin.site.site_title = "BirQadam Admin"
admin.site.index_title = "Панель управления"


# ============================================================================
# ПОДДЕРЖКА
# ============================================================================

@admin.register(SupportTicket)
class SupportTicketAdmin(admin.ModelAdmin):
    list_display = [
        'id', 
        'user_info', 
        'short_message', 
        'status', 
        'source', 
        'created_at', 
        'admin_actions'
    ]
    
    list_filter = [
        'status', 
        'source', 
        'created_at'
    ]
    
    search_fields = [
        'id', 
        'user__username', 
        'user__email', 
        'user__name',
        'message',
        'admin_response'
    ]
    
    readonly_fields = [
        'id',
        'user', 
        'message', 
        'source', 
        'created_at', 
        'updated_at',
        'resolved_at'
    ]
    
    fieldsets = (
        ('Информация о тикете', {
            'fields': ('id', 'user', 'message', 'source', 'created_at', 'updated_at', 'resolved_at')
        }),
        ('Статус и ответ', {
            'fields': ('status', 'admin_response')
        }),
    )
    
    actions = ['mark_as_in_progress', 'mark_as_resolved', 'mark_as_closed']
    
    def get_queryset(self, request):
        qs = super().get_queryset(request)
        return qs.select_related('user')
    
    def user_info(self, obj):
        if obj.user:
            try:
                user_url = reverse('admin:api_user_change', args=[obj.user.id])
                return format_html('<a href="{}">{}</a> ({})', 
                                 user_url, obj.user.username, obj.user.email)
            except Exception:
                return f"{obj.user.username} ({obj.user.email})"
        return "Анонимный пользователь"
    user_info.short_description = 'Пользователь'
    
    def short_message(self, obj):
        return obj.message[:50] + "..." if len(obj.message) > 50 else obj.message
    short_message.short_description = 'Сообщение'
    
    def admin_actions(self, obj):
        try:
            change_url = reverse('admin:api_supportticket_change', args=[obj.pk])
            return format_html(
                '<a class="button" href="{}">Ответить</a>&nbsp;'
                '<a class="button" href="{}">Изменить</a>',
                change_url,
                change_url
            )
        except Exception:
            return "-"
    admin_actions.short_description = 'Действия'
    
    # Действия для изменения статуса
    def mark_as_in_progress(self, request, queryset):
        updated = queryset.update(status='in_progress')
        self.message_user(request, f'{updated} тикет(ов) переведены в статус "В обработке"')
    
    mark_as_in_progress.short_description = "Отметить как 'В обработке'"
    
    def mark_as_resolved(self, request, queryset):
        from django.utils import timezone
        updated = queryset.filter(status__in=['open', 'in_progress']).update(
            status='resolved',
            resolved_at=timezone.now()
        )
        self.message_user(request, f'{updated} тикет(ов) отмечены как "Решенные"')
    
    mark_as_resolved.short_description = "Отметить как 'Решенные'"
    
    def mark_as_closed(self, request, queryset):
        updated = queryset.update(status='closed')
        self.message_user(request, f'{updated} тикет(ов) закрыты')
    
    mark_as_closed.short_description = "Закрыть тикет(ы)"
    
    # Переопределяем отображение формы
    def get_readonly_fields(self, request, obj=None):
        # Показываем все поля для редактирования, кроме тех, что должны быть только для чтения
        if obj:  # Редактирование существующего объекта
            return self.readonly_fields
        return ()  # При создании нового объекта не делаем поля только для чтения


# ============================================================================
# ПОЛЬЗОВАТЕЛИ
# ============================================================================

# Регистрация кастомной модели User
@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ['id', 'username', 'email', 'name', 'phone_number', 'role', 'is_organizer', 'organizer_status', 'rating', 'trust_factor', 'is_active', 'date_joined']
    list_filter = ['role', 'is_organizer', 'organizer_status', 'is_active', 'is_staff', 'is_superuser', 'date_joined']
    search_fields = ['username', 'email', 'name', 'phone_number', 'telegram_id']
    
    fieldsets = (
        (None, {
            'fields': ('username', 'password')
        }),
        ('Персональная информация', {
            'fields': ('first_name', 'last_name', 'email', 'name', 'phone_number', 'telegram_id', 'avatar')
        }),
        ('Роль и статус', {
            'fields': ('role', 'is_organizer', 'organizer_status', 'is_approved', 'is_active', 'is_staff', 'is_superuser')
        }),
        ('Рейтинг и Trust Factor', {
            'fields': ('rating', 'trust_factor', 'average_rating', 'registration_source')
        }),
        ('Организация', {
            'fields': ('organization_name',)
        }),
        ('Портфолио организатора', {
            'fields': ('age', 'gender', 'bio', 'work_experience_years', 'work_history', 'portfolio_photo'),
            'classes': ('collapse',)
        }),
        ('Важные даты', {
            'fields': ('last_login', 'date_joined')
        }),
    )
    
    add_fieldsets = (
        (None, {
            'classes': ('wide',),
            'fields': ('username', 'password1', 'password2'),
        }),
        ('Персональная информация', {
            'classes': ('wide',),
            'fields': ('email', 'first_name', 'last_name', 'name', 'phone_number', 'telegram_id'),
        }),
        ('Роль', {
            'classes': ('wide',),
            'fields': ('role', 'is_organizer', 'organization_name'),
        }),
    )
    
    filter_horizontal = ('groups', 'user_permissions')


# ============================================================================
# ПРОЕКТЫ
# ============================================================================

# Регистрация моделей проектов
@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ['id', 'title', 'creator', 'city', 'status', 'created_at', 'start_date', 'end_date']
    list_filter = ['status', 'city', 'created_at', 'start_date']
    search_fields = ['title', 'description', 'creator__username', 'creator__email', 'city']
    readonly_fields = ['id', 'created_at']
    date_hierarchy = 'created_at'


# Скрыто - техническая модель (участие волонтёров в проектах)
# @admin.register(VolunteerProject)
# class VolunteerProjectAdmin(admin.ModelAdmin):
#     list_display = ['id', 'volunteer', 'project', 'joined_at']
#     list_filter = ['joined_at']
#     search_fields = ['volunteer__username', 'project__title']
#     readonly_fields = ['id', 'joined_at']


# ============================================================================
# ЗАДАЧИ И ФОТООТЧЕТЫ
# ============================================================================

# Регистрация моделей задач
@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ['id', 'text_short', 'project', 'status', 'deadline_date', 'created_at']
    list_filter = ['status', 'created_at', 'deadline_date']
    search_fields = ['text', 'project__title']
    readonly_fields = ['id', 'created_at']
    date_hierarchy = 'created_at'
    
    def text_short(self, obj):
        return obj.text[:50] + "..." if len(obj.text) > 50 else obj.text
    text_short.short_description = 'Текст задачи'


# Скрыто - техническая модель (назначения заданий)
# @admin.register(TaskAssignment)
# class TaskAssignmentAdmin(admin.ModelAdmin):
#     list_display = ['id', 'task', 'volunteer', 'accepted', 'completed', 'completed_at']
#     list_filter = ['accepted', 'completed', 'completed_at']
#     search_fields = ['task__text', 'volunteer__username']
#     readonly_fields = ['id']


# Регистрация моделей фото
@admin.register(Photo)
class PhotoAdmin(admin.ModelAdmin):
    list_display = ['id', 'volunteer', 'project', 'task', 'status', 'uploaded_at', 'moderated_at']
    list_filter = ['status', 'uploaded_at', 'moderated_at']
    search_fields = ['volunteer__username', 'project__title', 'task__text', 'volunteer_comment']
    readonly_fields = ['id', 'uploaded_at', 'moderated_at']
    date_hierarchy = 'uploaded_at'


# Скрыто - техническая модель (активность пользователей, только для просмотра)
# @admin.register(Activity)
# class ActivityAdmin(admin.ModelAdmin):
#     list_display = ['id', 'user', 'type', 'project', 'created_at']
#     list_filter = ['type', 'created_at']
#     search_fields = ['user__username', 'project__title', 'title', 'description']
#     readonly_fields = ['id', 'user', 'type', 'project', 'title', 'description', 'created_at']
#     date_hierarchy = 'created_at'
#     
#     def has_add_permission(self, request):
#         return False
#     
#     def has_change_permission(self, request, obj=None):
#         return False


# Скрыто - технические модели (обратная связь между организаторами и волонтёрами)
# @admin.register(FeedbackSession)
# class FeedbackSessionAdmin(admin.ModelAdmin):
#     list_display = ['id', 'project', 'organizer', 'volunteer', 'is_active', 'is_completed', 'created_at']
#     list_filter = ['is_active', 'is_completed', 'created_at']
#     search_fields = ['project__title', 'organizer__username', 'volunteer__username']
#     readonly_fields = ['id', 'created_at']


# @admin.register(FeedbackMessage)
# class FeedbackMessageAdmin(admin.ModelAdmin):
#     list_display = ['id', 'session', 'sender', 'message_type', 'timestamp']
#     list_filter = ['message_type', 'timestamp']
#     search_fields = ['session__project__title', 'sender__username', 'content']
#     readonly_fields = ['id', 'timestamp']


# Скрыто - модели достижений (можно включить при необходимости)
# @admin.register(Achievement)
# class AchievementAdmin(admin.ModelAdmin):
#     list_display = ['id', 'name', 'description_short', 'required_rating', 'xp', 'icon', 'created_at']
#     list_filter = ['required_rating', 'created_at']
#     search_fields = ['name', 'description']
#     readonly_fields = ['id', 'created_at']
#     
#     def description_short(self, obj):
#         return obj.description[:50] + "..." if len(obj.description) > 50 else obj.description
#     description_short.short_description = 'Описание'


# @admin.register(UserAchievement)
# class UserAchievementAdmin(admin.ModelAdmin):
#     list_display = ['id', 'user', 'achievement', 'unlocked_at']
#     list_filter = ['unlocked_at']
#     search_fields = ['user__username', 'achievement__name']
#     readonly_fields = ['id', 'unlocked_at']


# ============================================================================
# ЗАЯВКИ И ИСТОРИЯ
# ============================================================================

# Регистрация моделей заявок организаторов
@admin.register(OrganizerApplication)
class OrganizerApplicationAdmin(admin.ModelAdmin):
    list_display = ['id', 'user', 'status', 'created_at', 'updated_at']
    list_filter = ['status', 'created_at', 'updated_at']
    search_fields = ['user__username', 'user__email', 'organization_name']
    readonly_fields = ['id', 'created_at', 'updated_at']
    date_hierarchy = 'created_at'


# Скрыто - техническая модель (история изменений TrustFactor, только для просмотра)
# @admin.register(TrustFactorHistory)
# class TrustFactorHistoryAdmin(admin.ModelAdmin):
#     list_display = ['id', 'user', 'old_value', 'new_value', 'reason', 'created_at']
#     list_filter = ['reason', 'created_at']
#     search_fields = ['user__username', 'reason']
#     readonly_fields = ['id', 'user', 'change_amount', 'reason', 'related_object_type', 'related_object_id', 'old_value', 'new_value', 'created_at']
#     date_hierarchy = 'created_at'
#     
#     def has_add_permission(self, request):
#         return False
#     
#     def has_change_permission(self, request, obj=None):
#         return False


# ============================================================================
# УВЕДОМЛЕНИЯ
# ============================================================================

# Скрыто - техническая модель (токены устройств для push-уведомлений)
# @admin.register(DeviceToken)
# class DeviceTokenAdmin(admin.ModelAdmin):
#     list_display = ['id', 'user', 'platform', 'token_short', 'is_active', 'created_at', 'last_used_at']
#     list_filter = ['platform', 'is_active', 'created_at']
#     search_fields = ['user__username', 'token', 'device_name']
#     readonly_fields = ['id', 'created_at', 'last_used_at']
#     
#     def token_short(self, obj):
#         return obj.token[:20] + "..." if len(obj.token) > 20 else obj.token
#     token_short.short_description = 'Токен'


# Регистрация моделей уведомлений
@admin.register(NotificationTemplate)
class NotificationTemplateAdmin(admin.ModelAdmin):
    list_display = ['id', 'name', 'template_type', 'subject', 'created_at']
    list_filter = ['template_type', 'created_at']
    search_fields = ['name', 'subject', 'message']
    readonly_fields = ['id', 'created_at', 'updated_at']


@admin.register(BulkNotification)
class BulkNotificationAdmin(admin.ModelAdmin):
    list_display = ['id', 'template', 'status', 'scheduled_at', 'sent_at', 'created_at']
    list_filter = ['status', 'created_at', 'scheduled_at']
    search_fields = ['template__name', 'subject']
    readonly_fields = ['id', 'created_at', 'sent_at']


# Скрыто - техническая модель (получатели уведомлений)
# @admin.register(NotificationRecipient)
# class NotificationRecipientAdmin(admin.ModelAdmin):
#     list_display = ['id', 'notification', 'user', 'status', 'sent_at']
#     list_filter = ['status', 'sent_at']
#     search_fields = ['notification__template__name', 'user__username']
#     readonly_fields = ['id', 'sent_at']


# Регистрация моделей поиска (скрыта - техническая модель)
# @admin.register(UserSearchFilter)
# class UserSearchFilterAdmin(admin.ModelAdmin):
#     list_display = ['id', 'user', 'created_at']
#     list_filter = ['created_at']
#     search_fields = ['user__username']
#     readonly_fields = ['id', 'created_at']


# Скрыто - модели событий и геолокационных напоминаний
# @admin.register(Event)
# class EventAdmin(admin.ModelAdmin):
#     list_display = ['id', 'title', 'project', 'start_date', 'start_time', 'created_at']
#     list_filter = ['event_type', 'start_date', 'created_at']
#     search_fields = ['title', 'project__title', 'description']
#     readonly_fields = ['id', 'created_at', 'updated_at']
#     date_hierarchy = 'start_date'


# @admin.register(GeofenceReminder)
# class GeofenceReminderAdmin(admin.ModelAdmin):
#     list_display = ['id', 'event', 'user', 'created_at']
#     list_filter = ['created_at']
#     search_fields = ['event__title', 'user__username']
#     readonly_fields = ['id', 'created_at']


# Скрыто - модели чата (можно включить при необходимости для модерации)
# @admin.register(Chat)
# class ChatAdmin(admin.ModelAdmin):
#     list_display = ['id', 'name', 'chat_type', 'created_at', 'updated_at']
#     list_filter = ['chat_type', 'created_at']
#     search_fields = ['name']
#     readonly_fields = ['id', 'created_at', 'updated_at']


# @admin.register(Message)
# class MessageAdmin(admin.ModelAdmin):
#     list_display = ['id', 'chat', 'sender', 'message_type', 'created_at']
#     list_filter = ['message_type', 'created_at']
#     search_fields = ['chat__name', 'sender__username', 'text']
#     readonly_fields = ['id', 'created_at', 'updated_at']
#     date_hierarchy = 'created_at'


# @admin.register(ChatMember)
# class ChatMemberAdmin(admin.ModelAdmin):
#     list_display = ['id', 'chat', 'user', 'joined_at']
#     list_filter = ['joined_at']
#     search_fields = ['chat__name', 'user__username']
#     readonly_fields = ['id', 'joined_at']


# @admin.register(PinnedMessage)
# class PinnedMessageAdmin(admin.ModelAdmin):
#     list_display = ['id', 'chat', 'message', 'pinned_at']
#     list_filter = ['pinned_at']
#     search_fields = ['chat__name', 'message__text']
#     readonly_fields = ['id', 'pinned_at']


# Регистрация моделей статуса печати (скрыта - техническая модель)
# @admin.register(TypingStatus)
# class TypingStatusAdmin(admin.ModelAdmin):
#     list_display = ['id', 'chat', 'user', 'typing_type', 'started_at']
#     list_filter = ['typing_type', 'started_at']
#     search_fields = ['chat__name', 'user__username']
#     readonly_fields = ['id', 'started_at']


# Регистрация моделей кодов (скрыты - технические модели, создаются автоматически)
@admin.register(VerificationCode)
class VerificationCodeAdmin(admin.ModelAdmin):
    list_display = ['id', 'verification_type', 'user', 'email', 'code', 'is_used', 'created_at', 'expires_at']
    list_filter = ['verification_type', 'is_used', 'created_at', 'expires_at']
    search_fields = ['user__username', 'code', 'email']
    readonly_fields = ['id', 'created_at']
    list_select_related = ['user']


# Старые модели (DEPRECATED - будут удалены)
# @admin.register(TelegramLinkCode)
# class TelegramLinkCodeAdmin(admin.ModelAdmin):
#     list_display = ['id', 'user', 'code', 'is_used', 'created_at', 'expires_at']
#     list_filter = ['is_used', 'created_at', 'expires_at']
#     search_fields = ['user__username', 'code']
#     readonly_fields = ['id', 'created_at']


# @admin.register(EmailVerificationCode)
# class EmailVerificationCodeAdmin(admin.ModelAdmin):
#     list_display = ['id', 'user', 'email', 'code', 'is_used', 'created_at', 'expires_at']
#     list_filter = ['is_used', 'created_at', 'expires_at']
#     search_fields = ['user__username', 'code', 'email']
#     readonly_fields = ['id', 'created_at']

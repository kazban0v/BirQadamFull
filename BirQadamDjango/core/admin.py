from django.contrib import admin
from django.utils.html import format_html
from django.urls import reverse
from core.models import SupportTicket


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
            user_url = reverse('admin:auth_user_change', args=[obj.user.id])
            return format_html('<a href="{}">{}</a> ({})', 
                             user_url, obj.user.username, obj.user.email)
        return "Анонимный пользователь"
    user_info.short_description = 'Пользователь'
    
    def short_message(self, obj):
        return obj.message[:50] + "..." if len(obj.message) > 50 else obj.message
    short_message.short_description = 'Сообщение'
    
    def admin_actions(self, obj):
        return format_html(
            '<a class="button" href="{}">Ответить</a>&nbsp;'
            '<a class="button" href="{}">Изменить</a>',
            reverse('admin:core_supportticket_change', args=[obj.pk]),
            reverse('admin:core_supportticket_change', args=[obj.pk])
        )
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
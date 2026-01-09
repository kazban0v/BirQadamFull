
from django.contrib import admin
# Импортируйте ваши модели, которые мы создали в models.py
from .models import Visit, Event 

# --- Настройки для модели Visit ---
class VisitAdmin(admin.ModelAdmin):
    # Поля, которые будут отображаться в списке записей
    list_display = ('timestamp', 'user_id', 'type', 'url')
    # Поля, по которым можно искать
    search_fields = ('user_id', 'url')
    # Поля, по которым можно фильтровать
    list_filter = ('type', 'timestamp')
    # Делаем поле user_id ссылкой на детальный просмотр
    list_display_links = ('user_id',) 

# --- Настройки для модели Event ---
class EventAdmin(admin.ModelAdmin):
    # Поля, которые будут отображаться в списке записей
    list_display = ('timestamp', 'user_id', 'event_name', 'action', 'url')
    # Поля, по которым можно искать
    search_fields = ('user_id', 'action', 'url')
    # Поля, по которым можно фильтровать
    list_filter = ('event_name', 'action', 'timestamp')
    # Удобное отображение даты
    date_hierarchy = 'timestamp' 

# Регистрация моделей:
admin.site.register(Visit, VisitAdmin)
admin.site.register(Event, EventAdmin)
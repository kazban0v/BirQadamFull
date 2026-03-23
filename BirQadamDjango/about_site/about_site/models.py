from django.db import models
from django.utils import timezone

# --- Модель для отслеживания визитов (захода на страницу) ---
class Visit(models.Model):
    """
    Хранит информацию о визитах пользователей на сайт.
    Записывается только для НОВЫХ пользователей, когда они совершают первое действие.
    """
    # Уникальный ID, сгенерированный на фронтенде (JS), используется для подсчета уникальных пользователей.
    user_id = models.CharField(
        max_length=36,
        db_index=True,
        verbose_name="User ID (from cookie)"
    )
    # Тип визита: 'new' или 'returning'. 
    # В нашей логике, сохраняется только 'new' (первый клик пользователя).
    type = models.CharField(
        max_length=20,
        verbose_name="Visit Type"
    )
    # URL страницы, с которой был отправлен запрос
    url = models.URLField(
        max_length=255,
        verbose_name="Page URL"
    )
    # Реферер (откуда пришел пользователь)
    referrer = models.URLField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="HTTP Referrer"
    )
    # Время создания записи
    timestamp = models.DateTimeField(
        default=timezone.now,
        db_index=True
    )

    def __str__(self):
        return f"Visit {self.type} by {self.user_id} on {self.url}"

# --- Модель для отслеживания событий (кликов по кнопкам) ---
class Event(models.Model):
    """
    Хранит информацию о конкретных действиях (кликах) пользователей.
    """
    # ID пользователя, совершившего действие
    user_id = models.CharField(
        max_length=36,
        db_index=True,
        verbose_name="User ID (from cookie)"
    )
    # Название события (в нашем случае 'click')
    event_name = models.CharField(
        max_length=50,
        verbose_name="Event Name"
    )
    # Детальное действие ('Telegram_Link_Clicked' или 'Browser_Version_Clicked')
    action = models.CharField(
        max_length=100,
        verbose_name="Event Action"
    )
    # URL страницы, на которой произошло событие
    url = models.URLField(
        max_length=255,
        verbose_name="Page URL"
    )
    # Время создания записи
    timestamp = models.DateTimeField(
        default=timezone.now,
        db_index=True
    )

    def __str__(self):
        return f"Event '{self.action}' by {self.user_id} on {self.url}"
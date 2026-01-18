"""
Celery configuration for BirQadam project

Используется для асинхронных задач:
- Массовые рассылки (email, push, telegram)
- Автоочистка старых FCM токенов
- Периодические задачи (beat scheduler)
"""
import os
from typing import Any
from celery import Celery
from celery.schedules import crontab  # type: ignore[reportMissingImports]

# Устанавливаем настройки Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'volunteer_project.settings')

app = Celery('birqadam')  # type: ignore[call-issue]

# Загружаем конфигурацию из settings.py с префиксом CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')

# Автоматическое обнаружение tasks.py в приложениях
app.autodiscover_tasks()

# ✅ CELERY BEAT: Периодические задачи
app.conf.beat_schedule = {
    'cleanup-old-fcm-tokens-weekly': {
        'task': 'core.tasks.tasks.cleanup_old_device_tokens',
        'schedule': crontab(hour=0, minute=0, day_of_week='sunday'),  # Каждое воскресенье в 00:00
    },
}

@app.task(bind=True)
def debug_task(self: Any) -> None:
    print(f'Request: {self.request!r}')



# ✅ Инициализация Celery при запуске Django
# Импорт опциональный - работает только если celery установлен
try:
    from .celery import app as celery_app
    __all__ = ('celery_app',)
except ImportError:
    # Celery не установлен - пропускаем инициализацию
    pass


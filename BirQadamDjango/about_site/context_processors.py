"""
Context processors для about_site приложения
Добавляет переменные в контекст всех шаблонов
"""
from django.conf import settings
import os


def frontend_url(request):
    """
    Добавляет FRONTEND_URL в контекст шаблонов
    Используется для ссылки на фронтенд приложение
    Фронтенд доступен на пути /portal на том же домене
    """
    # Получаем из переменной окружения, в production может быть задано для переопределения
    frontend_url_value = os.getenv('FRONTEND_URL', '')
    
    # Если не задано, используем значение по умолчанию в зависимости от режима
    if not frontend_url_value:
        if settings.DEBUG:
            # В разработке используем localhost
            frontend_url_value = 'http://localhost:5173'
        else:
            # В production: используем текущий домен с путем /portal
            try:
                scheme = request.scheme if hasattr(request, 'scheme') else 'https'
                host = request.get_host() if hasattr(request, 'get_host') else ''
                if host:
                    # Фронтенд доступен на том же домене по пути /portal
                    frontend_url_value = f'{scheme}://{host}/portal'
                else:
                    # Fallback на текущий домен из настроек
                    allowed_host = getattr(settings, 'ALLOWED_HOSTS', [''])[0] if getattr(settings, 'ALLOWED_HOSTS', []) else ''
                    if allowed_host:
                        frontend_url_value = f'https://{allowed_host}/portal' if not allowed_host.startswith('http') else f'{allowed_host}/portal'
                    else:
                        frontend_url_value = '/portal'
            except Exception:
                # В случае любой ошибки используем относительный путь (безопасно)
                frontend_url_value = '/portal'
    
    return {
        'FRONTEND_URL': frontend_url_value,
    }


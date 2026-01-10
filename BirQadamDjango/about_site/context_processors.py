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
    """
    # Получаем из переменной окружения, в production должно быть задано
    frontend_url_value = os.getenv('FRONTEND_URL', '')
    
    # Если не задано, используем значение по умолчанию в зависимости от режима
    if not frontend_url_value:
        if settings.DEBUG:
            # В разработке используем localhost
            frontend_url_value = 'http://localhost:5173'
        else:
            # В production: безопасный fallback на текущий домен
            # Это не сломает сайт, но ссылка может быть неправильной,
            # если фронтенд на отдельном домене
            try:
                scheme = request.scheme if hasattr(request, 'scheme') else 'https'
                host = request.get_host() if hasattr(request, 'get_host') else ''
                if host:
                    frontend_url_value = f'{scheme}://{host}'
                else:
                    # Fallback на текущий домен из настроек
                    frontend_url_value = getattr(settings, 'ALLOWED_HOSTS', [''])[0] if getattr(settings, 'ALLOWED_HOSTS', []) else ''
                    if frontend_url_value and not frontend_url_value.startswith('http'):
                        frontend_url_value = f'https://{frontend_url_value}'
            except Exception:
                # В случае любой ошибки используем пустую строку (безопасно)
                frontend_url_value = ''
    
    return {
        'FRONTEND_URL': frontend_url_value,
    }


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
    ✅ Frontend теперь отдельное приложение, работает на отдельном порте/домене
    """
    # Получаем из переменной окружения, в production может быть задано для переопределения
    frontend_url_value = os.getenv('FRONTEND_URL', '')
    
    # Если не задано, используем значение по умолчанию в зависимости от режима
    if not frontend_url_value:
        if settings.DEBUG:
            # В разработке используем отдельный порт для frontend
            frontend_url_value = 'http://localhost:5173'
        else:
            # В production: используем отдельный домен или поддомен для frontend
            # По умолчанию используем тот же домен, но отдельный порт/поддомен
            try:
                scheme = request.scheme if hasattr(request, 'scheme') else 'https'
                host = request.get_host() if hasattr(request, 'get_host') else ''
                if host:
                    # Можно использовать поддомен или отдельный порт
                    # Например: frontend.birqadam.almau.edu.kz или birqadam.almau.edu.kz:5173
                    # По умолчанию используем тот же домен (настройте по необходимости)
                    frontend_url_value = f'{scheme}://{host}'
                else:
                    # Fallback на текущий домен из настроек
                    allowed_host = getattr(settings, 'ALLOWED_HOSTS', [''])[0] if getattr(settings, 'ALLOWED_HOSTS', []) else ''
                    if allowed_host:
                        frontend_url_value = f'https://{allowed_host}' if not allowed_host.startswith('http') else allowed_host
                    else:
                        frontend_url_value = 'http://localhost:5173'
            except Exception:
                # В случае любой ошибки используем localhost для разработки
                frontend_url_value = 'http://localhost:5173'
    
    return {
        'FRONTEND_URL': frontend_url_value,
    }


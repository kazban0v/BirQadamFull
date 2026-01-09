"""
Context processors для about_site приложения
Добавляет переменные в контекст всех шаблонов
"""
from django.conf import settings
import os


def frontend_url(request):
    """
    Добавляет FRONTEND_URL в контекст шаблонов
    Используется для ссылок на фронтенд приложение
    """
    # Получаем из переменной окружения, в production должно быть задано
    frontend_url_value = os.getenv('FRONTEND_URL', '')
    
    # Если не задано, используем значение по умолчанию в зависимости от режима
    if not frontend_url_value:
        if settings.DEBUG:
            # В разработке используем localhost
            frontend_url_value = 'http://localhost:5173'
        else:
            # В production должно быть задано через переменную окружения
            # Если не задано, используем пустую строку (ссылки не будут работать)
            frontend_url_value = ''
    
    return {
        'FRONTEND_URL': frontend_url_value,
    }


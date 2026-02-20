from django.contrib import admin
from django.urls import include, path, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, HttpResponse, Http404
from django.views.static import serve
from urllib.parse import unquote
import os


def frontend_view(request, path=''):
    """
    View для обслуживания фронтенда на пути /portal
    Отдает index.html для всех путей (SPA routing)
    Пути в index.html уже правильные после пересборки с base: '/portal/'
    """
    # Используем Path для кроссплатформенной работы
    frontend_dist_path = settings.BASE_DIR / 'frontend' / 'dist'
    index_path = frontend_dist_path / 'index.html'
    
    if index_path.exists():
        # Для index.html отключаем кэширование, так как это SPA и файл может меняться
        response = FileResponse(open(index_path, 'rb'), content_type='text/html; charset=utf-8')
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        return response
    else:
        return HttpResponse('Frontend not found. Please build the frontend first: cd frontend && npm run build', status=404)


def serve_frontend_file(request, path, document_root=None):
    """
    Обслуживание статических файлов фронтенда
    Работает в production через FileResponse
    """
    from mimetypes import guess_type
    import hashlib
    from django.utils.http import http_date
    from django.views.static import was_modified_since
    from django.http import HttpResponseNotModified
    
    # Получаем document_root из kwargs если передан
    if document_root is None:
        document_root = str(settings.BASE_DIR / 'frontend' / 'dist')
    
    # Строим полный путь к файлу
    file_path = os.path.join(document_root, path)
    
    # Безопасность: проверяем, что путь внутри document_root (защита от path traversal)
    file_path = os.path.normpath(os.path.abspath(file_path))
    document_root = os.path.normpath(os.path.abspath(document_root))
    if not file_path.startswith(document_root + os.sep) and file_path != document_root:
        return HttpResponse('Forbidden', status=403)
    
    if not os.path.exists(file_path) or not os.path.isfile(file_path):
        return HttpResponse('File not found', status=404)
    
    # Получаем информацию о файле
    stat = os.stat(file_path)
    file_size = stat.st_size
    file_mtime = stat.st_mtime
    
    # Проверяем If-Modified-Since заголовок
    if not was_modified_since(request.META.get('HTTP_IF_MODIFIED_SINCE'), file_mtime):
        return HttpResponseNotModified()
    
    # Генерируем ETag на основе размера файла и времени модификации
    etag = hashlib.md5(f"{file_size}-{file_mtime}".encode()).hexdigest()
    
    # Проверяем If-None-Match заголовок
    if_none_match = request.META.get('HTTP_IF_NONE_MATCH')
    if if_none_match and if_none_match.strip('"') == etag:
        return HttpResponseNotModified()
    
    # Определяем content-type
    content_type, _ = guess_type(file_path)
    if content_type is None:
        # Fallback для известных типов
        if file_path.endswith('.js'):
            content_type = 'application/javascript'
        elif file_path.endswith('.css'):
            content_type = 'text/css'
        elif file_path.endswith('.svg'):
            content_type = 'image/svg+xml'
        elif file_path.endswith('.png'):
            content_type = 'image/png'
        elif file_path.endswith('.woff2'):
            content_type = 'font/woff2'
        elif file_path.endswith('.woff'):
            content_type = 'font/woff'
        elif file_path.endswith('.ttf'):
            content_type = 'font/ttf'
        else:
            content_type = 'application/octet-stream'
    
    # Отдаем файл с заголовками кэширования
    response = FileResponse(open(file_path, 'rb'), content_type=content_type)
    response['Last-Modified'] = http_date(file_mtime)
    response['ETag'] = f'"{etag}"'
    # Кэшируем статические файлы на 1 год (они имеют хеш в имени, поэтому безопасно)
    response['Cache-Control'] = 'public, max-age=31536000, immutable'
    
    return response


# Создаем функции для обслуживания статических файлов с правильными document_root
def serve_assets(request, path):
    """Обслуживание файлов из frontend/dist/assets"""
    return serve_frontend_file(request, path, document_root=str(settings.BASE_DIR / 'frontend' / 'dist' / 'assets'))

def serve_frontend_root(request, path):
    """Обслуживание файлов из корня frontend/dist (birqadam-logo.png, vite.svg и т.д.)"""
    return serve_frontend_file(request, path, document_root=str(settings.BASE_DIR / 'frontend' / 'dist'))


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('about_site.urls')),
    path('custom-admin/', include('custom_admin.urls', namespace='custom_admin')),
    path('api/web/', include(('core.api.web_portal', 'web_portal'), namespace='web_portal')),
    
    # Frontend на пути /portal
    # ВАЖНО: Статические файлы должны быть ПЕРЕД catch-all для SPA routing
    # Обслуживаем статические файлы из frontend/dist/assets - ВАЖНО: должно быть первым
    re_path(r'^portal/assets/(?P<path>.*)$', serve_assets),
    # Обслуживаем статические файлы в корне frontend/dist (birqadam-logo.png, vite.svg и т.д.)
    # НЕ включаем путь assets, так как он обрабатывается выше
    re_path(r'^portal/(?P<path>[^/]+\.(?:png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp))$', serve_frontend_root),
    # Корневой путь /portal/ отдаем index.html
    path('portal/', frontend_view, name='frontend'),
    # Все остальные пути /portal/* отдаем index.html (SPA routing) - должен быть ПОСЛЕДНИМ
    re_path(r'^portal/.*$', frontend_view),
]

# Кастомное обслуживание медиа-файлов с поддержкой URL-encoded путей
def serve_media(request, path):
    """Обслуживание медиа-файлов с декодированием URL-encoded путей"""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        # Декодируем URL-encoded путь (поддерживает кириллицу)
        decoded_path = unquote(path, encoding='utf-8')
        
        # Убираем ведущий /media/ если он есть (URL уже содержит /media/)
        if decoded_path.startswith('media/'):
            decoded_path = decoded_path[6:]  # Убираем 'media/'
        elif decoded_path.startswith('/media/'):
            decoded_path = decoded_path[7:]  # Убираем '/media/'
        
        # Нормализуем путь (убираем двойные слеши, обрабатываем .. и т.д.)
        # Разделяем путь на части и обрабатываем каждую часть отдельно
        path_parts = decoded_path.split('/')
        # Убираем пустые части и обрабатываем относительные пути
        path_parts = [p for p in path_parts if p and p != '.']
        
        # Защита от path traversal (..)
        if '..' in path_parts:
            logger.warning(f"[serve_media] Path traversal attempt detected: {path}")
            return HttpResponse('Forbidden', status=403)
        
        # Собираем путь обратно
        normalized_path = '/'.join(path_parts)
        
        # Логирование для отладки
        logger.info(f"[serve_media] Original path: {path}")
        logger.info(f"[serve_media] Decoded path: {decoded_path}")
        logger.info(f"[serve_media] Normalized path: {normalized_path}")
        
        # Строим полный путь к файлу
        # Используем os.path.normpath для правильной обработки путей на Windows
        media_root = os.path.normpath(str(settings.MEDIA_ROOT))
        
        # Для Windows: заменяем прямые слеши на обратные при построении пути
        # Но normalized_path должен использовать прямые слеши для URL
        # При объединении с media_root используем os.path.join, который правильно обработает разделители
        if normalized_path.startswith('/'):
            normalized_path = normalized_path[1:]  # Убираем ведущий слеш для os.path.join
        
        file_path = os.path.normpath(os.path.join(media_root, normalized_path))
        logger.info(f"[serve_media] Media root: {media_root}")
        logger.info(f"[serve_media] File path: {file_path}")
        
        # Дополнительная проверка безопасности: убеждаемся, что файл внутри MEDIA_ROOT
        # Преобразуем в абсолютные пути для сравнения
        media_root_abs = os.path.abspath(media_root)
        file_path_abs = os.path.abspath(file_path)
        
        if not file_path_abs.startswith(media_root_abs + os.sep) and file_path_abs != media_root_abs:
            logger.warning(f"[serve_media] Path traversal attempt: {file_path_abs} not in {media_root_abs}")
            return HttpResponse('Forbidden', status=403)
        
        # Проверяем существование файла
        if not os.path.exists(file_path) or not os.path.isfile(file_path):
            logger.warning(f"[serve_media] File not found: {file_path}")
            # Попробуем найти файл с альтернативными путями
            # Иногда путь может быть закодирован по-другому
            logger.warning(f"[serve_media] MEDIA_ROOT: {media_root}")
            logger.warning(f"[serve_media] Attempted file path: {file_path}")
            return HttpResponse(f'File not found: {file_path}', status=404)
        
        # Используем стандартную функцию serve
        # serve ожидает путь относительно document_root, поэтому передаем normalized_path
        # normalized_path уже без ведущего слеша после обработки выше
        logger.info(f"[serve_media] Serving file: {file_path} via path: {normalized_path}")
        return serve(request, normalized_path, document_root=settings.MEDIA_ROOT)
        
    except Exception as e:
        logger.error(f"[serve_media] Error serving media file: {e}", exc_info=True)
        return HttpResponse(f'Internal server error: {str(e)}', status=500)

# Добавляем маршрут для медиа-файлов (всегда используем кастомный view для правильной обработки URL-encoded путей)
urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve_media),
]

from django.contrib import admin
from django.urls import include, path, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, HttpResponse
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
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

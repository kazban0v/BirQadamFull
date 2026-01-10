from django.contrib import admin
from django.urls import include, path, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.http import FileResponse, HttpResponse
from functools import partial
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
        # Просто отдаем index.html - пути уже правильные после пересборки
        return FileResponse(open(index_path, 'rb'), content_type='text/html; charset=utf-8')
    else:
        return HttpResponse('Frontend not found. Please build the frontend first: cd frontend && npm run build', status=404)


# Создаем функции для обслуживания статических файлов
serve_assets = partial(serve, document_root=str(settings.BASE_DIR / 'frontend' / 'dist' / 'assets'), show_indexes=False)
serve_frontend_static = partial(serve, document_root=str(settings.BASE_DIR / 'frontend' / 'dist'), show_indexes=False)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('about_site.urls')),
    path('custom-admin/', include('custom_admin.urls')),
    path('api/web/', include(('core.api.web_portal', 'web_portal'), namespace='web_portal')),
    
    # Frontend на пути /portal
    # ВАЖНО: Статические файлы должны быть ПЕРЕД catch-all для SPA routing
    # Обслуживаем статические файлы (assets) из frontend/dist/assets - ВАЖНО: должно быть первым
    re_path(r'^portal/assets/(?P<path>.*)$', serve_assets),
    # Обслуживаем статические файлы в корне frontend/dist (vite.svg, birqadam-logo.png и т.д.)
    re_path(r'^portal/(?P<path>[^/]+\.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|webp))$', serve_frontend_static),
    # Корневой путь /portal/ отдаем index.html
    path('portal/', frontend_view, name='frontend'),
    # Все остальные пути /portal/* отдаем index.html (SPA routing) - должен быть ПОСЛЕДНИМ
    re_path(r'^portal/.*$', frontend_view),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

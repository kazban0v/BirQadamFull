from django.contrib import admin
from django.urls import include, path, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from django.http import FileResponse
import os


def frontend_view(request, path=''):
    """
    View для обслуживания фронтенда на пути /portal
    Отдает index.html для всех путей (SPA routing)
    Заменяет пути в HTML для работы с базовым путем /portal/
    """
    # Используем Path для кроссплатформенной работы
    frontend_dist_path = settings.BASE_DIR / 'frontend' / 'dist'
    index_path = frontend_dist_path / 'index.html'
    
    if index_path.exists():
        # Читаем index.html
        with open(index_path, 'r', encoding='utf-8') as f:
            html_content = f.read()
        
        # Заменяем абсолютные пути на пути с /portal/
        # Обрабатываем пути, которые начинаются с / но не с /portal/
        import re
        # Заменяем пути к assets (JS, CSS и другие файлы)
        html_content = re.sub(r'(href|src)=["\'](/assets/[^"\']+)["\']', r'\1="/portal\2"', html_content)
        # Заменяем пути к vite.svg и другим статическим файлам в корне
        html_content = re.sub(r'(href|src)=["\'](/(?!portal/)[^"\']*\.(?:svg|ico|png|jpg|jpeg|gif))["\']', r'\1="/portal\2"', html_content)
        # Убеждаемся, что пути уже с /portal/ не заменяются дважды
        # Это уже обработано регулярными выражениями выше
        
        from django.http import HttpResponse
        return HttpResponse(html_content, content_type='text/html')
    else:
        from django.http import HttpResponse
        return HttpResponse('Frontend not found. Please build the frontend first.', status=404)


urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('about_site.urls')),
    path('custom-admin/', include('custom_admin.urls')),
    path('api/web/', include(('core.api.web_portal', 'web_portal'), namespace='web_portal')),
    
    # Frontend на пути /portal
    # Обслуживаем статические файлы (assets) из frontend/dist/assets
    re_path(r'^portal/assets/(?P<path>.*)$', serve, {
        'document_root': str(settings.BASE_DIR / 'frontend' / 'dist' / 'assets'),
    }),
    # Обслуживаем другие статические файлы из frontend/dist (vite.svg и т.д.)
    re_path(r'^portal/(?P<path>.*\.(?:js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot))$', serve, {
        'document_root': str(settings.BASE_DIR / 'frontend' / 'dist'),
    }),
    # Все остальные пути /portal/* отдаем index.html (SPA routing)
    re_path(r'^portal/.*$', frontend_view),
    path('portal/', frontend_view, name='frontend'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

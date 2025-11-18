from django.contrib import admin
from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('', include('about_site.urls')),
    path('custom-admin/', include('custom_admin.urls')),
    path('api/web/', include(('core.api.web_portal', 'web_portal'), namespace='web_portal')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

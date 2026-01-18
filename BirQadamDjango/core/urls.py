from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from core.api.health_check import health_check, readiness_check, liveness_check

urlpatterns = [
    path('admin/', admin.site.urls),
    path('custom-admin/', include('custom_admin.urls')),
    # ✅ ИСПРАВЛЕНИЕ СредП-12: Health Check Endpoints
    path('health/', health_check, name='health_check'),
    path('health/ready/', readiness_check, name='readiness_check'),
    path('health/live/', liveness_check, name='liveness_check'),
    path('api/web/', include(('core.api.web_portal', 'web_portal'), namespace='web_portal')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
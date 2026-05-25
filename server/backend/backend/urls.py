from django.contrib import admin
from django.urls import path, include
from core.views import api_root, health_check

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/', api_root, name='api-root'),
    path('api/v1/health/', health_check, name='health-check'),
    path('api/v1/', include('core.urls')),
    path('api/v1/', include('stops.urls')),
    path('api/v1/', include('reports.urls')),
    path('api/v1/', include('routing.urls')),
]

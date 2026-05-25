from django.urls import path, include
from rest_framework.routers import SimpleRouter
from . import views

router = SimpleRouter()
router.register(r'corridors', views.CorridorViewSet, basename='corridor')
router.register(r'corridor-stops', views.CorridorStopViewSet, basename='corridor-stop')
router.register(r'stop-connections', views.StopConnectionViewSet, basename='stop-connection')

urlpatterns = [
    path('stops/nearby/', views.NearbyStopsView.as_view(), name='stops-nearby'),
    path('', include(router.urls)),
]

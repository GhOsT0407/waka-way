"""
URL configuration for core app API endpoints
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

# Create a router and register viewsets
router = DefaultRouter()
router.register(r'corridors', views.CorridorViewSet, basename='corridor')
router.register(r'corridor-stops', views.CorridorStopViewSet, basename='corridor-stop')
router.register(r'stop-connections', views.StopConnectionViewSet, basename='stop-connection')

urlpatterns = [
    path('', include(router.urls)),
]

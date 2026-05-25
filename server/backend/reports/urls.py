from django.urls import path, include
from rest_framework.routers import SimpleRouter
from . import views

router = SimpleRouter()
router.register(r'reports', views.UserReportViewSet, basename='report')

urlpatterns = [
    path('', include(router.urls)),
]

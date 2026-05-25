from django.urls import path
from . import views

urlpatterns = [
    path('routes/compute/', views.RouteComputeView.as_view(), name='route-compute'),
]

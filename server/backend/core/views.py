from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import generics

from .models import City
from .serializers import CitySerializer


@api_view(['GET'])
def api_root(request):
    return Response({
        'message': 'Welcome to WakaWay API',
        'version': '1.0',
        'endpoints': {
            'cities':          '/api/v1/cities/',
            'corridors':       '/api/v1/corridors/',
            'corridor-stops':  '/api/v1/corridor-stops/',
            'stop-connections':'/api/v1/stop-connections/',
            'stops-nearby':    '/api/v1/stops/nearby/',
            'reports':         '/api/v1/reports/',
            'compute':         '/api/v1/routes/compute/',
            'health':          '/api/v1/health/',
        },
    })


@api_view(['GET'])
def health_check(request):
    return Response({
        'status': 'healthy',
        'message': 'WakaWay API is running',
    })


class CityListView(generics.ListAPIView):
    queryset = City.objects.filter(is_active=True).order_by('name')
    serializer_class = CitySerializer

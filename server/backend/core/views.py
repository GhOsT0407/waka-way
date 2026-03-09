from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status, viewsets, filters
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend

from .models import City, Corridor, CorridorStop, StopConnection
from .serializers import (
    CorridorListSerializer, CorridorDetailSerializer,
    CorridorStopSerializer, StopConnectionSerializer
)


@api_view(['GET'])
def api_root(request):
    """API root endpoint"""
    return Response({
        'message': 'Welcome to WakaWay API',
        'version': '1.0',
        'endpoints': {
            'cities': '/api/v1/cities/',
            'stops': '/api/v1/stops/',
            'routes': '/api/v1/routes/',
            'corridors': '/api/v1/corridors/',
            'search': '/api/v1/routes/search/',
            'reports': '/api/v1/reports/',
        }
    })


@api_view(['GET'])
def health_check(request):
    """Health check endpoint"""
    return Response({
        'status': 'healthy',
        'message': 'WakaWay API is running'
    })


class StandardResultsSetPagination(PageNumberPagination):
    """Standard pagination for list endpoints"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class CorridorViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API ViewSet for Lagos transport corridors.
    
    Supports filtering by:
    - city: City ID
    - primary_mode: Transport mode (danfo, brt, keke, okada, ferry, walk, mixed)
    - is_active: Boolean to filter active corridors
    - search: Search in corridor name and ID
    """
    queryset = Corridor.objects.all().prefetch_related(
        'corridor_stops__stop',
        'connections'
    )
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['city', 'primary_mode', 'is_active']
    search_fields = ['name', 'corridor_id', 'notes']
    ordering_fields = ['name', 'created_at', 'corridor_id']
    ordering = ['corridor_id']
    pagination_class = StandardResultsSetPagination

    def get_serializer_class(self):
        """Use detail serializer for retrieve, list serializer for list"""
        if self.action == 'retrieve':
            return CorridorDetailSerializer
        return CorridorListSerializer


class CorridorStopViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API ViewSet for corridor stops.
    
    Returns all stops within a corridor in sequence order.
    """
    queryset = CorridorStop.objects.all().select_related(
        'corridor', 'stop'
    ).order_by('corridor', 'sequence')
    serializer_class = CorridorStopSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['corridor']
    ordering_fields = ['sequence']
    ordering = ['corridor', 'sequence']
    pagination_class = StandardResultsSetPagination


class StopConnectionViewSet(viewsets.ReadOnlyModelViewSet):
    """
    API ViewSet for stop connections.
    
    Shows alternative transport connections between stops.
    """
    queryset = StopConnection.objects.all().select_related(
        'from_stop', 'to_stop', 'corridor'
    )
    serializer_class = StopConnectionSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['from_stop', 'to_stop', 'transport_mode', 'corridor']
    ordering_fields = ['created_at']
    ordering = ['created_at']
    pagination_class = StandardResultsSetPagination


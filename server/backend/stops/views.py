import math
import logging

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, viewsets, filters
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend

from core.models import TransportStop, Corridor, CorridorStop, StopConnection
from core.serializers import TransportStopSerializer
from .serializers import (
    CorridorListSerializer, CorridorDetailSerializer,
    CorridorStopSerializer, StopConnectionSerializer,
)
from . import services

logger = logging.getLogger(__name__)


def _extract_latlon(location):
    """Extract (lat, lon) from a PostGIS Point or JSON dict."""
    if location is None:
        return None, None
    # PostGIS Point: has .y (lat) and .x (lon)
    if hasattr(location, 'y') and hasattr(location, 'x'):
        return location.y, location.x
    if isinstance(location, dict):
        lat = location.get('lat') or location.get('latitude')
        lng = location.get('lng') or location.get('longitude')
        return lat, lng
    return None, None


def _haversine_km(lat1, lon1, lat2, lon2):
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2
         + math.cos(math.radians(lat1))
         * math.cos(math.radians(lat2))
         * math.sin(dlon / 2) ** 2)
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class NearbyStopsView(APIView):
    """GET /api/v1/stops/nearby/?lat=&lng=&radius=&stop_type="""

    def get(self, request):
        try:
            lat    = float(request.query_params['lat'])
            lng    = float(request.query_params['lng'])
            radius = float(request.query_params.get('radius', 2))  # km
        except (KeyError, ValueError, TypeError):
            return Response(
                {'error': 'lat and lng are required numeric parameters'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not (-90 <= lat <= 90) or not (-180 <= lng <= 180):
            return Response(
                {'error': 'lat must be -90..90, lng must be -180..180'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        radius = min(max(radius, 0.1), 50)  # clamp 0.1–50 km

        qs = TransportStop.objects.select_related('city').all()
        stop_type = request.query_params.get('stop_type')
        if stop_type:
            qs = qs.filter(stop_type=stop_type)

        nearby = []
        for stop in qs:
            slat, slng = _extract_latlon(stop.location)
            if slat is None or slng is None:
                continue
            try:
                dist = _haversine_km(lat, lng, float(slat), float(slng))
            except (ValueError, TypeError):
                continue
            if dist <= radius:
                nearby.append((dist, stop))

        nearby.sort(key=lambda x: x[0])

        result = []
        for dist, stop in nearby[:50]:
            data = TransportStopSerializer(stop).data
            data['distance_km'] = round(dist, 3)
            result.append(data)

        return Response(result)


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class CorridorViewSet(viewsets.ReadOnlyModelViewSet):
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['city', 'primary_mode', 'is_active']
    search_fields = ['name', 'corridor_id', 'notes']
    ordering_fields = ['name', 'created_at', 'corridor_id']
    ordering = ['corridor_id']
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return services.get_corridors_queryset()

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return CorridorDetailSerializer
        return CorridorListSerializer


class CorridorStopViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = CorridorStopSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['corridor']
    ordering_fields = ['sequence']
    ordering = ['corridor', 'sequence']
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return services.get_corridor_stops_queryset()


class StopConnectionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StopConnectionSerializer
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_fields = ['from_stop', 'to_stop', 'transport_mode', 'corridor']
    ordering_fields = ['created_at']
    ordering = ['created_at']
    pagination_class = StandardResultsSetPagination

    def get_queryset(self):
        return services.get_stop_connections_queryset()

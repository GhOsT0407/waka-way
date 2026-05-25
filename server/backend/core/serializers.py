from rest_framework import serializers

try:
    from django.contrib.gis.geos import Point
    POSTGIS_AVAILABLE = True
except Exception:
    POSTGIS_AVAILABLE = False
    Point = None

from .models import (
    City, TransportStop, TransportRoute, RouteSegment,
    Fare, UserFavoritePlace,
)


class LocationSerializer(serializers.Serializer):
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()


class CitySerializer(serializers.ModelSerializer):
    class Meta:
        model = City
        fields = ['id', 'name', 'state', 'country', 'is_active']


class TransportStopSerializer(serializers.ModelSerializer):
    location = serializers.SerializerMethodField()

    class Meta:
        model = TransportStop
        fields = [
            'id', 'name', 'stop_type', 'location',
            'address', 'city', 'landmark', 'is_verified',
        ]

    def get_location(self, obj):
        if obj.location:
            if POSTGIS_AVAILABLE and hasattr(obj.location, 'y'):
                return {'latitude': obj.location.y, 'longitude': obj.location.x}
            if isinstance(obj.location, dict):
                return obj.location
        return None


class TransportRouteSerializer(serializers.ModelSerializer):
    origin_stop = TransportStopSerializer(read_only=True)
    destination_stop = TransportStopSerializer(read_only=True)
    transport_mode_display = serializers.CharField(
        source='get_transport_mode_display', read_only=True
    )

    class Meta:
        model = TransportRoute
        fields = [
            'id', 'route_number', 'transport_mode', 'transport_mode_display',
            'name', 'origin_stop', 'destination_stop', 'city',
            'is_active', 'operating_hours_start', 'operating_hours_end',
            'frequency_minutes',
        ]


class RouteSegmentSerializer(serializers.ModelSerializer):
    stop = TransportStopSerializer(read_only=True)

    class Meta:
        model = RouteSegment
        fields = [
            'id', 'route', 'stop', 'sequence',
            'estimated_time_minutes', 'distance_km',
        ]


class FareSerializer(serializers.ModelSerializer):
    route = TransportRouteSerializer(read_only=True)
    origin_stop = TransportStopSerializer(read_only=True)
    destination_stop = TransportStopSerializer(read_only=True)

    class Meta:
        model = Fare
        fields = [
            'id', 'route', 'origin_stop', 'destination_stop',
            'amount_ngn', 'currency', 'is_verified', 'last_verified',
        ]


class UserFavoritePlaceSerializer(serializers.ModelSerializer):
    location = serializers.SerializerMethodField()

    class Meta:
        model = UserFavoritePlace
        fields = ['id', 'name', 'location', 'address', 'created_at']
        read_only_fields = ['created_at']

    def get_location(self, obj):
        if obj.location:
            if POSTGIS_AVAILABLE and hasattr(obj.location, 'y'):
                return {'latitude': obj.location.y, 'longitude': obj.location.x}
            if isinstance(obj.location, dict):
                return obj.location
        return None

from rest_framework import serializers

# Handle optional PostGIS import
try:
    from django.contrib.gis.geos import Point
    POSTGIS_AVAILABLE = True
except Exception:
    # GDAL not installed or PostGIS not available
    POSTGIS_AVAILABLE = False
    Point = None

from .models import (
    City, TransportStop, TransportRoute, RouteSegment,
    Fare, RouteSuggestion, RouteStep, UserReport,
    UserFavoritePlace, UserRouteHistory, Corridor,
    CorridorStop, StopConnection
)


class LocationSerializer(serializers.Serializer):
    """Serializer for location coordinates"""
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
            'address', 'city', 'landmark', 'is_verified'
        ]

    def get_location(self, obj):
        if obj.location:
            return {
                'latitude': obj.location.y,
                'longitude': obj.location.x,
            }
        return None


class TransportRouteSerializer(serializers.ModelSerializer):
    origin_stop = TransportStopSerializer(read_only=True)
    destination_stop = TransportStopSerializer(read_only=True)
    transport_mode_display = serializers.CharField(source='get_transport_mode_display', read_only=True)

    class Meta:
        model = TransportRoute
        fields = [
            'id', 'route_number', 'transport_mode', 'transport_mode_display',
            'name', 'origin_stop', 'destination_stop', 'city',
            'is_active', 'operating_hours_start', 'operating_hours_end',
            'frequency_minutes'
        ]


class RouteSegmentSerializer(serializers.ModelSerializer):
    stop = TransportStopSerializer(read_only=True)

    class Meta:
        model = RouteSegment
        fields = [
            'id', 'route', 'stop', 'sequence',
            'estimated_time_minutes', 'distance_km'
        ]


class FareSerializer(serializers.ModelSerializer):
    route = TransportRouteSerializer(read_only=True)
    origin_stop = TransportStopSerializer(read_only=True)
    destination_stop = TransportStopSerializer(read_only=True)

    class Meta:
        model = Fare
        fields = [
            'id', 'route', 'origin_stop', 'destination_stop',
            'amount_ngn', 'currency', 'is_verified', 'last_verified'
        ]


class RouteStepSerializer(serializers.ModelSerializer):
    start_location = serializers.SerializerMethodField()
    end_location = serializers.SerializerMethodField()
    route_number = serializers.CharField(source='route.route_number', read_only=True, allow_null=True)
    transport_mode_display = serializers.CharField(source='get_transport_mode_display', read_only=True)

    class Meta:
        model = RouteStep
        fields = [
            'sequence', 'transport_mode', 'transport_mode_display',
            'route_id', 'route_number', 'instruction',
            'start_location', 'end_location',
            'distance_km', 'duration_minutes', 'fare_ngn'
        ]

    def get_start_location(self, obj):
        if obj.start_location:
            return {
                'latitude': obj.start_location.y,
                'longitude': obj.start_location.x,
            }
        return None

    def get_end_location(self, obj):
        if obj.end_location:
            return {
                'latitude': obj.end_location.y,
                'longitude': obj.end_location.x,
            }
        return None


class RouteSuggestionSerializer(serializers.ModelSerializer):
    steps = RouteStepSerializer(many=True, read_only=True)
    origin = serializers.SerializerMethodField()
    destination = serializers.SerializerMethodField()
    path = serializers.SerializerMethodField()
    transport_modes = serializers.SerializerMethodField()

    class Meta:
        model = RouteSuggestion
        fields = [
            'id', 'origin', 'destination', 'city',
            'total_time_minutes', 'total_distance_km', 'total_fare_ngn',
            'transport_modes', 'steps', 'path',
            'view_count', 'favorite_count'
        ]

    def get_origin(self, obj):
        if obj.origin:
            return {
                'latitude': obj.origin.y,
                'longitude': obj.origin.x,
            }
        return None

    def get_destination(self, obj):
        if obj.destination:
            return {
                'latitude': obj.destination.y,
                'longitude': obj.destination.x,
            }
        return None

    def get_path(self, obj):
        if obj.path:
            # Convert LineString to array of [lng, lat] coordinates
            return {
                'type': 'LineString',
                'coordinates': [[coord[0], coord[1]] for coord in obj.path.coords]
            }
        return None

    def get_transport_modes(self, obj):
        # Extract unique transport modes from steps
        return list(obj.route_steps.values_list('transport_mode', flat=True).distinct())


class RouteSearchRequestSerializer(serializers.Serializer):
    """Serializer for route search requests"""
    origin = LocationSerializer()
    destination = LocationSerializer()
    city = serializers.IntegerField()
    transport_modes = serializers.ListField(
        child=serializers.ChoiceField(choices=['bus', 'keke', 'okada', 'walk']),
        required=False
    )
    max_walk_distance_km = serializers.FloatField(default=1.0, required=False)

    def validate_origin(self, value):
        """Convert dict to Point if PostGIS is available"""
        if POSTGIS_AVAILABLE and Point:
            return Point(value['longitude'], value['latitude'], srid=4326)
        return value

    def validate_destination(self, value):
        """Convert dict to Point if PostGIS is available"""
        if POSTGIS_AVAILABLE and Point:
            return Point(value['longitude'], value['latitude'], srid=4326)
        return value


class UserReportSerializer(serializers.ModelSerializer):
    location = serializers.SerializerMethodField()
    new_location = serializers.SerializerMethodField()

    class Meta:
        model = UserReport
        fields = [
            'id', 'report_type', 'route', 'stop', 'fare',
            'title', 'description', 'location',
            'new_fare_ngn', 'new_location',
            'status', 'upvotes', 'downvotes',
            'user_device_id', 'created_at'
        ]
        read_only_fields = ['status', 'upvotes', 'downvotes', 'created_at']

    def get_location(self, obj):
        if obj.location:
            return {
                'latitude': obj.location.y,
                'longitude': obj.location.x,
            }
        return None

    def get_new_location(self, obj):
        if obj.new_location:
            return {
                'latitude': obj.new_location.y,
                'longitude': obj.new_location.x,
            }
        return None


class UserFavoritePlaceSerializer(serializers.ModelSerializer):
    location = serializers.SerializerMethodField()

    class Meta:
        model = UserFavoritePlace
        fields = ['id', 'name', 'location', 'address', 'created_at']
        read_only_fields = ['created_at']

    def get_location(self, obj):
        if obj.location:
            return {
                'latitude': obj.location.y,
                'longitude': obj.location.x,
            }
        return None


    def get_destination(self, obj):
        if obj.destination:
            return {
                'latitude': obj.destination.y,
                'longitude': obj.destination.x,
            }
        return None


class StopConnectionSerializer(serializers.ModelSerializer):
    """Serializer for stop connections"""
    from_stop = TransportStopSerializer(read_only=True)
    to_stop = TransportStopSerializer(read_only=True)
    transport_mode_display = serializers.CharField(
        source='get_transport_mode_display', 
        read_only=True
    )

    class Meta:
        model = StopConnection
        fields = [
            'id', 'from_stop', 'to_stop', 'transport_mode',
            'transport_mode_display', 'corridor', 'estimated_time_minutes',
            'distance_km', 'is_verified', 'created_at'
        ]


class CorridorStopSerializer(serializers.ModelSerializer):
    """Serializer for a stop within a corridor"""
    stop = TransportStopSerializer(read_only=True)
    stop_type_display = serializers.CharField(
        source='get_stop_type_display',
        read_only=True
    )

    class Meta:
        model = CorridorStop
        fields = [
            'id', 'sequence', 'stop', 'stop_type', 'stop_type_display',
            'estimated_time_from_previous'
        ]


class CorridorDetailSerializer(serializers.ModelSerializer):
    """Detailed corridor serializer with all stops and connections"""
    corridor_stops = CorridorStopSerializer(many=True, read_only=True)
    connections = StopConnectionSerializer(many=True, read_only=True)
    primary_mode_display = serializers.CharField(
        source='get_primary_mode_display',
        read_only=True
    )
    city = CitySerializer(read_only=True)

    class Meta:
        model = Corridor
        fields = [
            'id', 'corridor_id', 'name', 'description', 'primary_mode',
            'primary_mode_display', 'city', 'is_active', 'operating_hours_start',
            'operating_hours_end', 'notes', 'corridor_stops', 'connections',
            'created_at', 'updated_at'
        ]


class CorridorListSerializer(serializers.ModelSerializer):
    """Brief corridor serializer for list views"""
    primary_mode_display = serializers.CharField(
        source='get_primary_mode_display',
        read_only=True
    )
    stop_count = serializers.SerializerMethodField()

    class Meta:
        model = Corridor
        fields = [
            'id', 'corridor_id', 'name', 'primary_mode', 'primary_mode_display',
            'city', 'is_active', 'stop_count', 'notes'
        ]

    def get_stop_count(self, obj):
        return obj.corridor_stops.count()

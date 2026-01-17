from rest_framework import serializers
from django.contrib.gis.geos import Point
from .models import (
    City, TransportStop, TransportRoute, RouteSegment,
    Fare, RouteSuggestion, RouteStep, UserReport,
    UserFavoritePlace, UserRouteHistory
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
        """Convert dict to Point"""
        return Point(value['longitude'], value['latitude'], srid=4326)

    def validate_destination(self, value):
        """Convert dict to Point"""
        return Point(value['longitude'], value['latitude'], srid=4326)


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


class UserRouteHistorySerializer(serializers.ModelSerializer):
    origin = serializers.SerializerMethodField()
    destination = serializers.SerializerMethodField()
    route_suggestion = RouteSuggestionSerializer(read_only=True)

    class Meta:
        model = UserRouteHistory
        fields = [
            'id', 'origin', 'destination', 'origin_name', 'destination_name',
            'route_suggestion', 'searched_at'
        ]
        read_only_fields = ['searched_at']

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


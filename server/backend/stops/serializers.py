from rest_framework import serializers
from core.serializers import CitySerializer, TransportStopSerializer
from core.models import Corridor, CorridorStop, StopConnection


class StopConnectionSerializer(serializers.ModelSerializer):
    from_stop = TransportStopSerializer(read_only=True)
    to_stop = TransportStopSerializer(read_only=True)
    transport_mode_display = serializers.CharField(
        source='get_transport_mode_display',
        read_only=True,
    )

    class Meta:
        model = StopConnection
        fields = [
            'id', 'from_stop', 'to_stop', 'transport_mode',
            'transport_mode_display', 'corridor', 'estimated_time_minutes',
            'distance_km', 'is_verified', 'created_at',
        ]


class CorridorStopSerializer(serializers.ModelSerializer):
    stop = TransportStopSerializer(read_only=True)
    stop_type_display = serializers.CharField(
        source='get_stop_type_display',
        read_only=True,
    )

    class Meta:
        model = CorridorStop
        fields = [
            'id', 'sequence', 'stop', 'stop_type', 'stop_type_display',
            'estimated_time_from_previous',
        ]


class CorridorDetailSerializer(serializers.ModelSerializer):
    corridor_stops = CorridorStopSerializer(many=True, read_only=True)
    connections = StopConnectionSerializer(many=True, read_only=True)
    primary_mode_display = serializers.CharField(
        source='get_primary_mode_display',
        read_only=True,
    )
    city = CitySerializer(read_only=True)

    class Meta:
        model = Corridor
        fields = [
            'id', 'corridor_id', 'name', 'description', 'primary_mode',
            'primary_mode_display', 'city', 'is_active', 'operating_hours_start',
            'operating_hours_end', 'notes', 'corridor_stops', 'connections',
            'created_at', 'updated_at',
        ]


class CorridorListSerializer(serializers.ModelSerializer):
    primary_mode_display = serializers.CharField(
        source='get_primary_mode_display',
        read_only=True,
    )
    stop_count = serializers.SerializerMethodField()

    class Meta:
        model = Corridor
        fields = [
            'id', 'corridor_id', 'name', 'primary_mode', 'primary_mode_display',
            'city', 'is_active', 'stop_count', 'notes',
        ]

    def get_stop_count(self, obj):
        return obj.corridor_stops.count()
